export const EXTENSION_NAME = "Typollama";

export const PROMPT_TYPES = ["spellcheck", "proofread", "custom"];

export const DEFAULT_PROMPTS = Object.freeze({
  spellcheck: "Correct spelling and punctuation only. Preserve the original wording, language, formatting, and meaning. Return only the corrected text.",
  proofread: "Rewrite the text to improve grammar, clarity, flow, and tone while preserving its meaning and language. Return only the revised text.",
  custom: "Improve the following text. Return only the revised text."
});

export const DEFAULT_SHORTCUTS = Object.freeze({
  spellcheck: "double_stroke",
  proofread: "triple_stroke",
  custom: "quadruple_stroke"
});

export const PROVIDER_CONFIGS = Object.freeze({
  openai: {
    label: "OpenAI",
    group: "Direct APIs",
    apiType: "responses",
    endpoint: "https://api.openai.com/v1/responses",
    defaultModel: "gpt-5-mini",
    keyName: "openAiKey",
    docsUrl: "https://platform.openai.com/docs/api-reference/responses"
  },
  anthropic: {
    label: "Anthropic",
    group: "Direct APIs",
    apiType: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    keyName: "anthropicKey",
    docsUrl: "https://docs.anthropic.com/en/api/messages"
  },
  gemini: {
    label: "Google Gemini",
    group: "Direct APIs",
    apiType: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.5-flash",
    keyName: "geminiKey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/text-generation"
  },
  deepseek: {
    label: "DeepSeek",
    group: "Direct APIs",
    apiType: "chat",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-v4-flash",
    keyName: "deepseekKey",
    docsUrl: "https://api-docs.deepseek.com/"
  },
  mistral: {
    label: "Mistral AI",
    group: "Direct APIs",
    apiType: "chat",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    keyName: "mistralKey",
    docsUrl: "https://docs.mistral.ai/api/endpoint/chat"
  },
  perplexity: {
    label: "Perplexity Sonar",
    group: "Direct APIs",
    apiType: "chat",
    endpoint: "https://api.perplexity.ai/chat/completions",
    defaultModel: "sonar",
    keyName: "perplexityKey",
    docsUrl: "https://docs.perplexity.ai/docs/sonar/features"
  },
  xai: {
    label: "xAI Grok",
    group: "Direct APIs",
    apiType: "chat",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4.3",
    keyName: "xaiKey",
    docsUrl: "https://docs.x.ai/developers/rest-api-reference/inference/chat"
  },
  groq: {
    label: "Groq",
    group: "OpenAI-compatible APIs",
    apiType: "chat",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    keyName: "groqKey",
    docsUrl: "https://console.groq.com/docs/api-reference"
  },
  together: {
    label: "Together AI",
    group: "OpenAI-compatible APIs",
    apiType: "chat",
    endpoint: "https://api.together.ai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-20b",
    keyName: "togetherKey",
    docsUrl: "https://docs.together.ai/docs/inference/openai-compatibility"
  },
  openrouter: {
    label: "OpenRouter",
    group: "OpenAI-compatible APIs",
    apiType: "chat",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "~openai/gpt-latest",
    keyName: "openrouterKey",
    docsUrl: "https://openrouter.ai/docs/quickstart"
  },
  cohere: {
    label: "Cohere",
    group: "Direct APIs",
    apiType: "cohere",
    endpoint: "https://api.cohere.com/v2/chat",
    defaultModel: "command-a-plus-05-2026",
    keyName: "cohereKey",
    docsUrl: "https://docs.cohere.com/v2/docs/migrating-v1-to-v2"
  },
  ollama: {
    label: "Ollama",
    group: "Local APIs",
    apiType: "ollama",
    endpoint: "http://localhost:11434/api/chat",
    defaultBaseUrl: "http://localhost:11434",
    defaultModel: "llama3.2",
    docsUrl: "https://docs.ollama.com/api"
  },
  lmstudio: {
    label: "LM Studio",
    group: "Local APIs",
    apiType: "chat",
    endpoint: "http://localhost:1234/v1/chat/completions",
    defaultBaseUrl: "http://localhost:1234",
    defaultModel: "local-model",
    docsUrl: "https://lmstudio.ai/docs/app/api/endpoints/openai"
  },
  compatible: {
    label: "OpenAI-compatible endpoint",
    group: "Local APIs",
    apiType: "chat",
    defaultBaseUrl: "http://localhost:8080/v1",
    defaultModel: "local-model",
    keyName: "compatibleKey",
    customEndpoint: true,
    docsUrl: "https://platform.openai.com/docs/api-reference/chat"
  },
  chrome: {
    label: "Chrome built-in AI (preview)",
    group: "Built-in",
    apiType: "chrome",
    defaultModel: null,
    docsUrl: "https://developer.chrome.com/docs/ai/built-in"
  }
});

export const SECRET_KEYS = Object.freeze(
  Object.values(PROVIDER_CONFIGS).flatMap(({ keyName }) => keyName ? [keyName] : [])
);

export const SETTINGS_DEFAULTS = Object.freeze({
  provider: "ollama",
  copyToClipboard: false,
  advancedSettingsOpen: false,
  ...Object.fromEntries(PROMPT_TYPES.map((type) => [`systemPrompt${type[0].toUpperCase()}${type.slice(1)}`, DEFAULT_PROMPTS[type]])),
  ...Object.fromEntries(PROMPT_TYPES.map((type) => [`shortcutMode${type[0].toUpperCase()}${type.slice(1)}`, DEFAULT_SHORTCUTS[type]])),
  ...Object.fromEntries(PROMPT_TYPES.map((type) => [`customShortcut${type[0].toUpperCase()}${type.slice(1)}`, ""]))
});

export function providerSettingsKey(provider) {
  return `provider:${provider}`;
}

export function settingKey(prefix, type) {
  return `${prefix}${type[0].toUpperCase()}${type.slice(1)}`;
}
