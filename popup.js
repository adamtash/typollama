import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_OPENAI_MODEL, DEFAULT_SYSTEM_PROMPT } from './constants.js';

(async function initSettings() {
  const providerSelect = document.getElementById("providerSelect");
  const openAiKeyInput = document.getElementById("openAiKeyInput");
  const modelNameInput = document.getElementById("modelNameInput");
  const modelNameLabel = document.getElementById("modelName");
  const resetModelButton = document.getElementById("resetModel");
  const systemPromptInput = document.getElementById("systemPromptInput");
  const ollamaUrlInput = document.getElementById("ollamaUrlInput");
  const openAiKeyLabel = document.getElementById("openAiKeyLabel");
  const ollamaUrlLabel = document.getElementById("ollamaUrlLabel");
  const lmstudioUrlInput = document.getElementById("lmstudioUrlInput");
  const lmstudioUrlLabel = document.getElementById("lmstudioUrlLabel");
  const copyToClipboardCheckbox = document.getElementById("copyToClipboard");
  const shortcutModeRadios = document.getElementsByName("shortcutMode");
  const customShortcutInput = document.getElementById("customShortcutInput");
  const customShortcutLabel = document.getElementById("customShortcutLabel");

  const settings = await new Promise(resolve =>
    chrome.storage.sync.get(
      ["ollamaUrl", "lmstudioUrl", "provider", "openAiKey", "openAiModelName", "ollamaModelName", "lmstudioModelName", "systemPrompt", "shortcutMode", "customShortcut", "copyToClipboard"],
      resolve
    )
  );

  ollamaUrlInput.value = settings.ollamaUrl || DEFAULT_OLLAMA_URL;
  const providerValue = settings.provider === "openai" ? "openai"
                       : settings.provider === "lmstudio" ? "lmstudio"
                       : settings.provider === "chrome" ? "chrome"
                       : "ollama";
  providerSelect.value = providerValue;
  openAiKeyLabel.style.display = providerValue === "openai" ? "block" : "none";
  ollamaUrlLabel.style.display = providerValue === "ollama" ? "block" : "none";
  lmstudioUrlLabel.style.display = providerValue === "lmstudio" ? "block" : "none";

  if (providerValue === "chrome") {
    modelNameLabel.style.display = "none";
  } else {
    modelNameLabel.style.display = "block";
    resetModelButton.style.display = "inline-block";
    if (providerValue === "openai") {
      openAiKeyInput.value = settings.openAiKey || "";
      modelNameInput.value = settings.openAiModelName || DEFAULT_OPENAI_MODEL;
    } else if (providerValue === "lmstudio") {
      modelNameInput.value = settings.lmstudioModelName || DEFAULT_LMSTUDIO_MODEL;
      lmstudioUrlInput.value = settings.lmstudioUrl || DEFAULT_LMSTUDIO_URL;
    } else {
      modelNameInput.value = settings.ollamaModelName || DEFAULT_OLLAMA_MODEL;
    }
  }
  systemPromptInput.value = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  copyToClipboardCheckbox.checked = settings.copyToClipboard || false;
  document.getElementById("chromeAiNote").style.display = providerValue === "chrome" ? "block" : "none";

  const mode = settings.shortcutMode || "double_stroke";
  for (const radio of shortcutModeRadios) {
    radio.checked = radio.value === mode;
  }
  customShortcutLabel.style.display = mode === "custom" ? "block" : "none";
  customShortcutInput.value = settings.customShortcut ? settings.customShortcut.split(",").join(" + ") : "";

  chrome.storage.local.get(['popupError'], (result) => {
    if (result.popupError) showError(result.popupError);
  });
})();

function showError(message) {
  chrome.storage.local.set({ popupError: message });
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.textContent = message;
  errorContainer.style.display = 'block';
}

function hideError() {
  chrome.storage.local.remove('popupError');
  document.getElementById('errorContainer').style.display = 'none';
}

document.getElementById("providerSelect").addEventListener("change", async () => {
    const newProvider = document.getElementById("providerSelect").value;
    const storageResult = await chrome.storage.sync.get(["provider", "openAiModelName", "ollamaModelName", "lmstudioModelName"]);
    const oldProvider = storageResult.provider || "ollama";
    const currentModelName = document.getElementById("modelNameInput").value;
    const saveObj = {};
    saveObj[oldProvider === "openai" ? "openAiModelName" : oldProvider === "lmstudio" ? "lmstudioModelName" : "ollamaModelName"] = currentModelName;
    await chrome.storage.sync.set(saveObj);
    await chrome.storage.sync.set({ provider: newProvider });
    
    const useOpenAi = newProvider === "openai";
    const useOllama = newProvider === "ollama";
    const useLmstudio = newProvider === "lmstudio";
    const useChrome = newProvider === "chrome";
    document.getElementById("openAiKeyLabel").style.display = useOpenAi ? "block" : "none";
    document.getElementById("ollamaUrlLabel").style.display = useOllama ? "block" : "none";
    document.getElementById("lmstudioUrlLabel").style.display = useLmstudio ? "block" : "none";
    
    if (useChrome) {
      document.getElementById("modelNameInput").style.display = "none";
      document.getElementById("modelName").style.display = "none";
      document.getElementById("resetModel").style.display = "none";
    } else {
      document.getElementById("modelNameInput").style.display = "block";
      document.getElementById("modelName").style.display = "block";
      document.getElementById("resetModel").style.display = "inline-block";
      const { openAiModelName, ollamaModelName, lmstudioModelName } = await chrome.storage.sync.get(["openAiModelName", "ollamaModelName", "lmstudioModelName"]);
      modelNameInput.value = useOpenAi ? (openAiModelName || DEFAULT_OPENAI_MODEL)
                             : useLmstudio ? (lmstudioModelName || DEFAULT_LMSTUDIO_MODEL)
                             : (ollamaModelName || DEFAULT_OLLAMA_MODEL);
    }
    
    document.getElementById("chromeAiNote").style.display = useChrome ? "block" : "none";
});

document.getElementById("resetPrompt").addEventListener("click", () => {
  document.getElementById("systemPromptInput").value = DEFAULT_SYSTEM_PROMPT;
});

document.getElementById("resetModel").addEventListener("click", () => {
  const provider = document.getElementById("providerSelect").value;
  if (provider === "chrome") return;
  document.getElementById("modelNameInput").value =
    provider === "openai" ? DEFAULT_OPENAI_MODEL : provider === "lmstudio" ? DEFAULT_LMSTUDIO_MODEL : DEFAULT_OLLAMA_MODEL;
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  hideError();
  const provider = document.getElementById("providerSelect").value;
  const ollamaUrl = document.getElementById("ollamaUrlInput").value;
  const openAiKey = document.getElementById("openAiKeyInput").value;
  const currentModelName = provider === "chrome" ? "" : document.getElementById("modelNameInput").value;
  const systemPrompt = document.getElementById("systemPromptInput").value;
  const copyToClipboard = document.getElementById("copyToClipboard").checked;

  let shortcutMode = "double_stroke";
  for (const radio of document.getElementsByName("shortcutMode")) {
    if (radio.checked) { shortcutMode = radio.value; break; }
  }
  const customShortcut = document.getElementById("customShortcutInput").value;
  let keysToSave = { provider, ollamaUrl, openAiKey, systemPrompt, shortcutMode, customShortcut, copyToClipboard };
  const lmstudioUrl = document.getElementById("lmstudioUrlInput").value;
  if (provider === "lmstudio") keysToSave["lmstudioUrl"] = lmstudioUrl;
  if (provider !== "chrome") {
    keysToSave[provider === "openai" ? "openAiModelName" : provider === "lmstudio" ? "lmstudioModelName" : "ollamaModelName"] = currentModelName;
  }
  keysToSave.advancedSettingsOpen = !document.getElementById("advancedContent").classList.contains("collapsed");
  await chrome.storage.sync.set(keysToSave, () => {
    if (chrome.runtime.lastError) {
      showError('Failed to save settings: ' + chrome.runtime.lastError.message);
    } else {
      alert("Settings saved successfully!");
      chrome.runtime.sendMessage({ type: "settingsUpdated" }); // notify change
    }
  });
});

document.getElementById("advancedToggle").addEventListener("click", (event) => {
  const content = document.getElementById("advancedContent");
  event.currentTarget.classList.toggle("collapsed");
  content.classList.toggle("collapsed");
});

chrome.storage.sync.get(["advancedSettingsOpen"], ({ advancedSettingsOpen }) => {
  if (advancedSettingsOpen) {
    document.getElementById("advancedToggle").classList.remove("collapsed");
    document.getElementById("advancedContent").classList.remove("collapsed");
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'showError') showError(request.error);
});

let isRecording = false;
let recordedKeys = [];
const recordBtn = document.getElementById("recordShortcut");
const customInput = document.getElementById("customShortcutInput");

function keyHandler(e) {
    e.preventDefault();
    if (e.key === "Enter") { finishRecording(); return; }
    recordedKeys.push(e.key);
    customInput.value = recordedKeys.join(" + ");
}

function finishRecording() {
    document.removeEventListener("keydown", keyHandler);
    recordBtn.textContent = "Record Shortcut";
    customInput.placeholder = "Recording complete";
    chrome.storage.sync.set({ customShortcut: recordedKeys.join(",") });
    isRecording = false;
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

for (const radio of document.getElementsByName("shortcutMode")) {
  radio.addEventListener("change", (e) => {
    document.getElementById("customShortcutLabel").style.display = e.target.value === "custom" ? "block" : "none";
  });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { hasOpenedPopup } = await chrome.storage.sync.get('hasOpenedPopup');
    if (!hasOpenedPopup) {
        chrome.storage.sync.set({ hasOpenedPopup: true });
        chrome.tabs.create({ url: "https://github.com/adamtash/typollama" });
    }
});