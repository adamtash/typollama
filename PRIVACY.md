# Typollama Privacy Policy

Last updated: July 16, 2026

Typollama is a browser-based writing assistant. This policy explains what data the extension handles, why it handles it, where it goes, and the choices you have.

## Data Typollama handles

Typollama handles only the data needed to provide a writing action that you start:

- **Selected or active-editor text**: the text you select or the text in the focused editable field when you invoke a Typollama tool.
- **Writing instruction and settings**: your chosen tool, custom instruction, shortcut preferences, selected provider, model name, and configured local or compatible endpoint.
- **Provider credentials**: API keys that you enter for a provider.

Typollama does not collect browsing history, build profiles, run analytics, use advertising identifiers, or operate a Typollama server that receives your text.

## How and when data is used

Text is processed only after you actively use a context-menu command or shortcut. Typollama sends the text and applicable instruction only to the provider you selected for that request:

- **Hosted provider**: the text is transmitted to that provider over HTTPS under that provider's terms and privacy policy.
- **Ollama or LM Studio**: the text is sent to the local server URL that you configure, commonly on your own computer.
- **Chrome built-in AI**: the text is passed to Chrome's built-in AI API when that preview feature is available and selected.

Typollama does not sell, rent, use for advertising, or share this data with any other party. It does not retain processed text after the active request completes. Your selected provider may retain or use request data according to its own policies; review those policies before choosing a hosted provider.

## Storage and security

- Non-secret preferences are stored with Chrome Sync so they may follow the signed-in Chrome profile.
- API keys are stored only in the extension's trusted local storage. Typollama encrypts them with AES-GCM before writing them to storage.
- The extension limits local storage access to trusted extension contexts when Chrome supports that control.
- Network requests to hosted providers use HTTPS. Local providers may use the local HTTP address that you explicitly configure.

No security method can make a third-party AI provider private by itself. Do not submit confidential text unless you have determined that your chosen provider and plan are suitable for it.

## Your choices and controls

You choose the provider, model, endpoint, writing instructions, and shortcuts. You can enable clipboard-only results to avoid in-place replacement. You can clear a saved API key from the Typollama popup and remove all extension data through Chrome's extension settings.

## Third parties

When you select a hosted provider, Typollama transmits request text to that provider. Supported choices include OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral AI, Perplexity, xAI, Cohere, Groq, Together AI, OpenRouter, and any compatible endpoint you configure. Typollama does not control those services; their terms and privacy policies apply to their handling of your request.

## Changes and contact

We may update this policy when the extension's data practices change. The current version is published in this repository. For privacy questions, contact adem@adamtash.com.

Typollama's handling of user data is limited to the disclosed writing-assistance purpose and follows the Chrome Web Store User Data Policy, including the Limited Use requirements.
