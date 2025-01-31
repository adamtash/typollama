document.addEventListener("keydown", async (event) => {
  if (event.key === 'Meta' && (event.metaKey || event.ctrlKey)) {
    const target = event.target;
    if (target.tagName === "TEXTAREA" || 
        target.type === "text" || 
        target.isContentEditable) {
      event.preventDefault();
      event.stopPropagation();
      fixTypos(target);
    }
  }
});

let typingTimer;
const typingDelay = 500; // Delay in milliseconds

document.addEventListener("keyup", (event) => {
  if ( event.target.isContentEditable) {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      addFixButton(event.target);
    }, typingDelay);
  }
});

function addFixButton(inputElement) {
  if (inputElement.dataset.fixButtonAdded) return;
  inputElement.dataset.fixButtonAdded = "true";

  const button = document.createElement("button");
  button.innerText = "SC";
  button.style.position = "absolute";
  button.style.right = "10px";
  button.style.top = "50%";
  button.style.transform = "translateY(-50%)";
  button.style.zIndex = "1000";
  button.onclick = () => fixTypos(inputElement);

  inputElement.parentElement.style.position = "relative";
  inputElement.parentElement.appendChild(button);
}

async function fixTypos(inputElement) {
  let text;
  if (inputElement.getAttribute('data-slate-editor')) {
    const textElement = inputElement.querySelector('[data-slate-string]');
    text = textElement ? textElement.textContent : '';
  } else if (inputElement.isContentEditable) {
    text = inputElement.innerText;
  } else {
    text = inputElement.value;
  }

  chrome.storage.sync.get(["ollamaUrl", "modelName"], ({ ollamaUrl, modelName }) => {
    chrome.runtime.sendMessage(
      { text, ollamaUrl, modelName },
      (response) => {
        if (response.error) {
          // Show error in popup
          chrome.runtime.sendMessage({ 
            type: 'showError', 
            error: response.message 
          });
          return;
        }
        if (response.reply) {
          if (inputElement.getAttribute('data-slate-editor')) {
            const textElement = inputElement.querySelector('[data-slate-string]');
            if (textElement) {
              // Start composition
              textElement.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              
              // Select all existing content
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(textElement);
              selection.removeAllRanges();
              selection.addRange(range);
              
              // Trigger selection change
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              
              // Delete content
              textElement.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'deleteContentBackward',
                bubbles: true,
                cancelable: true
              }));
              
              // Clear content
              textElement.textContent = '';
              
              // Insert new content
              textElement.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: response.reply,
                bubbles: true,
                cancelable: true
              }));
              
              // Set new content
              textElement.textContent = response.reply;
              
              // End composition
              textElement.dispatchEvent(new Event('compositionend', { bubbles: true }));
              
              // Final input event
              textElement.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                data: response.reply,
                bubbles: true,
                cancelable: false
              }));
              
              // Update selection after content change
              range.selectNodeContents(textElement);
              selection.removeAllRanges();
              selection.addRange(range);
              
              // Focus and scroll into view
              inputElement.focus();
              textElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          } else if (inputElement.isContentEditable) {
            inputElement.innerHTML = response.reply;
          } else {
            inputElement.value = response.reply;
          }
        }
      }
    );
  });
}
