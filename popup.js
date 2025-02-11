import {
  DEFAULT_CUSTOM_PROMPT,
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_SHORTCUT_MODE_CUSTOM,
  DEFAULT_SHORTCUT_MODE_PROOFREAD,
  DEFAULT_SHORTCUT_MODE_SPELLCHECK,
  DEFAULT_SPELLCHECK_PROMPT,
  PROVIDER_CONFIGS
} from './constants.js';

const maskedKey = "********";
const el = (id) => document.getElementById(id);
let saveTimeout;

const isDefaultValue = (input, defaultValue) => input.value === defaultValue;

function updateResetButtonVisibility() {
  const promptType = el("promptTypeSelect").value;
  const defaultPrompt = getDefaultPrompt(promptType);
  el('resetPrompt').style.display = el('systemPromptInput').value !== defaultPrompt ? 'block' : 'none';
  updateResetButtonVisibilityForUrlsAndModelName();
}

function getDefaultModelName(provider) {
  return PROVIDER_CONFIGS[provider]?.defaultModel || "";
}

async function loadEncryptedKeys() {
  const localKeys = await chrome.storage.local.get(["openAiKey", "anthropicKey", "geminiKey", "deepseekKey", "mistralKey", "perplexityKey"]);
  if (localKeys.openAiKey) el("openAiKeyInput").value = maskedKey;
  if (localKeys.anthropicKey) el("anthropicKeyInput").value = maskedKey;
  if (localKeys.geminiKey) el("geminiKeyInput").value = maskedKey;
  if (localKeys.deepseekKey) el("deepseekKeyInput").value = maskedKey;
  if (localKeys.mistralKey) el("mistralKeyInput").value = maskedKey;
  if (localKeys.perplexityKey) el("perplexityKeyInput").value = maskedKey;
}

function getDefaultPrompt(promptType, settings = {}) {
  switch (promptType) {
    case "proofread":
      return settings.systemPromptProofread ?? DEFAULT_PROOFREAD_PROMPT;
    case "custom":
      return settings.systemPromptCustom ?? DEFAULT_CUSTOM_PROMPT;
    default:
      return settings.systemPromptSpellcheck ?? DEFAULT_SPELLCHECK_PROMPT;
  }
}

function getShortcutSettings(promptType, settings) {
  let shortcutMode, customShortcut;
  switch (promptType) {
    case "proofread":
      shortcutMode = settings.shortcutModeProofread ?? DEFAULT_SHORTCUT_MODE_PROOFREAD;
      customShortcut = settings.customShortcutProofread ?? "";
      break;
    case "custom":
      shortcutMode = settings.shortcutModeCustom ?? DEFAULT_SHORTCUT_MODE_CUSTOM;
      customShortcut = settings.customShortcutCustom ?? "";
      break;
    default:
      shortcutMode = settings.shortcutModeSpellcheck ?? DEFAULT_SHORTCUT_MODE_SPELLCHECK;
      customShortcut = settings.customShortcutSpellcheck ?? "";
  }
  return { shortcutMode, customShortcut };
}

function setShortcutMode(shortcutMode, customShortcut = "") {
  const customRadio = document.querySelector(`input[name="shortcutMode"][value="custom"]`);
  document.querySelectorAll('input[name="shortcutMode"]').forEach(radio => radio.checked = false);
  if (shortcutMode === "custom") {
    customRadio.checked = true;
    el("customShortcutLabel").style.display = "block";
    el("customShortcutInput").value = customShortcut;
  } else {
    el("customShortcutLabel").style.display = "none";
    el("customShortcutInput").value = "";
    const radio = document.querySelector(`input[name="shortcutMode"][value="${shortcutMode}"]`);
    if (radio) radio.checked = true;
  }
}

async function updateUISettings() {
  const settings = await chrome.storage.sync.get(null);
  const promptType = el("promptTypeSelect").value;
  el("systemPromptInput").value = getDefaultPrompt(promptType, settings);
  const { shortcutMode, customShortcut } = getShortcutSettings(promptType, settings);
  updateResetButtonVisibility();
  updateProviderSelection();
  updateProviderValues();
  setShortcutMode(shortcutMode, customShortcut);
  el("copyToClipboard").checked = settings.copyToClipboard === true;
  updateResetButtonVisibilityForUrlsAndModelName();

}

async function populateSettings() {
  await updateUISettings();
  hideError();
  chrome.storage.local.get(['popupError'], (result) => {
    if (result.popupError) showError(result.popupError);
  });
}

async function updateProviderValues() {
  const provider = el("providerSelect").value;
  if (provider === "chrome") return;
  const saved = await chrome.storage.sync.get([provider]);
  const providerData = saved[provider] || {};
  const modelName = (providerData.model && providerData.model.trim()) || getDefaultModelName(provider);
  el("modelNameInput").value = modelName;
  if (provider === "ollama" || provider === "lmstudio") {
    const urlInputId = provider === "ollama" ? "ollamaUrlInput" : "lmstudioUrlInput";
    const defaultUrl = provider === "ollama" ? PROVIDER_CONFIGS.ollama.defaultUrl : PROVIDER_CONFIGS.lmstudio.defaultUrl;
    const url = (providerData.url && providerData.url.trim()) || defaultUrl;
    el(urlInputId).value = url;
  }
}

async function updateProviderSelection() {
  const config = await chrome.storage.sync.get("provider");
  if (config.provider) {
    el("providerSelect").value = config.provider;
  }
}

(async function initSettings() {
  await updateProviderSelection();
  await populateSettings();
  handleProviderChange();
  await updateProviderValues();
  await loadEncryptedKeys();
  setupEventListeners();
})();

function showError(message) {
  const errorContainer = el("errorContainer");
  errorContainer.textContent = message;
  errorContainer.style.display = "block";
}

function hideError() {
  el("errorContainer").style.display = "none";
  chrome.storage.local.remove("popupError");
}

function showProviderDoc(newProvider) {
  const docElements = ['ollamaDocs', 'openaiDocs', 'anthropicDocs', 'lmstudioDocs', 'geminiDocs', 'chromeDocs', 'deepseekDocs', 'mistralDocs', 'perplexityDocs'];
  docElements.forEach(id => el(id).style.display = 'none');
  const docMap = {
    'ollama': 'ollamaDocs',
    'openai': 'openaiDocs',
    'anthropic': 'anthropicDocs',
    'lmstudio': 'lmstudioDocs',
    'gemini': 'geminiDocs',
    'chrome': 'chromeDocs',
    'deepseek': 'deepseekDocs',
    'mistral': 'mistralDocs',
    'perplexity': 'perplexityDocs'
  };
  el("providerDocs").style.display = 'block';
  if (docMap[newProvider]) el(docMap[newProvider]).style.display = 'block';
}

async function handleProviderChange() {
  hideError();
  const provider = el("providerSelect").value;
  const urlInputContainer = document.querySelector(".url-input-container");
  const openAiKeyInput = el("openAiKeyInput");
  const anthropicKeyInput = el("anthropicKeyInput");
  const geminiKeyInput = el("geminiKeyInput");
  const deepseekKeyInput = el("deepseekKeyInput");
  const mistralKeyInput = el("mistralKeyInput");
  const perplexityKeyInput = el("perplexityKeyInput");
  const modelNameInput = el("modelNameInput");
  const resetModelName = el("resetModelName");
  const modelNameLabel = el("modelNameLabel");
  const ollamaUrlInput = el("ollamaUrlInput");
  const lmstudioUrlInput = el("lmstudioUrlInput");
  const providerDocs = el("providerDocs");
  const chromeAiNote = el("chromeAiNote");
  urlInputContainer.style.display = "none";
  openAiKeyInput.style.display = "none";
  anthropicKeyInput.style.display = "none";
  geminiKeyInput.style.display = "none";
  deepseekKeyInput.style.display = "none";
  mistralKeyInput.style.display = "none";
  perplexityKeyInput.style.display = "none";
  ollamaUrlInput.style.display = "none";
  lmstudioUrlInput.style.display = "none";
  chromeAiNote.style.display = "none";
  showProviderDoc(provider);
  await chrome.storage.sync.set({ provider: provider });
  updateProviderValues();
  const providerKeyMap = {
    "openai": "openAiKeyInput",
    "anthropic": "anthropicKeyInput",
    "gemini": "geminiKeyInput",
    "deepseek": "deepseekKeyInput",
    "mistral": "mistralKeyInput",
    "perplexity": "perplexityKeyInput",
    "ollama": "ollamaUrlInput",
    "lmstudio": "lmstudioUrlInput"
  };
  if (providerKeyMap[provider]) {
    const inputIdToShow = providerKeyMap[provider];
    el(inputIdToShow).style.display = 'block';
  }
  const providerRequiresModel = PROVIDER_CONFIGS[provider]?.defaultModel !== null;
  modelNameInput.style.display = providerRequiresModel ? 'block' : 'none';
  modelNameLabel.style.display = providerRequiresModel ? 'block' : 'none';
  resetModelName.style.display = providerRequiresModel ? 'block' : 'none';
  if (provider === "chrome") {
    chromeAiNote.style.display = "block";
  }
  if (provider === "ollama" || provider === "lmstudio") {
    urlInputContainer.style.display = "block";
  }
  updateResetButtonVisibilityForUrlsAndModelName();
}

function handleResetPrompt() {
  const promptType = el("promptTypeSelect").value;
  const defaultPrompt = getDefaultPrompt(promptType);
  el("systemPromptInput").value = defaultPrompt;
  updateResetButtonVisibility();
  debouncedAutoSave();
}

function handleResetOllamaUrl() {
  el("ollamaUrlInput").value = PROVIDER_CONFIGS.ollama.defaultUrl;
  updateResetButtonVisibilityForUrlsAndModelName();
  debouncedAutoSave();
}

function handleResetLmstudioUrl() {
  el("lmstudioUrlInput").value = PROVIDER_CONFIGS.lmstudio.defaultUrl;
  updateResetButtonVisibilityForUrlsAndModelName();
  debouncedAutoSave();
}

function handleResetModelName() {
  const provider = el("providerSelect").value;
  el("modelNameInput").value = getDefaultModelName(provider);
  updateResetButtonVisibilityForUrlsAndModelName();
  debouncedAutoSave();
}

async function handlePromptTypeChange() {
  await updateUISettings();
  debouncedAutoSave();
}

async function getEncryptionKey() {
  let storedKey = await chrome.storage.local.get(['encKey']);
  if (storedKey.encKey) {
    const keyBuffer = Uint8Array.from(JSON.parse(storedKey.encKey)).buffer;
    return await crypto.subtle.importKey("raw", keyBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
  } else {
    const newKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const newKeyBuffer = await crypto.subtle.exportKey("raw", newKey);
    const newKeyString = JSON.stringify(Array.from(new Uint8Array(newKeyBuffer)));
    await chrome.storage.local.set({ encKey: newKeyString });
    return newKey;
  }
}

async function encryptData(text) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedText);
  return {
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher))
  };
}

async function autoSaveSettings() {
  const provider = el("providerSelect").value;
  const modelName = el("modelNameInput").value.trim();
  const ollamaUrl = el("ollamaUrlInput").value.trim();
  const lmstudioUrl = el("lmstudioUrlInput").value.trim();
  const copyToClipboard = el("copyToClipboard").checked;
  const advancedSettingsOpen = !el("advancedToggle").classList.contains("collapsed");
  let settings = {
    provider,
    copyToClipboard,
    advancedSettingsOpen,
  };
  if (provider === 'openai') {
    settings.openai = { model: modelName };
  } else if (provider === 'anthropic') {
    settings.anthropic = { model: modelName };
  } else if (provider === 'gemini') {
    settings.gemini = { model: modelName };
  } else if (provider === 'ollama') {
    settings.ollama = { model: modelName, url: ollamaUrl };
  } else if (provider === 'lmstudio') {
    settings.lmstudio = { model: modelName, url: lmstudioUrl };
  } else if (provider === 'chrome') {
    settings.chrome = { model: modelName };
  }
  const promptType = el("promptTypeSelect").value;
  if (promptType === "proofread") {
    settings.systemPromptProofread = el("systemPromptInput").value;
    const shortcutModeValue = document.querySelector('#shortcutModeFieldset input[name="shortcutMode"]:checked')?.value;
    settings.shortcutModeProofread = shortcutModeValue;
    settings.customShortcutProofread = shortcutModeValue === "custom" ? el("customShortcutInput").value.trim() : "";
  } else if (promptType === "custom") {
    settings.systemPromptCustom = el("systemPromptInput").value;
    const shortcutModeValue = document.querySelector('#shortcutModeFieldset input[name="shortcutMode"]:checked')?.value;
    settings.shortcutModeCustom = shortcutModeValue;
    settings.customShortcutCustom = shortcutModeValue === "custom" ? el("customShortcutInput").value.trim() : "";
  } else {
    settings.systemPromptSpellcheck = el("systemPromptInput").value;
    const shortcutModeValue = document.querySelector('#shortcutModeFieldset input[name="shortcutMode"]:checked')?.value;
    settings.shortcutModeSpellcheck = shortcutModeValue;
    settings.customShortcutSpellcheck = shortcutModeValue === "custom" ? el("customShortcutInput").value.trim() : "";
  }
  await chrome.storage.sync.set(settings);
  await saveEncryptedKeys();
}

async function saveEncryptedKeys() {
  const newEncryptedKeys = {};
  const openAiKeyInput = el("openAiKeyInput").value;
  const anthropicKeyInput = el("anthropicKeyInput").value;
  const geminiKeyInput = el("geminiKeyInput").value;
  const deepseekKeyInput = el("deepseekKeyInput").value;
  const mistralKeyInput = el("mistralKeyInput").value;
  const perplexityKeyInput = el("perplexityKeyInput").value;
  if (openAiKeyInput && openAiKeyInput !== maskedKey)
    newEncryptedKeys.openAiKey = await encryptData(openAiKeyInput);
  if (anthropicKeyInput && anthropicKeyInput !== maskedKey)
    newEncryptedKeys.anthropicKey = await encryptData(anthropicKeyInput);
  if (geminiKeyInput && geminiKeyInput !== maskedKey)
    newEncryptedKeys.geminiKey = await encryptData(geminiKeyInput);
  if (deepseekKeyInput && deepseekKeyInput !== maskedKey)
    newEncryptedKeys.deepseekKey = await encryptData(deepseekKeyInput);
  if (mistralKeyInput && mistralKeyInput !== maskedKey)
    newEncryptedKeys.mistralKey = await encryptData(mistralKeyInput);
  if (perplexityKeyInput && perplexityKeyInput !== maskedKey)
    newEncryptedKeys.perplexityKey = await encryptData(perplexityKeyInput);
  await chrome.storage.local.set(newEncryptedKeys);
}

function debouncedAutoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autoSaveSettings, 500);
}

function setupEventListeners() {
  el("providerSelect").addEventListener("change", handleProviderChange);
  el("resetPrompt").addEventListener("click", handleResetPrompt);
  el("promptTypeSelect").addEventListener("change", handlePromptTypeChange);
  el("promptTypeSelect").addEventListener("change", async () => {
    await updateUISettings();
    debouncedAutoSave();
  });

  el("resetOllamaUrl").addEventListener("click", handleResetOllamaUrl);
  el("resetLmstudioUrl").addEventListener("click", handleResetLmstudioUrl);
  el("resetModelName").addEventListener("click", handleResetModelName);

  const shortcutRadios = document.querySelectorAll('#shortcutModeFieldset input[name="shortcutMode"]');
  shortcutRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      updateCustomShortcutVisibility(this.value);
      debouncedAutoSave();
    });
  });

  el("systemPromptInput").addEventListener("change", debouncedAutoSave);

  const autoSaveInputIds = [
    "ollamaUrlInput",
    "lmstudioUrlInput",
    "copyToClipboard",
    "modelNameInput",
    "openAiKeyInput",
    "anthropicKeyInput",
    "geminiKeyInput",
    "deepseekKeyInput",
    "mistralKeyInput",
    "perplexityKeyInput",
  ];
  autoSaveInputIds.forEach(id => el(id)?.addEventListener("change", debouncedAutoSave));

  el("advancedToggle").addEventListener("click", (event) => {
    const content = el("advancedContent");
    event.currentTarget.classList.toggle("collapsed");
    content.classList.toggle("collapsed");
    debouncedAutoSave();
  });

  setupShortcutRecording();

  ["modelNameInput", "systemPromptInput", "ollamaUrlInput", "lmstudioUrlInput"].forEach(id => {
    el(id)?.addEventListener('input', updateResetButtonVisibility);
  });
  ["modelNameInput", "ollamaUrlInput", "lmstudioUrlInput"].forEach(id => {
    el(id)?.addEventListener('input', updateResetButtonVisibilityForUrlsAndModelName);
  });

  window.addEventListener("beforeunload", autoSaveSettings);
}

let isRecording = false;
let recordedKeys = [];

function setupShortcutRecording() {
  const recordBtn = el("recordShortcut");
  const customInput = el("customShortcutInput");

  function keyHandler(e) {
    e.preventDefault();
    if (e.key === "Enter") {
      finishRecording();
      return;
    }

    let keyString = e.key;
    if (e.ctrlKey) keyString = "Control";
    if (e.altKey) keyString = "Alt";
    if (e.shiftKey) keyString = "Shift";
    if (e.metaKey) keyString = "Meta";

    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      const currentCombination = [...recordedKeys];
      if (e.ctrlKey && !recordedKeys.includes("Control")) currentCombination.push("Control");
      if (e.altKey && !recordedKeys.includes("Alt")) currentCombination.push("Alt");
      if (e.shiftKey && !recordedKeys.includes("Shift")) currentCombination.push("Shift");
      if (e.metaKey && !recordedKeys.includes("Meta")) currentCombination.push("Meta");

      if (e.key.startsWith("F") && parseInt(e.key.substring(1)) >= 1 && parseInt(e.key.substring(1)) <= 12) {
        currentCombination.push(e.key);
      } else if (!e.key.startsWith("F")) {
        currentCombination.push(e.key);
      }

      recordedKeys = currentCombination;
      customInput.value = recordedKeys.join(" + ");
      return;
    }

    if (!recordedKeys.includes(keyString)) {
      recordedKeys.push(keyString);
    }
    customInput.value = recordedKeys.join(" + ");
  }

  function finishRecording() {
    document.removeEventListener("keydown", keyHandler);
    recordBtn.textContent = "Record Shortcut";
    customInput.placeholder = "Recording complete";
    const promptType = el("promptTypeSelect").value;
    const shortcut = recordedKeys.join(" + ");

    switch (promptType) {
      case "proofread":
        chrome.storage.sync.set({ customShortcutProofread: shortcut });
      case "custom":
        chrome.storage.sync.set({ customShortcutCustom: shortcut });
      default:
        chrome.storage.sync.set({ customShortcutSpellcheck: shortcut });
    }
    isRecording = false;
    debouncedAutoSave();
  }

  recordBtn.addEventListener("click", () => {
    if (!isRecording) {
      isRecording = true;
      recordedKeys = [];
      customInput.value = "";
      customInput.placeholder = "Recording... press keys, finish with Enter";
      recordBtn.textContent = "Stop Recording";
      document.addEventListener("keydown", keyHandler);
    } else {
      finishRecording();
    }
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'showError') showError(request.error);
});

function updateCustomShortcutVisibility(shortcutMode) {
  if (shortcutMode === "custom") {
    el("customShortcutLabel").style.display = "block";
  } else {
    el("customShortcutLabel").style.display = "none";
  }
}

(function initializeCustomShortcutVisibility() {
  const checkedRadio = document.querySelector('#shortcutModeFieldset input[name="shortcutMode"]:checked');
  if (checkedRadio) {
    updateCustomShortcutVisibility(checkedRadio.value);
  }
})();

function updateResetButtonVisibilityForUrlsAndModelName() {
  const provider = el("providerSelect").value;
  const defaultModel = getDefaultModelName(provider);
  const defaultOllamaUrl = PROVIDER_CONFIGS.ollama.defaultUrl;
  const defaultLmstudioUrl = PROVIDER_CONFIGS.lmstudio.defaultUrl;

  el('resetModelName').style.display = el('modelNameInput').value !== defaultModel ? 'block' : 'none';
  if (provider === "ollama") {
    el('resetOllamaUrl').style.display = el('ollamaUrlInput').value !== defaultOllamaUrl ? 'block' : 'none';
    el('resetLmstudioUrl').style.display = 'none';
  }
  else if (provider === "lmstudio") {
    el('resetLmstudioUrl').style.display = el('lmstudioUrlInput').value !== defaultLmstudioUrl ? 'block' : 'none';
    el('resetOllamaUrl').style.display = 'none';
  }
  else {
    el('resetOllamaUrl').style.display = 'none';
    el('resetLmstudioUrl').style.display = 'none';
  }
}