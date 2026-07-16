import assert from "node:assert/strict";
import test from "node:test";
import { createRequest, resolveEndpoint, streamText } from "../provider-adapters.js";

test("uses the OpenAI Responses API with private responses", () => {
  const request = createRequest({ providerId: "openai", apiKey: "test-key", prompt: "Fix text", text: "teh" });
  assert.equal(request.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.deepEqual(request.body, { model: "gpt-5-mini", instructions: "Fix text", input: "teh", stream: true, store: false });
});

test("formats Anthropic system instructions and messages correctly", () => {
  const request = createRequest({ providerId: "anthropic", apiKey: "test-key", prompt: "Fix text", text: "teh" });
  assert.equal(request.body.system, "Fix text");
  assert.deepEqual(request.body.messages, [{ role: "user", content: "teh" }]);
  assert.equal(request.body.max_tokens, 1024);
});

test("formats Gemini system instructions and streaming endpoint correctly", () => {
  const request = createRequest({ providerId: "gemini", apiKey: "test key", prompt: "Fix text", text: "teh" });
  assert.match(request.endpoint, /gemini-2.5-flash:streamGenerateContent\?alt=sse&key=test%20key$/);
  assert.equal(request.body.systemInstruction.parts[0].text, "Fix text");
  assert.equal(request.body.contents[0].role, "user");
});

test("resolves local and custom OpenAI-compatible endpoints", () => {
  assert.equal(resolveEndpoint("ollama", { baseUrl: "http://localhost:11434/" }), "http://localhost:11434/api/chat");
  assert.equal(resolveEndpoint("lmstudio", { baseUrl: "http://127.0.0.1:1234" }), "http://127.0.0.1:1234/v1/chat/completions");
  assert.equal(resolveEndpoint("compatible", { baseUrl: "https://example.test/v1/" }), "https://example.test/v1/chat/completions");
});

async function collect(response, type) {
  let text = "";
  for await (const chunk of streamText(response, type)) text += chunk;
  return text;
}

test("parses current OpenAI Responses stream events", async () => {
  const response = new Response('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: [DONE]\n\n');
  assert.equal(await collect(response, "responses"), "Hello");
});

test("parses Anthropic, chat-compatible, Gemini, Cohere, and Ollama output", async () => {
  assert.equal(await collect(new Response('data: {"type":"content_block_delta","delta":{"text":"A"}}\n\n'), "anthropic"), "A");
  assert.equal(await collect(new Response('data: {"choices":[{"delta":{"content":"B"}}]}\n\n'), "chat"), "B");
  assert.equal(await collect(new Response('data: {"candidates":[{"content":{"parts":[{"text":"C"}]}}]}\n\n'), "gemini"), "C");
  assert.equal(await collect(new Response('data: {"type":"content-delta","delta":{"message":{"content":{"text":"D"}}}}\n\n'), "cohere"), "D");
  assert.equal(await collect(new Response('{"message":{"content":"E"}}\n'), "ollama"), "E");
});
