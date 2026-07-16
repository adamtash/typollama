import { DEFAULT_PROMPTS, DEFAULT_SHORTCUTS, PROVIDER_CONFIGS, SETTINGS_DEFAULTS, settingKey, providerSettingsKey } from "./constants.js";
import { saveSecret } from "./secure-storage.js";

const $ = (id) => document.getElementById(id);
const state = { settings: {}, secretPresence: {}, recording: false };

function notify(message, error = false) {
  const status = $("status");
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("error", error);
}

function provider() {
  return PROVIDER_CONFIGS[$("provider").value];
}

function type() {
  return $("promptType").value;
}

function populateProviders() {
  const groups = new Map();
  for (const [id, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (!groups.has(config.group)) groups.set(config.group, []);
    groups.get(config.group).push([id, config]);
  }
  for (const [label, providers] of groups) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const [id, config] of providers) group.append(new Option(config.label, id));
    $("provider").append(group);
  }
}

function providerValues(id) {
  const config = PROVIDER_CONFIGS[id];
  const previous = state.settings[providerSettingsKey(id)] || state.settings[id] || {};
  return {
    model: previous.model || config.defaultModel || "",
    baseUrl: previous.baseUrl || previous.url || config.defaultBaseUrl || ""
  };
}

function renderConnection() {
  const config = provider();
  const values = providerValues($("provider").value);
  const isChrome = config.apiType === "chrome";
  $("connectionFields").hidden = isChrome;
  $("model").disabled = isChrome;
  $("providerDocs").href = config.docsUrl;
  $("providerDocs").textContent = `${config.label} documentation ↗`;
  if (isChrome) return;

  const hasKey = Boolean(config.keyName);
  $("apiKeyLabel").hidden = !hasKey;
  $("apiKeyRow").hidden = !hasKey;
  $("apiKey").value = "";
  $("apiKey").placeholder = state.secretPresence[config.keyName] ? "Saved locally — enter a new key to replace it" : config.customEndpoint ? "Optional API key" : "Paste API key";
  $("clearKey").hidden = !state.secretPresence[config.keyName];

  const hasBaseUrl = Boolean(config.defaultBaseUrl);
  $("baseUrlLabel").hidden = !hasBaseUrl;
  $("baseUrl").hidden = !hasBaseUrl;
  $("baseUrl").disabled = !hasBaseUrl;
  $("baseUrl").value = values.baseUrl;
  $("baseUrl").required = hasBaseUrl;
  $("model").value = values.model;
}

function renderWritingTool() {
  const promptType = type();
  $("systemPrompt").value = state.settings[settingKey("systemPrompt", promptType)] ?? DEFAULT_PROMPTS[promptType];
  $("shortcutMode").value = state.settings[settingKey("shortcutMode", promptType)] ?? DEFAULT_SHORTCUTS[promptType];
  $("customShortcut").value = state.settings[settingKey("customShortcut", promptType)] ?? "";
  $("customShortcutRow").hidden = $("shortcutMode").value !== "custom";
}

async function load() {
  populateProviders();
  state.settings = { ...SETTINGS_DEFAULTS, ...(await chrome.storage.sync.get(null)) };
  const local = await chrome.storage.local.get(Object.values(PROVIDER_CONFIGS).flatMap(({ keyName }) => keyName ? [keyName] : []));
  state.secretPresence = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, Boolean(value)]));
  $("provider").value = state.settings.provider in PROVIDER_CONFIGS ? state.settings.provider : SETTINGS_DEFAULTS.provider;
  $("advanced").open = state.settings.advancedSettingsOpen;
  $("copyToClipboard").checked = state.settings.copyToClipboard;
  renderConnection();
  renderWritingTool();
}

async function requestCustomOrigin() {
  if ($("provider").value !== "compatible") return true;
  const url = new URL($("baseUrl").value.trim());
  const origin = `${url.protocol}//${url.host}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

async function save(event) {
  event.preventDefault();
  const providerId = $("provider").value;
  const config = provider();
  try {
    if (!$("settingsForm").reportValidity()) return;
    if (!(await requestCustomOrigin())) throw new Error("Endpoint access was not granted. Typollama cannot contact that server.");
    const values = {
      model: $("model").value.trim() || config.defaultModel,
      ...(config.defaultBaseUrl ? { baseUrl: $("baseUrl").value.trim() } : {})
    };
    const promptType = type();
    const updates = {
      provider: providerId,
      advancedSettingsOpen: $("advanced").open,
      copyToClipboard: $("copyToClipboard").checked,
      [settingKey("systemPrompt", promptType)]: $("systemPrompt").value.trim() || DEFAULT_PROMPTS[promptType],
      [settingKey("shortcutMode", promptType)]: $("shortcutMode").value,
      [settingKey("customShortcut", promptType)]: $("shortcutMode").value === "custom" ? $("customShortcut").value.trim() : ""
    };
    if (config.defaultModel !== null) updates[providerSettingsKey(providerId)] = values;
    await chrome.storage.sync.set(updates);
    Object.assign(state.settings, updates);
    if (config.keyName && $("apiKey").value.trim()) {
      await saveSecret(config.keyName, $("apiKey").value.trim());
      state.secretPresence[config.keyName] = true;
      $("apiKey").value = "";
    }
    renderConnection();
    notify("Settings saved. Changes apply to open pages immediately.");
  } catch (error) {
    notify(error.message || "Settings could not be saved.", true);
  }
}

async function clearKey() {
  const config = provider();
  if (!config.keyName) return;
  await saveSecret(config.keyName, "");
  state.secretPresence[config.keyName] = false;
  renderConnection();
  notify("Saved API key cleared.");
}

function shortcutFrom(event) {
  const parts = [];
  if (event.ctrlKey) parts.push("Control");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  if (!["Control", "Alt", "Shift", "Meta"].includes(event.key)) parts.push(event.key);
  return parts.join(" + ");
}

function stopRecording() {
  state.recording = false;
  $("recordShortcut").textContent = "Record";
  window.removeEventListener("keydown", recordKey, true);
}

function recordKey(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") return stopRecording();
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
  $("customShortcut").value = shortcutFrom(event);
  stopRecording();
}

function toggleRecording() {
  if (state.recording) return stopRecording();
  state.recording = true;
  $("customShortcut").value = "";
  $("recordShortcut").textContent = "Cancel";
  window.addEventListener("keydown", recordKey, true);
}

$("settingsForm").addEventListener("submit", save);
$("provider").addEventListener("change", renderConnection);
$("promptType").addEventListener("change", renderWritingTool);
$("shortcutMode").addEventListener("change", () => { $("customShortcutRow").hidden = $("shortcutMode").value !== "custom"; });
$("clearKey").addEventListener("click", clearKey);
$("recordShortcut").addEventListener("click", toggleRecording);
$("resetPrompt").addEventListener("click", () => { $("systemPrompt").value = DEFAULT_PROMPTS[type()]; });
$("advanced").addEventListener("toggle", () => { state.settings.advancedSettingsOpen = $("advanced").open; });

load().catch((error) => notify(error.message || "Typollama could not load settings.", true));
