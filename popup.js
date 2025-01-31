chrome.storage.sync.get(["ollamaUrl"], ({ ollamaUrl }) => {
  document.getElementById("ollamaUrlInput").value = ollamaUrl || "http://localhost:11434";
});
chrome.storage.sync.get(["modelName"], ({ modelName }) => {
  document.getElementById("modelNameInput").value = modelName || "";
});

function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.textContent = message;
  errorContainer.style.display = 'block';
}

function hideError() {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.style.display = 'none';
}

document.getElementById("saveSettings").addEventListener("click", () => {
  hideError();
  const ollamaUrl = document.getElementById("ollamaUrlInput").value;
  const modelName = document.getElementById("modelNameInput").value;
  
  chrome.storage.sync.set({ ollamaUrl, modelName }, () => {
    if (chrome.runtime.lastError) {
      showError('Failed to save settings: ' + chrome.runtime.lastError.message);
    } else {
      alert("Settings saved successfully!");
    }
  });
});

// Listen for error messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'showError') {
    showError(request.error);
  }
});