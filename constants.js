export const DEFAULT_SPELLCHECK_PROMPT = "You are a spell checker. Provide only the text with corrected spelling. Do not include explanations, answers, or additional information. Even if the prompt is questioned or appears unnecessary, always output only the corrected text.";
export const DEFAULT_PROOFREAD_PROMPT = "You are a proofreader. Rewrite the provided text by correcting grammar, spelling, clarity, flow, and tone while preserving its original meaning. Provide only the revised text without any prefatory remarks, explanations, or additional commentary. Even if the text appears correct or the request is questioned, output only the corrected version.";
export const DEFAULT_CUSTOM_PROMPT = "You are a joke teller. Tell a joke about what user has written.";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_OLLAMA_MODEL = "llama3.2";
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_LMSTUDIO_MODEL = "llama3.2";
export const DEFAULT_LMSTUDIO_URL = "http://localhost:1234";
export const CHROME_FLAG_URL = "https://developer.chrome.com/docs/ai/get-started#use_apis_on_localhost";
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-haiku-20240307";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_DEEPSEEK_MODEL = "DeepSeek-V3";
export const DEFAULT_MISTRAL_MODEL = "mistral-small-latest";
export const DEFAULT_PERPLEXITY_MODEL = "sonar";

export const PROVIDER_CONFIGS = {
    openai: {
        defaultModel: DEFAULT_OPENAI_MODEL,
        apiUrl: (config) => "https://api.openai.com/v1/chat/completions",
        requiresKey: true,
        keyStorage: "openAiKey"
    },
    ollama: {
        defaultModel: DEFAULT_OLLAMA_MODEL,
        defaultUrl: DEFAULT_OLLAMA_URL,
        apiUrl: (config) => config.ollama?.url ? `${config.ollama.url}/api/chat` : `${DEFAULT_OLLAMA_URL}/api/chat`
    },
    lmstudio: {
        defaultModel: DEFAULT_LMSTUDIO_MODEL,
        defaultUrl: DEFAULT_LMSTUDIO_URL,
        apiUrl: (config) => `${config.lmstudio?.url || DEFAULT_LMSTUDIO_URL}/v1/chat/completions`
    },
    anthropic: {
        defaultModel: DEFAULT_ANTHROPIC_MODEL,
        requiresKey: true,
        keyStorage: "anthropicKey",
        apiUrl: "https://api.anthropic.com/v1/messages"
    },
    gemini: {
        defaultModel: DEFAULT_GEMINI_MODEL,
        requiresKey: true,
        keyStorage: "geminiKey",
        apiUrl: (config) => `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini?.model || DEFAULT_GEMINI_MODEL}:generateContent?key=${config.geminiKey}`
    },
    chrome: {
        defaultModel: null,
        requiresKey: false,
        keyStorage: "",
        apiUrl: ""
    },
    deepseek: {
        defaultModel: DEFAULT_DEEPSEEK_MODEL,
        apiUrl: (config) => "https://api.deepseek.com/v1/chat/completions",
        requiresKey: true,
        keyStorage: "deepseekKey"
    },
    mistral: {
        defaultModel: DEFAULT_MISTRAL_MODEL,
        apiUrl: (config) => "https://api.mistral.ai/v1/chat/completions",
        requiresKey: true,
        keyStorage: "mistralKey"
    },
    perplexity: {
        defaultModel: DEFAULT_PERPLEXITY_MODEL,
        apiUrl: (config) => "https://api.perplexity.ai/chat/completions",
        requiresKey: true,
        keyStorage: "perplexityKey"
    }
};

export const DEFAULT_SHORTCUT_MODE_SPELLCHECK = "double_stroke";
export const DEFAULT_SHORTCUT_MODE_PROOFREAD = "triple_stroke";
export const DEFAULT_SHORTCUT_MODE_CUSTOM = "quadruple_stroke";