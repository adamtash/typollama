<div align="center">
  <img src="images/icon.png" alt="Typollama Chrome Extension Icon" width="128" height="128">
  <h1>Typollama</h1>
  <p><strong>AI-Powered Writing Assistant for Chrome</strong></p>
  <p><i>Enhance text in any input field on any website</i></p>
  <a href="https://chrome.google.com/webstore/detail/Typollama%E2%80%93AI-Spell-Check-%26-Text-Processing/bpfbfpkchkmgladnfmgmhapainhcokel" style="text-decoration:none; color:inherit;">
    <img src="https://fonts.gstatic.com/s/i/productlogos/chrome_store/v7/192px.svg" alt="Chrome Web Store" style="width:32px;">
    <div style="font-size:0.9rem; margin-top:5px;">Get it on the Chrome Web Store</div>
  </a>
  <p>
    <a href="#features-anchor">Features</a> •
    <a href="#installation-anchor">Installation</a> •
    <a href="#usage-anchor">Usage</a> •
    <a href="#troubleshooting-anchor">Troubleshooting</a> •
    <a href="#legal-anchor">Legal</a>
  </p>
</div>

## 🚀 AI-Powered Writing Assistance

Typollama is a Chrome extension that provides real-time text enhancements in any input field. Choose from multiple AI models, including local and cloud-based providers.

### Key Benefits

- ✅ **Instant Spellcheck & Proofreading** – Improve text effortlessly
- 🔄 **Multiple AI Providers** – Supports OpenAI, Gemini, Claude, DeepSeek, Mistral AI, Perplexity AI, Ollama, LM Studio, and Chrome AI
- ⚡ **Quick & Easy Activation** – Use keyboard shortcuts or right-click menus
- 🔒 **Privacy-Focused** – Local processing available with Ollama, LM Studio, or Chrome AI

## ✨ Features
<a name="features-anchor"></a>

### Writing Tools

- **Spellcheck** – Quick grammar and spelling fixes
- **Proofread** – Rewrite text while preserving meaning
- **Custom Tool** – Define AI-powered enhancements tailored to your needs

### Smart Text Processing

- **Process Full Text or Selection** – Works on any text box
- **Context Menu Integration** – Right-click for easy access
- **Keyboard Shortcuts** –
  - Double CTRL – Spellcheck
  - Triple CTRL – Proofread
  - Quadruple CTRL – Custom Tool
  - Custom key bindings supported

### Flexible AI Integration

- **Local Processing**
  - Ollama ([Docs](https://github.com/ollama/ollama))
  - LM Studio ([Docs](https://lmstudio.ai/docs))
  - Chrome AI ([Docs](https://developer.chrome.com/docs/ai/get-started#use_apis_on_localhost))
- **Cloud Services**
  - OpenAI ([Docs](https://platform.openai.com/docs))
  - Google Gemini ([Docs](https://aistudio.google.com/app/apikey))
  - Anthropic Claude ([Docs](https://console.anthropic.com/settings/keys))
  - DeepSeek ([Docs](https://platform.deepseek.com/api_keys))
  - Mistral AI ([Docs](https://console.mistral.ai/api-keys/))
  - Perplexity AI ([Docs](https://www.perplexity.ai/settings/api))

### Customization

- **Per-Tool System Prompts** – Define custom instructions for different writing tools, including:
  - Writing Style
  - Tone
  - Formatting
  - Language Preferences

## 📸 Screenshots & Demo

<div align="center">
  <img src="images/p1.png" alt="Typollama Settings Panel" width="400">
  <img src="images/p2.png" alt="Typollama Settings Panel" width="400">
  <img src="images/p3.png" alt="Typollama Settings Panel" width="400">
</div>

### Live Demo

<div align="center">
  <img src="images/text-correction-demo.gif" alt="Typollama Text Correction Demo" width="1200">
</div>

## 🛒 Install on Chrome
<a name="installation-anchor"></a>

[Get Typollama on the Chrome Web Store](https://chromewebstore.google.com/detail/Typollama%20%E2%80%93%20AI%20Spell-Check%20%26%20Text%20Processing/bpfbfpkchkmgladnfmgmhapainhcokel?hl=en-US&utm_source=ext_sidebar).

## 📥 Local Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/adamtash/typollama.git
   ```

2. Load in Chrome:
   - Open `chrome://extensions`
   - Enable Developer Mode
   - Click **Load unpacked**
   - Select the `typollama` folder

3. Configure settings in the extension menu:
   - Choose your AI provider and enter the required API key or URL
  - **Chrome AI**: Enable feature flag at `chrome://flags/#prompt-api-for-gemini-nano` ([Docs](https://developer.chrome.com/docs/ai/get-started#use_apis_on_localhost))
  - **OpenAI**: Enter your API key ([Docs](https://platform.openai.com/docs))
  - **Gemini**: Enter your Google API key ([Docs](https://aistudio.google.com/app/apikey))
  - **Claude**: Enter your Anthropic API key ([Docs](https://console.anthropic.com/settings/keys))
  - **Ollama** (Local/Remote): `http://localhost:11434` ([Docs](https://github.com/ollama/ollama))
  - **LM Studio** (Local/Remote): `http://localhost:1234` ([Docs](https://lmstudio.ai/docs))
  - **DeepSeek**: Enter your DeepSeek API key ([Docs](https://platform.deepseek.com/api_keys))
  - **Mistral AI**: Enter your Mistral AI API key ([Docs](https://console.mistral.ai/api-keys/))
  - **Perplexity AI**: Enter your Perplexity API key ([Docs](https://www.perplexity.ai/settings/api))
## 💡 Usage
<a name="usage-anchor"></a>

1. Select text in any input field
2. Trigger Typollama using:
   - Double-tap CTRL (default)
   - Right-click menu
   - Custom keyboard shortcuts
3. Text is instantly processed and enhanced

### Advanced Options

- **Custom Shortcuts** – Set personalized keybindings
- **Clipboard Mode** – Copy results instead of inline replacement
- **AI Behavior Customization** – Define system prompts for different tools

## 🔧 Troubleshooting
<a name="troubleshooting-anchor"></a>

### Common Issues & Fixes

#### Connection Issues
- Ensure your AI provider settings are correctly configured
- Verify your API key is valid

#### API Key Errors
- Check that the key is correctly entered and has the necessary permissions

#### Ollama 403 Error (Access Denied)

- **MacOS**:
  ```bash
  launchctl setenv OLLAMA_ORIGINS "*"
  ```
- **Windows**:
  ```powershell
  $env:OLLAMA_ORIGINS="*"
  ```
- **Linux**:
  ```bash
  export OLLAMA_ORIGINS="*"
  ```
- Restart your system or terminal after applying the fix

## 📜 Legal
<a name="legal-anchor"></a>

- [Privacy Policy](PRIVACY.md)
- [Terms of Service](TERMS.md)
- [License](LICENSE.md) – MIT

## 🔍 Keywords

AI writing assistant, Chrome extension, text enhancement, grammar checker, spell checker, proofreading tool, local AI processing, OpenAI, Google Gemini, Claude AI, Mistral AI, DeepSeek, Perplexity AI, Ollama, LM Studio, productivity tool

---

<sub>*This README and the source code was partially generated with AI assistance.*</sub>

