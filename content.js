class InputHandler {
    static SUPPORTED_INPUTS = ['TEXTAREA', 'INPUT', 'DIV']; 

    constructor() {
        this.shortcutModeSpellcheck = "double_stroke";
        this.shortcutModeProofread = "triple_stroke";
        this.shortcutModeCustom = "quadruple_stroke";
        this.customShortcutSpellcheck = "";
        this.customShortcutProofread = "";
        this.customShortcutCustom = "";
        this.copyToClipboard = false;
        this.ctrlSequence = [];
        this.ctrlTimer = null;
        this.loadSettings(); 
        this.initializeEventListeners();
        this.setupContextMenuListener();
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get([
            "shortcutModeSpellcheck", "shortcutModeProofread", "shortcutModeCustom",
            "customShortcutSpellcheck", "customShortcutProofread", "customShortcutCustom",
            "copyToClipboard"
        ]);
        Object.assign(this, result); 
    }

    initializeEventListeners() {
        document.addEventListener("keydown", this.handleKeyPress.bind(this), true);
    }

    setupContextMenuListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            let actionType = null;
            switch (message.action) {
                case "contextMenuSpellcheck":
                    actionType = "spellcheck";
                    break;
                case "contextMenuProofread":
                    actionType = "proofread";
                    break;
                case "contextMenuCustom":
                    actionType = "custom";
                    break;
                case "contextMenu": 
                    actionType = message.promptType || "spellcheck"; 
                    break;
            }

            if (actionType) {
                const activeElement = document.activeElement;
                if (this.isValidTarget(activeElement)) {
                    this.processInput(activeElement, actionType);
                }
            }
        });
    }
     isValidTarget(target) {
        if (!target) return false; // Check for null target
        const tagName = target.tagName.toUpperCase();
        return InputHandler.SUPPORTED_INPUTS.includes(tagName) &&
               (tagName !== 'INPUT' || target.type === "text") ||
               target.isContentEditable ||
               (target.getAttribute && target.getAttribute("role") === "textbox");
    }

    handleKeyPress(event) {
        if (!this.isValidTarget(event.target)) return;

        if (event.key === "Control") {
            this.handleControlKeyPress(event);
        } else {
            this.handleOtherKeyPress(event);
        }
    }

    handleControlKeyPress(event) {
        this.ctrlSequence.push(Date.now());
        clearTimeout(this.ctrlTimer);

        this.ctrlTimer = setTimeout(() => {
            const count = this.ctrlSequence.length;
            let action = null;

            if (count === 2 && this.shortcutModeSpellcheck === "double_stroke") action = "spellcheck";
            else if (count === 3 && this.shortcutModeProofread === "triple_stroke") action = "proofread";
            else if (count === 4 && this.shortcutModeCustom === "quadruple_stroke") action = "custom";

            if (action) {
                event.preventDefault();
                event.stopPropagation();
                this.processInput(event.target, action);
            }
            this.ctrlSequence = [];
        }, 400);
    }

    handleOtherKeyPress(event) {
        clearTimeout(this.ctrlTimer);
        if (this.ctrlSequence.length > 0) this.ctrlSequence = [];

        let keys = [];
        if (event.ctrlKey) keys.push("Control");
        if (event.altKey) keys.push("Alt");
        if (event.shiftKey) keys.push("Shift");
        if (event.metaKey) keys.push("Meta"); 
        if (!["Control", "Alt", "Shift", "Meta"].includes(event.key)) keys.push(event.key);
        const pressedCombination = keys.join(" + ");

        let action = null;
        if (pressedCombination === this.customShortcutCustom) action = "custom"; 
        else if (pressedCombination === this.customShortcutSpellcheck) action = "spellcheck";
        else if (pressedCombination === this.customShortcutProofread) action = "proofread";

        if (action) {
            event.preventDefault();
            event.stopPropagation();
            this.processInput(event.target, action);
        }
    }

    async processInput(inputElement, promptType = "spellcheck") {
        const textProcessor = new TextProcessor(inputElement, this.copyToClipboard, promptType);
        await textProcessor.processText();
    }
}

class TextProcessor {
    constructor(inputElement, copyToClipboard = false, promptType = "spellcheck") {
        this.inputElement = inputElement;
        this.copyToClipboard = copyToClipboard;
        this.accumulatedText = '';
        this.isSlateEditor = inputElement.getAttribute('data-slate-editor') !== null;
        this.originalText = '';
        this.selectionStart = null;
        this.selectionEnd = null;
        this.promptType = promptType;
        this.selectedRange = null;
    }

    getText() {
        const { isContentEditable } = this.inputElement;
        let text = this.isSlateEditor
            ? this.inputElement.querySelector('[data-slate-string]')?.textContent || ''
            : isContentEditable ? this.inputElement.innerText : this.inputElement.value;

        if (!isContentEditable) {
            this.selectionStart = this.inputElement.selectionStart;
            this.selectionEnd = this.inputElement.selectionEnd;
        } else {
            const sel = window.getSelection();
            this.selectionStart = 0;
            this.selectionEnd = text.length;
            
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (this.inputElement.contains(range.commonAncestorContainer)) {
                    const selectedText = range.toString();

                    if (selectedText && selectedText.trim().length > 0) {
                        this.selectedRange = range.cloneRange();
                        const preRange = document.createRange();
                        preRange.setStart(this.inputElement, 0);
                        preRange.setEnd(range.startContainer, range.startOffset);
                        this.selectionStart = preRange.toString().length;
                        this.selectionEnd = this.selectionStart + selectedText.length;
                    } else {
                        this.selectedRange = null;
                    }
                }
            }
        }
        
        this.originalText = text;

        return (this.selectionStart !== this.selectionEnd && 
                this.selectionStart < text.length && 
                this.selectionEnd <= text.length) ?
            text.substring(this.selectionStart, this.selectionEnd) :
            text;
    }

    updateContent(newContent) {
        if (this.copyToClipboard) {
            navigator.clipboard.writeText(newContent).catch(err => this.showError(err.message));
            return;
        }

        const input = this.inputElement;
        let finalContent=newContent;

    
        if (this.isSlateEditor) {
            this.updateSlateContent(finalContent);
        } else if (input.isContentEditable) {
            this.updateContentEditable(finalContent);
        } else {
            input.value = finalContent;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            if (this.selectionStart !== null) {
                const newPosition = this.selectionStart + newContent.length;
                input.setSelectionRange(newPosition, newPosition);
            }
        }
    }
    updateContentEditable(newContent) {
        const input = this.inputElement;
        if (this.selectedRange) {
            this.selectedRange.deleteContents();
            this.selectedRange.insertNode(document.createTextNode(newContent));

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.selectedRange);

        } else {
            // Fallback, replace entire content
            input.innerText = newContent;
        }
        this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async processText() {
        try {
            const text = this.getText();
            if (!text.trim()) return;
            const port = chrome.runtime.connect({ name: "streamTypos" });
            await this.setupStreamProcessing(port, text, this.promptType);
        } catch (error) {
             //Simplified error management
            const errorMessage = error.message.includes("Extension context invalidated") ? "Extension reloaded or updated. Please refresh the page." : error.message;
            this.showError(errorMessage);

        }
    }

    setupStreamProcessing(port, text, promptType) {
        return new Promise((resolve, reject) => {
            port.onMessage.addListener((response) => {
                this.handleStreamResponse(response);
                if (response.done || response.error) {
                    port.disconnect();
                    resolve(); 
                }
            });
            port.postMessage({ text, promptType });
        });
    }

    handleStreamResponse(response) {
        if (response.error) {
            this.showError(response.error.message || response.message || "Unknown error");
            return;
        }

        // For Slate editors, accumulate text but only update at the end
        if (this.isSlateEditor) {
            if (response.chunk) {
                this.accumulatedText += response.chunk;
            }
            if (response.done) {
                // For Slate editors, handle the complete text replacement at once
                if (this.selectionStart !== this.selectionEnd) {
                    // If there's a selection, replace just that part
                    const before = this.originalText.substring(0, this.selectionStart);
                    const after = this.originalText.substring(this.selectionEnd);
                    this.updateContent(before + this.accumulatedText + after);
                } else {
                    // If no selection, replace entire content
                    this.updateContent(this.accumulatedText);
                }
            }
            return;
        }

        // For non-Slate editors, handle streaming updates
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
        console.error('Error:', message);
    }
}

const inputHandler = new InputHandler();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
        for (const key in changes) {
            if (inputHandler.hasOwnProperty(key)) {
                inputHandler[key] = changes[key].newValue;
            }
        }
    }
});