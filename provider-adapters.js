import { PROVIDER_CONFIGS } from "./constants.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

export function resolveEndpoint(providerId, providerSettings = {}, apiKey = "") {
  const provider = PROVIDER_CONFIGS[providerId];
  if (!provider) throw new Error("Choose a supported provider.");

  if (provider.apiType === "gemini") {
    const model = providerSettings.model || provider.defaultModel;
    return `${provider.endpoint}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  }
  if (providerId === "ollama") return `${cleanBaseUrl(providerSettings.baseUrl || provider.defaultBaseUrl)}/api/chat`;
  if (providerId === "lmstudio") return `${cleanBaseUrl(providerSettings.baseUrl || provider.defaultBaseUrl)}/v1/chat/completions`;
  if (providerId === "compatible") return `${cleanBaseUrl(providerSettings.baseUrl || provider.defaultBaseUrl)}/chat/completions`;
  return provider.endpoint;
}

export function validateProvider(providerId, providerSettings = {}, apiKey = "") {
  const provider = PROVIDER_CONFIGS[providerId];
  if (!provider) throw new Error("Choose a supported provider.");
  if (provider.keyName && providerId !== "compatible" && !apiKey.trim()) throw new Error(`${provider.label} needs an API key.`);
  if (provider.defaultBaseUrl) {
    const baseUrl = cleanBaseUrl(providerSettings.baseUrl || provider.defaultBaseUrl);
    try {
      const url = new URL(baseUrl);
      if (!/^https?:$/.test(url.protocol)) throw new Error("URL must use HTTP or HTTPS.");
    } catch (error) {
      throw new Error(`Enter a valid ${provider.label} server URL. ${error.message}`);
    }
  }
}

export function createRequest({ providerId, providerSettings = {}, apiKey = "", prompt, text }) {
  const provider = PROVIDER_CONFIGS[providerId];
  validateProvider(providerId, providerSettings, apiKey);
  const model = providerSettings.model?.trim() || provider.defaultModel;
  const endpoint = resolveEndpoint(providerId, providerSettings, apiKey);
  const headers = { ...JSON_HEADERS };

  if (provider.apiType === "responses") {
    headers.Authorization = `Bearer ${apiKey}`;
    return { endpoint, headers, body: { model, instructions: prompt, input: text, stream: true, store: false } };
  }
  if (provider.apiType === "anthropic") {
    Object.assign(headers, {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    });
    return { endpoint, headers, body: { model, max_tokens: 1024, system: prompt, messages: [{ role: "user", content: text }], stream: true } };
  }
  if (provider.apiType === "gemini") {
    return {
      endpoint,
      headers,
      body: {
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: "user", parts: [{ text }] }]
      }
    };
  }
  if (provider.apiType === "ollama") {
    return { endpoint, headers, body: { model, stream: true, messages: [{ role: "system", content: prompt }, { role: "user", content: text }] } };
  }
  if (provider.apiType === "cohere") {
    headers.Authorization = `Bearer ${apiKey}`;
    return { endpoint, headers, body: { model, stream: true, messages: [{ role: "system", content: prompt }, { role: "user", content: text }] } };
  }
  if (provider.apiType === "chat") {
    if (provider.keyName && apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (providerId === "openrouter") headers["X-OpenRouter-Title"] = "Typollama";
    return { endpoint, headers, body: { model, stream: true, messages: [{ role: "system", content: prompt }, { role: "user", content: text }] } };
  }
  throw new Error(`${provider.label} is not a remote API provider.`);
}

function getTextFromPayload(providerType, payload) {
  if (providerType === "responses") return payload?.type === "response.output_text.delta" ? payload.delta : "";
  if (providerType === "anthropic") return payload?.type === "content_block_delta" ? payload.delta?.text || "" : "";
  if (providerType === "gemini") return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (providerType === "cohere") return payload?.type === "content-delta" ? payload?.delta?.message?.content?.text || payload?.delta?.message?.content?.[0]?.text || "" : "";
  return payload?.choices?.[0]?.delta?.content || "";
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "";
  const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
  return { event, data };
}

export async function* streamText(response, providerType) {
  if (!response.body) throw new Error("The provider returned no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitSse = function* (block) {
    const { data } = parseSseBlock(block);
    if (!data || data === "[DONE]") return;
    const payload = JSON.parse(data);
    if (payload.error?.message) throw new Error(payload.error.message);
    const text = getTextFromPayload(providerType, payload);
    if (text) yield text;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    if (providerType === "ollama") {
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const payload = JSON.parse(line);
        if (payload.error) throw new Error(payload.error);
        if (payload.message?.content) yield payload.message.content;
      }
    } else {
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) yield* emitSse(block);
    }
    if (done) break;
  }

  if (buffer.trim()) {
    if (providerType === "ollama") {
      const payload = JSON.parse(buffer);
      if (payload.message?.content) yield payload.message.content;
    } else {
      yield* emitSse(buffer);
    }
  }
}

export async function responseError(response) {
  const body = await response.text();
  let message = body;
  try { message = JSON.parse(body)?.error?.message || body; } catch { /* use text */ }
  return `${response.status} ${response.statusText}: ${String(message).slice(0, 500)}`;
}
