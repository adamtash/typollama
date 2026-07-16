import { DEFAULT_PROMPTS, PROVIDER_CONFIGS, SETTINGS_DEFAULTS, settingKey, providerSettingsKey } from "./constants.js";
import { createRequest, responseError, streamText } from "./provider-adapters.js";
import { configurePrivateStorage, readSecrets } from "./secure-storage.js";

const MENU_ITEMS = [
  ["typollama-spellcheck", "contextMenuSpellcheck", "spellcheck"],
  ["typollama-proofread", "contextMenuProofread", "proofread"],
  ["typollama-custom", "contextMenuCustom", "custom"]
];

async function initialize() {
  await configurePrivateStorage();
  await chrome.contextMenus.removeAll();
  for (const [id, titleKey] of MENU_ITEMS) {
    chrome.contextMenus.create({ id, title: chrome.i18n.getMessage(titleKey), contexts: ["editable"] });
  }

  const current = await chrome.storage.sync.get(null);
  const defaults = {};
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    if (current[key] === undefined) defaults[key] = value;
  }
  for (const [id, provider] of Object.entries(PROVIDER_CONFIGS)) {
    if (provider.defaultModel === null) continue;
    const key = providerSettingsKey(id);
    const oldValue = current[id] || {};
    const saved = current[key] || {};
    const model = saved.model || oldValue.model || provider.defaultModel;
    const baseUrl = provider.defaultBaseUrl && (saved.baseUrl || oldValue.baseUrl || oldValue.url || provider.defaultBaseUrl);
    if (!current[key]) defaults[key] = { model, ...(baseUrl ? { baseUrl } : {}) };
  }
  if (Object.keys(defaults).length) await chrome.storage.sync.set(defaults);
}

chrome.runtime.onInstalled.addListener(() => { initialize().catch(console.error); });
chrome.runtime.onStartup.addListener(() => { configurePrivateStorage().catch(console.error); });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const item = MENU_ITEMS.find(([id]) => id === info.menuItemId);
  if (!item || !tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "typollama:process", promptType: item[2] }, { frameId: info.frameId || 0 });
  } catch (error) {
    console.warn("Could not reach the selected editor", error);
  }
});

function promptFor(config, promptType) {
  const type = DEFAULT_PROMPTS[promptType] ? promptType : "spellcheck";
  return config[settingKey("systemPrompt", type)] || DEFAULT_PROMPTS[type];
}

async function* chromeAiStream(text, prompt) {
  const rewriter = globalThis.ai?.rewriter;
  if (!rewriter) throw new Error("Chrome built-in AI is unavailable in this browser profile.");
  const session = await rewriter.create({ sharedContext: prompt });
  try {
    const stream = await session.rewriteStreaming(text);
    for await (const chunk of stream) yield chunk;
  } finally {
    session.destroy?.();
  }
}

async function requestText({ text, promptType, signal, onChunk }) {
  if (!text?.trim()) throw new Error("Select or enter text before running Typollama.");
  const config = await chrome.storage.sync.get(null);
  const providerId = config.provider || SETTINGS_DEFAULTS.provider;
  const provider = PROVIDER_CONFIGS[providerId];
  if (!provider) throw new Error("The saved provider is not supported. Choose one in Typollama settings.");
  const prompt = promptFor(config, promptType);

  if (provider.apiType === "chrome") {
    for await (const chunk of chromeAiStream(text, prompt)) onChunk(chunk);
    return;
  }

  const secrets = await readSecrets();
  const request = createRequest({
    providerId,
    providerSettings: config[providerSettingsKey(providerId)] || config[providerId] || {},
    apiKey: secrets[provider.keyName] || "",
    prompt,
    text
  });
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal
  });
  if (!response.ok) throw new Error(await responseError(response));
  for await (const chunk of streamText(response, provider.apiType)) onChunk(chunk);
}

function startPortRequest(port, request) {
  const controller = new AbortController();
  let closed = false;
  port.onDisconnect.addListener(() => { closed = true; controller.abort(); });
  requestText({
    text: request.text,
    promptType: request.promptType,
    signal: controller.signal,
    onChunk: (chunk) => { if (!closed) port.postMessage({ type: "chunk", chunk }); }
  }).then(
    () => { if (!closed) port.postMessage({ type: "done" }); },
    (error) => { if (!closed && error.name !== "AbortError") port.postMessage({ type: "error", message: error.message || "Request failed." }); }
  );
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "typollama:stream") return;
  port.onMessage.addListener((request) => {
    if (request?.type === "typollama:process") startPortRequest(port, request);
  });
});
