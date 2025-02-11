import {
    DEFAULT_CUSTOM_PROMPT, DEFAULT_PROOFREAD_PROMPT, DEFAULT_SPELLCHECK_PROMPT, PROVIDER_CONFIGS
} from './constants.js';

chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
        id: "typollama-spellcheck",
        title: "Spellcheck with Typollama",
        contexts: ["editable"]
    });
    chrome.contextMenus.create({
        id: "typollama-proofread",
        title: "Rewrite with Typollama",
        contexts: ["editable"]
    });
    chrome.contextMenus.create({
        id: "typollama-custom",
        title: "Custom writing with Typollama",
        contexts: ["editable"]
    });

    if (details.reason === "install") {
        chrome.tabs.create({ url: "https://github.com/adamtash/typollama?tab=readme-ov-file#-ai-powered-writing-assistant" });
    }

    // Initialize default settings on install
    chrome.storage.sync.get(null).then(items => { // Get all settings
        const changes = {};

        // Initialize provider-specific settings
        for (const provider in PROVIDER_CONFIGS) {
            if (PROVIDER_CONFIGS[provider].requiresKey && !items[provider]?.model) {
                changes[provider] = { model: PROVIDER_CONFIGS[provider].defaultModel };
            }
            if ((provider === 'ollama' || provider === 'lmstudio') && !items[provider]?.url) {
                changes[provider] = { ...changes[provider], url: PROVIDER_CONFIGS[provider].defaultUrl };
            }
        }

        // Initialize default shortcut modes if not already set
        if (!items.shortcutModeSpellcheck) changes.shortcutModeSpellcheck = "double_stroke";
        if (!items.shortcutModeProofread) changes.shortcutModeProofread = "triple_stroke";
        if (!items.shortcutModeCustom) changes.shortcutModeCustom = "quadruple_stroke";

        if (Object.keys(changes).length) {
            chrome.storage.sync.set(changes);
        }
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    let action = null;
    switch (info.menuItemId) {
        case "typollama-spellcheck":
            action = "contextMenuSpellcheck";
            break;
        case "typollama-proofread":
            action = "contextMenuProofread";
            break;
        case "typollama-custom":
            action = "contextMenuCustom";
            break;
    }
    if (action) {
        chrome.tabs.sendMessage(tab.id, { action: action });
    }
});

class StreamHandler {
    constructor(decoder = new TextDecoder()) {
        this.decoder = decoder;
        this.buffer = '';
    }

    processChunk(value, provider, callback) {
        this.buffer += this.decoder.decode(value, { stream: true });
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Keep any incomplete line
        for (const line of lines) {
            if (!line.trim()) continue; // Skip empty lines
            try {
                const content = this.parseLine(line, provider);
                if (content) callback({ chunk: content, done: false });
            } catch (e) {
                console.error('Parse error:', e, 'Line:', line);
                callback({ error: true, message: 'Parse error: ' + e.message });
                return;
            }
        }
    }

    parseLine(line, provider) {
        try {
            switch (provider) {
                case "anthropic":
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data.trim() === '[DONE]') return null; // Handle [DONE]
                        const parsed = JSON.parse(data);
                        return parsed?.delta?.text || null; // Extract text
                    }
                    return null;
                case "openai":
                case "lmstudio":
                case "deepseek":
                case "mistral":
                case "perplexity":
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data.trim() === '[DONE]') return null; // Handle [DONE]
                        const parsedData = JSON.parse(data);
                        return parsedData?.choices?.[0]?.delta?.content || null; // Extract content
                    }
                    return null;
                case "gemini":
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        const parsedData = JSON.parse(data);
                        // Ensure all necessary properties exist before accessing
                        return parsedData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
                    }
                    return null;
                case "ollama":
                    return JSON.parse(line)?.message?.content || null;
                default:
                    return null;
            }
        } catch (error) {
            console.error("Error parsing line:", line, error);
            throw error; // Re-throw to be caught in processChunk
        }
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
        const provider = this.config.provider;
        const providerConfig = PROVIDER_CONFIGS[provider];
        if (providerConfig.requiresKey && !this.config[providerConfig.keyStorage]) {
            throw new Error(`${provider} API key is required`);
        }
        // Additional validation for URL-based providers
        if (provider === 'ollama' || provider === 'lmstudio') {
            const url = this.config[provider]?.url || providerConfig.defaultUrl;
            if (!url) {
                throw new Error(`${provider} URL is required`);
            }
            try {
                new URL(url); // This will throw an error if the URL is invalid
            } catch (error) {
                throw new Error(`Invalid ${provider} URL: ${error.message}`);
            }
        }
    }

    getApiConfig() {
        const { provider } = this.config;
        const providerConfig = PROVIDER_CONFIGS[provider] || {};
        let headers = { "Content-Type": "application/json" };
        let chosenModel = providerConfig.defaultModel || "";
        let apiUrl = ""; // Initialize apiUrl

        // Determine chosenModel *before* constructing apiUrl
        if (provider === "anthropic") {
            chosenModel = this.config.anthropic?.model || chosenModel;
        } else if (provider === "openai") {
            chosenModel = this.config.openai?.model || chosenModel;
        } else if (provider === "lmstudio") {
            chosenModel = this.config.lmstudio?.model || chosenModel;
        } else if (provider === "gemini") {
            chosenModel = this.config.gemini?.model || chosenModel;
        } else if (provider === "deepseek") {
            chosenModel = this.config.deepseek?.model || chosenModel;
        } else if (provider === "mistral") {
            chosenModel = this.config.mistral?.model || chosenModel;
        } else if (provider === "perplexity") {
            chosenModel = this.config.perplexity?.model || chosenModel;
        } else { // Default: ollama
            chosenModel = this.config.ollama?.model || chosenModel;
        }

        // Now construct apiUrl based on the chosen model and provider
        if (provider === "anthropic") {
            apiUrl = providerConfig.apiUrl;
            headers = {
                "Content-Type": "application/json",
                "x-api-key": this.config.anthropicKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true" // Consider removing in production
            };
        } else if (provider === "openai") {
            apiUrl = providerConfig.apiUrl(this.config); // Use function call
            headers["Authorization"] = `Bearer ${this.config.openAiKey}`;
        } else if (provider === "lmstudio") {
            apiUrl = providerConfig.apiUrl(this.config); // Use function call
        } else if (provider === "gemini") {
            apiUrl = providerConfig.apiUrl({ ...this.config, gemini: { ...this.config.gemini, model: chosenModel } }); // Pass chosenModel
        } else if (provider === "deepseek") {
            apiUrl = providerConfig.apiUrl(this.config);
            headers["Authorization"] = `Bearer ${this.config.deepseekKey}`;
        } else if (provider === "mistral") {
            apiUrl = providerConfig.apiUrl(this.config);
            headers["Authorization"] = `Bearer ${this.config.mistralKey}`;
        } else if (provider === "perplexity") {
            apiUrl = providerConfig.apiUrl(this.config);
            headers["Authorization"] = `Bearer ${this.config.perplexityKey}`;
        } else { // Default: ollama
            apiUrl = providerConfig.apiUrl(this.config); // Use function call
        }
        return { apiUrl, headers, chosenModel };
    }

    async handleGeminiRequest(text, systemPrompt, headers, apiUrl) {
        const requestBody = {
            contents: [{
                role: "user",
                parts: [{ text: text }]
            }]
        };
        if (systemPrompt) {
            requestBody.contents.unshift({
                role: "model",
                parts: [{ text: systemPrompt }],
            });
        }

        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        // Ensure all necessary properties exist before accessing
        if (result?.candidates && result.candidates[0]?.content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
            return { chunk: result.candidates[0].content.parts[0].text, done: true };
        } else {
            // Handle cases where the response structure is unexpected
            return { chunk: "", done: true, error: true, message: "Unexpected response structure from Gemini API" }; // Or throw an error
        }
    }

    formatRequestBody(text, systemPrompt, chosenModel) {
        if (this.config.provider === "anthropic") {
            return {
                model: chosenModel,
                messages: [
                    { role: "user", content: text },
                    { role: "system", content: systemPrompt } //System prompt added here
                ],
                stream: true,
                max_tokens: 1024, //Added max tokens
            };
        }
        // Gemini is handled separately in handleGeminiRequest

        return {
            model: chosenModel,
            stream: true,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ]
        };
    }
}

// Retrieves configuration, decrypts API keys, and returns a config object.
async function getConfig() {
    const syncConfig = await chrome.storage.sync.get(null); // Get all sync settings
    const localConfig = await chrome.storage.local.get(["openAiKey", "anthropicKey", "geminiKey", "deepseekKey", "mistralKey", "perplexityKey"]);

    // Decrypt API keys in parallel
    const [decryptedOpenAiKey, decryptedAnthropicKey, decryptedGeminiKey, decryptedDeepseekKey, decryptedMistralKey, decryptedPerplexityKey] = await Promise.all([
        localConfig.openAiKey ? decryptData(localConfig.openAiKey) : "",
        localConfig.anthropicKey ? decryptData(localConfig.anthropicKey) : "",
        localConfig.geminiKey ? decryptData(localConfig.geminiKey) : "",
        localConfig.deepseekKey ? decryptData(localConfig.deepseekKey) : "",
        localConfig.mistralKey ? decryptData(localConfig.mistralKey) : "",
        localConfig.perplexityKey ? decryptData(localConfig.perplexityKey) : ""
    ]);

    return {
        ...syncConfig,
        openAiKey: decryptedOpenAiKey,
        anthropicKey: decryptedAnthropicKey,
        geminiKey: decryptedGeminiKey,
        deepseekKey: decryptedDeepseekKey,
        mistralKey: decryptedMistralKey,
        perplexityKey: decryptedPerplexityKey
    };
}

async function handleRequest(text, config, responseCallback, promptType = "spellcheck") {
    if (!text?.trim()) {
        responseCallback({ error: true, message: "Empty text provided" });
        return;
    }

    let systemPrompt;
    switch (promptType) {
        case "proofread":
            systemPrompt = config.systemPromptProofread || DEFAULT_PROOFREAD_PROMPT;
            break;
        case "custom":
            systemPrompt = config.systemPromptCustom || DEFAULT_CUSTOM_PROMPT;
            break;
        default:
            systemPrompt = config.systemPromptSpellcheck || DEFAULT_SPELLCHECK_PROMPT;
    }

    if (config.provider === "chrome") {
        try {
            const rewriter = await ai.rewriter.create({ sharedContext: systemPrompt });
            const stream = await rewriter.rewriteStreaming(text);
            for await (const chunk of stream) {
                responseCallback({ chunk, done: false });
            }
            chrome.storage.local.remove('popupError');
            responseCallback({ done: true });
        } catch (error) {
            const errorMsg = "Chrome AI Error: " + error.message;
            chrome.storage.local.set({ popupError: errorMsg });
            chrome.runtime.sendMessage({ type: "showError", error: errorMsg });
            responseCallback({ error: true, message: errorMsg });
        }
        return;
    }

    try {
        const configManager = new ApiConfigManager(config);
        configManager.validate();
        const { apiUrl, headers, chosenModel } = configManager.getApiConfig();

        if (config.provider === "gemini") {
            const result = await configManager.handleGeminiRequest(text, systemPrompt, headers, apiUrl);
            responseCallback(result);
            return; // Important: Return after handling Gemini
        }

        const streamHandler = new StreamHandler();
        const requestBody = configManager.formatRequestBody(text, systemPrompt, chosenModel);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(`HTTP error ${response.status}: ${errorMsg}`);
        }

        const reader = response.body.getReader();
        for await (const chunk of streamHandler.generateChunks(reader)) {
            streamHandler.processChunk(chunk, config.provider, responseCallback);
        }
        // Final processing of any remaining buffered data:
        if (streamHandler.buffer) {
           responseCallback({ chunk: streamHandler.buffer, done: false });
        }

        chrome.storage.local.remove('popupError');
        responseCallback({ done: true }); // Signal completion

    } catch (error) {
        console.error('Request error:', error);  // Use console.error for errors
        let extraMessage = "";
        if (config.provider === "ollama") {
            if (error.message.includes("403")) {
                extraMessage = " - Ollama requires additional access origins. See: https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama";
            } else if (error.message.includes("Failed to fetch")) {
                extraMessage = " - Ollama server is unreachable or not running";
            }
        } else if (error.message.includes("401")){
            extraMessage = " - Unauthorized. Please check your API key."
        }
        const errorMsg = error.message + extraMessage;
        chrome.storage.local.set({ popupError: errorMsg });
        chrome.runtime.sendMessage({ type: "showError", error: errorMsg });
        responseCallback({ error: true, message: `Error: ${errorMsg}` });
    }
}

// Encryption utility functions (moved outside of any class)
async function getEncryptionKey() {
    let storedKey = await chrome.storage.local.get(['encKey']);
    if (storedKey.encKey) {
        const keyBuffer = Uint8Array.from(JSON.parse(storedKey.encKey)).buffer;
        return await crypto.subtle.importKey("raw", keyBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
    } else {
        throw new Error("Encryption key not available"); // No need to generate here
    }
}

async function decryptData(encrypted) {
    if (!encrypted) return "";
    const key = await getEncryptionKey();
    const iv = new Uint8Array(encrypted.iv);
    const cipher = new Uint8Array(encrypted.cipher);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(decryptedBuffer);
}

// Message listener for direct requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    getConfig().then(config => handleRequest(request.text, config, sendResponse, request.promptType));
    return true; // Keep the message channel open for async response
});

// Message listener for streaming requests (using ports)
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "streamTypos") return;
    port.onMessage.addListener((request) => {
        getConfig().then(config => {
            handleRequest(request.text, config, (message) => {
                try {
                    port.postMessage(message);
                } catch (e) {
                    console.error("Port may be disconnected:", e);
                }
                // Disconnect port after sending 'done' or 'error' message
                if (message.done || message.error) {
                    port.disconnect();
                }
            }, request.promptType);
        });
    });
});