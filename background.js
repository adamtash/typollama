import { DEFAULT_LMSTUDIO_MODEL, DEFAULT_LMSTUDIO_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_OPENAI_MODEL, DEFAULT_SYSTEM_PROMPT } from './constants.js';

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.tabs.create({ url: "https://github.com/adamtash/typollama" });
    }
    chrome.storage.sync.get(["openAiModelName", "ollamaModelName", "lmstudioModelName", "lmstudioUrl"], (items) => {
        const changes = {};
        if (!items.openAiModelName) changes.openAiModelName = DEFAULT_OPENAI_MODEL;
        if (!items.ollamaModelName) changes.ollamaModelName = DEFAULT_OLLAMA_MODEL;
        if (!items.lmstudioModelName) changes.lmstudioModelName = DEFAULT_LMSTUDIO_MODEL;
        if (!items.lmstudioUrl) changes.lmstudioUrl = DEFAULT_LMSTUDIO_URL;
        if (Object.keys(changes).length) {
            chrome.storage.sync.set(changes);
        }
    });
});

class StreamHandler {
    constructor(decoder = new TextDecoder()) {
        this.decoder = decoder;
        this.buffer = '';
    }

    processChunk(value, provider, callback) {
        this.buffer += this.decoder.decode(value, { stream: true });
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const content = this.parseLine(line, provider);
                if (content) callback({ chunk: content, done: false });
            } catch (e) {
                console.error('Parse error:', e);
            }
        }
    }

    parseLine(line, provider) {
        if ((provider === "openai" || provider === "lmstudio") && line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return null;
            return JSON.parse(data)?.choices?.[0]?.delta?.content || null;
        }
        return JSON.parse(line)?.message?.content || null;
    }

    async *generateChunks(reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
        }
    }
}

class ApiConfigManager {
    constructor(config) {
        this.config = config;
    }

    validate() {
        if (this.config.provider === "openai" && !this.config.openAiKey) {
            throw new Error("OpenAI API key is required");
        }
    }

    getApiConfig() {
        const { provider, ollamaUrl, openAiKey, openAiModelName, ollamaModelName, lmstudioModelName } = this.config;
        const chosenModel = provider === "openai"
          ? (openAiModelName || DEFAULT_OPENAI_MODEL)
          : provider === "lmstudio"
              ? (lmstudioModelName || DEFAULT_LMSTUDIO_MODEL)
              : (ollamaModelName || DEFAULT_OLLAMA_MODEL);
        const apiUrl = provider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : provider === "lmstudio"
              ? `${this.config.lmstudioUrl || DEFAULT_LMSTUDIO_URL}/v1/chat/completions`
              : ollamaUrl ? `${ollamaUrl}/api/chat` : "http://localhost:11434/api/chat";
        const headers = provider === "openai"
          ? { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` }
          : { "Content-Type": "application/json" };
        return { apiUrl, headers, chosenModel };
    }
}

async function handleRequest(text, config, responseCallback) {
    if (!text?.trim()) return responseCallback({ error: true, message: "Empty text provided" });
    
    if (config.provider === "chrome") {
        try {
            const rewriter = await ai.rewriter.create({ sharedContext: config.systemPrompt || DEFAULT_SYSTEM_PROMPT });
            const stream = await rewriter.rewriteStreaming(text);
            for await (const chunk of stream) {
                responseCallback({ chunk, done: false });
            }
            chrome.storage.local.remove('popupError');
            return responseCallback({ done: true });
        } catch (error) {
            const errorMsg = "Chrome AI Error: " + error.message;
            chrome.storage.local.set({ popupError: errorMsg });
            chrome.runtime.sendMessage({ type: "showError", error: errorMsg });
            return responseCallback({ error: true, message: errorMsg });
        }
    }

    try {
        const configManager = new ApiConfigManager(config);
        configManager.validate();
        const { apiUrl, headers, chosenModel } = configManager.getApiConfig();
        const streamHandler = new StreamHandler();
        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: chosenModel,
                stream: true,
                messages: [
                    { role: "system", content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
                    { role: "user", content: text }
                ]
            })
        });
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(`HTTP error ${response.status}: ${errorMsg}`);
        }
        const reader = response.body.getReader();
        for await (const chunk of streamHandler.generateChunks(reader)) {
            streamHandler.processChunk(chunk, config.provider, responseCallback);
        }
        if (streamHandler.buffer) responseCallback({ chunk: streamHandler.buffer, done: false });
        chrome.storage.local.remove('popupError');
        responseCallback({ done: true });
    } catch (error) {
        console.log('Request error:', error);
        let extraMessage = "";
        if (config.provider === "ollama") {
            if (error.message.includes("403")) {
                extraMessage = " - Ollama requires additional access origins. For macOS open terminal and run: launchctl setenv OLLAMA_ORIGINS "*". See: https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama";
            } else if (error.message.includes("Failed to fetch")) {
                extraMessage = " - Ollama server is unreachable or not running";
            }
        } else if (error.response) {
            extraMessage = " - Response: " + JSON.stringify(error.response);
        } else if (error.error && error.error.message) {
            extraMessage = " - " + error.error.message;
        }
        const errorMsg = error.message + extraMessage;
        // Persist even if popup is closed
        chrome.storage.local.set({ popupError: errorMsg });
        chrome.runtime.sendMessage({ type: "showError", error: errorMsg });
        responseCallback({ error: true, message: `Error: ${errorMsg}` });
    }
}

function getConfig(keys) {
    return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
}

// Message and port listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    getConfig([
       "provider", "ollamaUrl", "lmstudioUrl", "openAiKey",
       "openAiModelName", "ollamaModelName", "lmstudioModelName", "systemPrompt"
    ]).then(config => handleRequest(request.text, config, sendResponse));
    return true;
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "streamTypos") return;
    port.onMessage.addListener((request) => {
        getConfig([
           "provider", "ollamaUrl", "lmstudioUrl", "openAiKey",
           "openAiModelName", "ollamaModelName", "lmstudioModelName", "systemPrompt"
        ]).then(config => handleRequest(request.text, config, (message) => {
            try {
                port.postMessage(message);
            } catch (e) {
                console.error("Port may be disconnected:", e);
            }
            if (message.done || message.error) port.disconnect();
        }));
    });
});