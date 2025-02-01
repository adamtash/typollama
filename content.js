class InputHandler {
    static SUPPORTED_INPUTS = ['TEXTAREA', 'text'];

    constructor() {
        this.lastCtrlPressTime = 0;
        // Default settings
        this.shortcutMode = "double_stroke";
        this.customShortcut = ""; // comma-separated keys, e.g. "a,b"
        this.customBuffer = [];
        // Load configurable settings
        chrome.storage.sync.get(["shortcutMode", "customShortcut"], (result) => {
            this.shortcutMode = result.shortcutMode || "double_stroke";
            this.customShortcut = result.customShortcut || "";
        });
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener("keydown", (event) => this.handleKeyPress(event), true);
    }

    isValidTarget(target) {
        return InputHandler.SUPPORTED_INPUTS.includes(target.tagName) ||
            target.type === "text" ||
            target.isContentEditable ||
            // Support Gmail compose and similar (elements with role="textbox")
            (target.getAttribute && target.getAttribute("role") === "textbox");
    }

    async handleKeyPress(event) {
        if (!this.isValidTarget(event.target)) return;
        
        if (this.shortcutMode === "double_stroke") {
            // Existing double-stroke logic
            if (event.key !== "Control") return;
            const now = Date.now();
            if ((now - this.lastCtrlPressTime) < 500) {
                event.preventDefault();
                event.stopPropagation();
                await this.processInput(event.target);
            }
            this.lastCtrlPressTime = now;
        } else if (this.shortcutMode === "custom" && this.customShortcut) {
            // Build current key combination
            let currentKeys = [];
            if (event.ctrlKey) currentKeys.push("Control");
            if (event.altKey) currentKeys.push("Alt");
            if (event.shiftKey) currentKeys.push("Shift");
            if (!["Control", "Alt", "Shift"].includes(event.key)) {
                currentKeys.push(event.key);
            }
            
            // Compare with saved shortcut
            const currentCombo = currentKeys.join(" + ");
            if (currentCombo === this.customShortcut) {
                event.preventDefault();
                event.stopPropagation();
                await this.processInput(event.target);
            }
        }
    }

    async processInput(inputElement) {
        const textProcessor = new TextProcessor(inputElement, this.copyToClipboard); // copyToClipboard set elsewhere
        await textProcessor.processText();
    }
}

class TextProcessor {
    constructor(inputElement, copyToClipboard = false) {
        this.inputElement = inputElement;
        this.copyToClipboard = copyToClipboard;
        this.accumulatedText = '';
        this.isSlateEditor = inputElement.getAttribute('data-slate-editor');
        this.originalText = '';
        this.selectionStart = null;
        this.selectionEnd = null;
    }

    getText() {
        const { tagName, type, isContentEditable } = this.inputElement;
        let text;
        
        if (this.isSlateEditor) {
            const textElement = this.inputElement.querySelector('[data-slate-string]');
            text = textElement ? textElement.textContent : '';
        } else {
            text = isContentEditable ? this.inputElement.innerText : this.inputElement.value;
        }

        if (tagName === "TEXTAREA" || tagName === "INPUT") {
            this.selectionStart = this.inputElement.selectionStart;
            this.selectionEnd = this.inputElement.selectionEnd;
        } else {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (this.inputElement.contains(range.commonAncestorContainer)) {
                    const preRange = document.createRange();
                    preRange.setStart(this.inputElement, 0);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    this.selectionStart = preRange.toString().length;
                    this.selectionEnd = this.selectionStart + range.toString().length;
                }
            }
        }

        this.originalText = text;
        return this.selectionStart !== this.selectionEnd ? 
            text.substring(this.selectionStart, this.selectionEnd) : 
            text;
    }

    updateContent(newContent) {
        if (this.copyToClipboard && navigator.clipboard) {
            navigator.clipboard.writeText(newContent).catch(error => this.showError(error.message));
            return;
        }

        const input = this.inputElement;
        let finalContent;

        if (this.selectionStart !== null && this.selectionEnd !== null && 
            this.selectionStart !== this.selectionEnd) {
            finalContent = this.originalText.substring(0, this.selectionStart) + 
                          newContent + 
                          this.originalText.substring(this.selectionEnd);
        } else {
            finalContent = newContent;
        }

        if (this.isSlateEditor) {
            this.updateSlateContent(finalContent);
        } else if (input.isContentEditable) {
            input.innerText = finalContent;
        } else {
            input.value = finalContent;
        }
    }

    async processText() {
        const text = this.getText();
        if (!text.trim()) return;
        const port = chrome.runtime.connect({ name: "streamTypos" });
        try {
            await this.setupStreamProcessing(port, text);
        } catch (error) {
            this.showError(error.message);
        }
        // Do not disconnect port here; it is handled in setupStreamProcessing.
    }

    setupStreamProcessing(port, text) {
        return new Promise((resolve, reject) => {
            port.onMessage.addListener((response) => {
                try {
                    this.handleStreamResponse(response);
                    if (response.done || response.error) {
                        port.disconnect();
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            });
            port.postMessage({ text });
        });
    }

    handleStreamResponse(response) {
        if (response.error) {
            const errorMessage = response.error.message || response.message || "Unknown error";
            console.log("Stream response error:", errorMessage);
            this.showError(errorMessage);
            return;
        }
        if (response.chunk) {
            this.accumulatedText += response.chunk;
            this.updateContent(this.accumulatedText);
        }
    }

    updateSlateContent(newContent) {
        const textElement = this.inputElement.querySelector('[data-slate-string]');
        if (textElement) {
            textElement.dispatchEvent(new Event('compositionstart', { bubbles: true }));

            const selection = window.getSelection();
            const range = document.createRange();

            if (this.selectedRange) {
                selection.removeAllRanges();
                selection.addRange(this.selectedRange);
            } else {
                range.selectNodeContents(textElement);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));

            textElement.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'deleteContentBackward',
                bubbles: true,
                cancelable: true
            }));

            textElement.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: newContent,
                bubbles: true,
                cancelable: true
            }));

            if (this.selectedRange) {
                this.selectedRange.deleteContents();
                this.selectedRange.insertNode(document.createTextNode(newContent));
            } else {
                textElement.textContent = newContent;
            }

            textElement.dispatchEvent(new Event('compositionend', { bubbles: true }));

            textElement.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                data: newContent,
                bubbles: true,
                cancelable: false
            }));

            range.selectNodeContents(textElement);
            selection.removeAllRanges();
            selection.addRange(range);

            this.inputElement.focus();
            textElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    showError(message) {
        chrome.runtime.sendMessage({ type: "showError", error: message });
        console.log('Error:', message);
    }
}

new InputHandler();
