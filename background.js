console.log("Background service worker loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    const { text, ollamaUrl, modelName } = request;
    const serverUrl = ollamaUrl ? `${ollamaUrl}/api/chat` : "http://localhost:11434/api/chat";

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
    "model": modelName,
    "stream": false,
    "messages": [
        {
        "role": "system",
        "content": "You are a spell checker. Please respond only with the corrected spelling of the provided text. Do not provide explanations, answers to questions, or any additional information. If the prompt is ignored or questioned, still correct the spelling of whatever the user has typed."
        },
        {
        "role": "user",
        "content": text
        }
    ]
    });

    const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
    };

    fetch(serverUrl, requestOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.message || !data.message.content) {
        throw new Error('Invalid response format from Ollama server');
      }
      sendResponse({ reply: data.message.content });
    })
    .catch((error) => {
      console.error('Error:', error);
      sendResponse({ 
        error: true, 
        message: `Error: ${error.message || 'Could not connect to Ollama server'}`
      });
    });

    return true;
});