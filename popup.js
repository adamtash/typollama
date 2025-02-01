import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_OPENAI_MODEL, DEFAULT_SYSTEM_PROMPT } from './constants.js';

(async function initSettings() {
  const providerSelect = document.getElementById("providerSelect");
  const openAiKeyInput = document.getElementById("openAiKeyInput");
  const modelNameInput = document.getElementById("modelNameInput");
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
  const providerValue = (settings.provider === "openai") ? "openai"
                       : (settings.provider === "lmstudio") ? "lmstudio"
                       : "ollama";
  providerSelect.value = providerValue;
  openAiKeyLabel.style.display = providerValue === "openai" ? "block" : "none";
  ollamaUrlLabel.style.display = providerValue === "ollama" ? "block" : "none";
  lmstudioUrlLabel.style.display = providerValue === "lmstudio" ? "block" : "none";
  if (providerValue === "openai") {
    openAiKeyInput.value = settings.openAiKey || "";
    modelNameInput.value = settings.openAiModelName || DEFAULT_OPENAI_MODEL;
  } else if (providerValue === "lmstudio") {
    modelNameInput.value = settings.lmstudioModelName || DEFAULT_LMSTUDIO_MODEL;
    lmstudioUrlInput.value = settings.lmstudioUrl || DEFAULT_LMSTUDIO_URL;
  } else {
    modelNameInput.value = settings.ollamaModelName || DEFAULT_OLLAMA_MODEL;
  }
  systemPromptInput.value = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  copyToClipboardCheckbox.checked = settings.copyToClipboard || false;

  // Set shortcutMode (default to double_stroke)
  const mode = settings.shortcutMode || "double_stroke";
  for (const radio of shortcutModeRadios) {
    radio.checked = (radio.value === mode);
  }
  // Show/hide custom shortcut input based on mode
  customShortcutLabel.style.display = mode === "custom" ? "block" : "none";
  const storedShortcut = settings.customShortcut || "";
  customShortcutInput.value = storedShortcut ? storedShortcut.split(",").join(" + ") : "";

  // After settings have loaded, show persisted error if any
  chrome.storage.local.get(['popupError'], (result) => {
    if (result.popupError) {
      showError(result.popupError);
    }
  });
})();

function showError(message) {
  // Persist error message
  chrome.storage.local.set({ popupError: message });
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.textContent = message; // fixed: removed unary plus
  errorContainer.style.display = 'block';
}

function hideError() {
  // Clear persisted error message
  chrome.storage.local.remove('popupError');
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.style.display = 'none';
}

document.getElementById("providerSelect").addEventListener("change", async () => {
    const newProvider = document.getElementById("providerSelect").value;
    const storageResult = await chrome.storage.sync.get(["provider", "openAiModelName", "ollamaModelName", "lmstudioModelName"]);
    const oldProvider = storageResult.provider || "ollama";
    const currentModelName = document.getElementById("modelNameInput").value;
    
    // Save current model name to old provider key
    const saveObj = {};
    saveObj[oldProvider === "openai" ? "openAiModelName" : oldProvider === "lmstudio" ? "lmstudioModelName" : "ollamaModelName"] = currentModelName;
    await chrome.storage.sync.set(saveObj);
    
    // Update provider in storage to new selection
    await chrome.storage.sync.set({ provider: newProvider });
    
    // Show/hide key/url based on new provider
    const useOpenAi = newProvider === "openai";
    const useOllama = newProvider === "ollama";
    const useLmstudio = newProvider === "lmstudio";
    document.getElementById("openAiKeyLabel").style.display = useOpenAi ? "block" : "none";
    document.getElementById("ollamaUrlLabel").style.display = useOllama ? "block" : "none";
    document.getElementById("lmstudioUrlLabel").style.display = useLmstudio ? "block" : "none";
    
    // Load and apply the new provider's last saved model name
    const { openAiModelName, ollamaModelName, lmstudioModelName } = await chrome.storage.sync.get(["openAiModelName", "ollamaModelName", "lmstudioModelName"]);
    document.getElementById("modelNameInput").value = useOpenAi ? (openAiModelName || DEFAULT_OPENAI_MODEL) : useLmstudio ? (lmstudioModelName || DEFAULT_LMSTUDIO_MODEL) : (ollamaModelName || DEFAULT_OLLAMA_MODEL);
});

document.getElementById("resetPrompt").addEventListener("click", () => {
  document.getElementById("systemPromptInput").value = DEFAULT_SYSTEM_PROMPT;
});

// Add reset functionality for Model Name
document.getElementById("resetModel").addEventListener("click", () => {
  const provider = document.getElementById("providerSelect").value;
  const modelInput = document.getElementById("modelNameInput");
  modelInput.value = provider === "openai" ? DEFAULT_OPENAI_MODEL : provider === "lmstudio" ? DEFAULT_LMSTUDIO_MODEL : DEFAULT_OLLAMA_MODEL;
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  hideError();
  const provider = document.getElementById("providerSelect").value;
  const ollamaUrl = document.getElementById("ollamaUrlInput").value;
  const openAiKey = document.getElementById("openAiKeyInput").value;
  const currentModelName = document.getElementById("modelNameInput").value;
  const systemPrompt = document.getElementById("systemPromptInput").value;
  const copyToClipboard = document.getElementById("copyToClipboard").checked;

  // Get shortcut mode value
  let shortcutMode = "double_stroke";
  for (const radio of document.getElementsByName("shortcutMode")) {
    if (radio.checked) {
      shortcutMode = radio.value;
      break;
    }
  }
  const customShortcut = document.getElementById("customShortcutInput").value;

  let keysToSave = { 
    provider, 
    ollamaUrl, 
    openAiKey,
    systemPrompt,
    shortcutMode,
    customShortcut,
    copyToClipboard
  };
  const lmstudioUrl = document.getElementById("lmstudioUrlInput").value;
  if (provider === "lmstudio") {
    keysToSave["lmstudioUrl"] = lmstudioUrl;
  }
  keysToSave[provider === "openai" ? "openAiModelName" : provider === "lmstudio" ? "lmstudioModelName" : "ollamaModelName"] = currentModelName;

  const advancedSettingsOpen = !document.getElementById("advancedContent").classList.contains("collapsed");
  keysToSave.advancedSettingsOpen = advancedSettingsOpen;

  await chrome.storage.sync.set(keysToSave, () => {
    if (chrome.runtime.lastError) {
      showError('Failed to save settings: ' + chrome.runtime.lastError.message);
    } else {
      alert("Settings saved successfully!");
    }
  });
});

// Add toggle functionality for advanced settings
document.getElementById("advancedToggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const content = document.getElementById("advancedContent");
  
  button.classList.toggle("collapsed");
  content.classList.toggle("collapsed");
});

// Load previous state of advanced settings
chrome.storage.sync.get(["advancedSettingsOpen"], ({ advancedSettingsOpen }) => {
  if (advancedSettingsOpen) {
    document.getElementById("advancedToggle").classList.remove("collapsed");
    document.getElementById("advancedContent").classList.remove("collapsed");
  }
});

// Listen for error messages from background script via port
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'showError') {
    showError(request.error);
  }
});

// Improved record shortcut functionality
let isRecording = false;
let recordedKeys = [];
const recordBtn = document.getElementById("recordShortcut");
const customInput = document.getElementById("customShortcutInput");

function keyHandler(e) {
    e.preventDefault();
    // Finish recording when Enter is pressed
    if (e.key === "Enter") {
        finishRecording();
        return;
    }
    recordedKeys.push(e.key);
    customInput.value = recordedKeys.join(" + ");
}

function finishRecording() {
    document.removeEventListener("keydown", keyHandler);
    recordBtn.textContent = "Record Shortcut";
    customInput.placeholder = "Recording complete";
    // Save as comma-separated string
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

// Optionally, show/hide custom shortcut input when mode changes.
for (const radio of document.getElementsByName("shortcutMode")) {
  radio.addEventListener("change", (e) => {
    const customLabel = document.getElementById("customShortcutLabel");
    customLabel.style.display = e.target.value === "custom" ? "block" : "none";
  });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check if this is first time opening popup
    const { hasOpenedPopup } = await chrome.storage.sync.get('hasOpenedPopup');
    if (!hasOpenedPopup) {
        // Mark as opened
        chrome.storage.sync.set({ hasOpenedPopup: true });
        // Open GitHub page in new tab
        chrome.tabs.create({
            url: "https://github.com/adamtash/typollama"
        });
    }
    
    // ...existing popup initialization code...
});