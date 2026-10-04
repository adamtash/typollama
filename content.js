(() => {
  const DEFAULT_SETTINGS = {
    shortcutModeSpellcheck: "double_stroke",
    shortcutModeProofread: "triple_stroke",
    shortcutModeCustom: "quadruple_stroke",
    customShortcutSpellcheck: "",
    customShortcutProofread: "",
    customShortcutCustom: "",
    copyToClipboard: false
  };
  const settings = { ...DEFAULT_SETTINGS };
  let controlPresses = [];
  let controlTimer;
  let controlKeyIsDown = false;
  let controlTarget = null;
  let busy = false;
  let lastTarget = null;
  let processingIndicator = null;

  const keyFor = (prefix, type) => `${prefix}${type[0].toUpperCase()}${type.slice(1)}`;

  function showStatus(message, isError = false) {
    let status = document.getElementById("typollama-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "typollama-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      Object.assign(status.style, {
        position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647", maxWidth: "320px",
        padding: "10px 14px", borderRadius: "8px", color: "#fff", background: "#183153",
        font: "500 13px/1.4 system-ui, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,.25)"
      });
      document.documentElement.append(status);
    }
    status.textContent = message;
    status.style.background = isError ? "#a61b2b" : "#183153";
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => status.remove(), isError ? 7000 : 2500);
  }

  function ensureProcessingIndicator() {
    if (processingIndicator?.host.isConnected) return processingIndicator;
    const host = document.createElement("div");
    host.id = "typollama-processing-indicator";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    Object.assign(host.style, {
      position: "fixed", zIndex: "2147483647", pointerEvents: "none"
    });
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 11px; border-radius: 10px;
        color: #f8fbff; background: rgba(24, 49, 83, .96); box-shadow: 0 10px 26px rgba(9, 25, 49, .24);
        font: 600 12px/1 system-ui, -apple-system, sans-serif; letter-spacing: .01em; opacity: 0;
        transform: translateY(4px) scale(.98); filter: blur(4px); transition-property: transform, opacity, filter;
        transition-duration: 160ms; transition-timing-function: cubic-bezier(.2, 0, 0, 1); will-change: transform, opacity, filter; }
      .visible { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      .dots { display: inline-flex; gap: 3px; }
      .dot { width: 4px; height: 4px; border-radius: 50%; background: #95c5ff; animation: typollama-pulse 900ms ease-in-out infinite; }
      .dot:nth-child(2) { animation-delay: 120ms; } .dot:nth-child(3) { animation-delay: 240ms; }
      @keyframes typollama-pulse { 0%, 100% { opacity: .35; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
      @media (prefers-reduced-motion: reduce) { .dot { animation: none; opacity: .8; } }
    `;
    const pill = document.createElement("div");
    pill.className = "pill";
    const label = document.createElement("span");
    label.textContent = "Typollama is working";
    const dots = document.createElement("span");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dots.append(dot);
    }
    pill.append(dots, label);
    shadow.append(style, pill);
    document.documentElement.append(host);
    processingIndicator = { host, pill, target: null };
    return processingIndicator;
  }

  function positionProcessingIndicator() {
    if (!processingIndicator?.target?.isConnected) return;
    const rect = processingIndicator.target.getBoundingClientRect();
    const top = rect.top > 46 ? rect.top - 38 : rect.bottom + 8;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 210));
    processingIndicator.host.style.top = `${Math.max(8, top)}px`;
    processingIndicator.host.style.left = `${left}px`;
  }

  function showProcessingIndicator(target) {
    const indicator = ensureProcessingIndicator();
    indicator.target = target;
    positionProcessingIndicator();
    requestAnimationFrame(() => indicator.pill.classList.add("visible"));
  }

  function hideProcessingIndicator() {
    if (!processingIndicator) return;
    processingIndicator.pill.classList.remove("visible");
    const indicator = processingIndicator;
    processingIndicator = null;
    setTimeout(() => indicator.host.remove(), 180);
  }

  function editableTarget(node) {
    const target = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return target?.closest?.("textarea, input, [contenteditable='true'], [role='textbox']") || null;
  }

  function isSupported(target) {
    if (!target || target.disabled || target.readOnly) return false;
    if (target.matches("textarea, [contenteditable='true'], [role='textbox']")) return true;
    if (target.tagName !== "INPUT") return false;
    return ["", "text", "search", "email", "url", "tel"].includes(target.type);
  }

  function isRangeInside(range, element) {
    return element.contains(range.commonAncestorContainer) || range.commonAncestorContainer === element;
  }

  function rangeForOffsets(element, start, end) {
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode;
    let startOffset;
    let endNode;
    let endOffset;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.textContent.length;
      if (startNode === undefined && pos + len >= start) { startNode = node; startOffset = start - pos; }
      if (endNode === undefined && pos + len >= end) { endNode = node; endOffset = end - pos; }
      pos += len;
    }
    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
    } else {
      range.selectNodeContents(element);
    }
    return range;
  }

  function snapshotFor(element) {
    if (element.matches("textarea, input")) {
      const value = element.value || "";
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? start;
      return {
        kind: "input", element, before: value.slice(0, start), after: value.slice(end),
        text: start !== end ? value.slice(start, end) : value, selectionStart: start,
        hadSelection: start !== end
      };
    }
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const selected = range.toString();
      if (selected.trim() && isRangeInside(range, element)) {
        return { kind: "editable", element, range: range.cloneRange(), text: selected, hadSelection: true };
      }
    }
    const text = element.innerText || element.textContent || "";
    return { kind: "editable", element, range: rangeForOffsets(element, 0, text.length), text, hadSelection: false };
  }

  function dispatchInput(element, text) {
    try {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } catch {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function setNativeValue(element, value) {
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
  }

  function insertTextOverRange(element, selection, targetRange, text) {
    selection.removeAllRanges();
    selection.addRange(targetRange);
    try {
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    } catch { /* older pages can still use the fallback below */ }
    if (document.execCommand("insertText", false, text)) return;
    targetRange.deleteContents();
    const node = document.createTextNode(text);
    targetRange.insertNode(node);
    targetRange.setStartAfter(node);
    targetRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(targetRange);
    dispatchInput(element, text);
  }

  async function replaceEditable(snapshot, replacement) {
    const { element, range, hadSelection } = snapshot;
    element.focus();
    // A provider request takes long enough for the tab to go to the background, where
    // requestAnimationFrame (and with it, a framework's own pending re-render) is paused.
    // Waiting a frame here lets that catch up before we touch the DOM ourselves, instead
    // of racing it.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const isSlateEditor = element.hasAttribute("data-slate-editor");
    if (isSlateEditor) {
      try {
        await navigator.clipboard.writeText(replacement);
      } catch {
        throw new Error("Discord protects this editor. Reload Typollama to enable its clipboard fallback, then try again.");
      }
      showStatus("Discord protects this editor. The result is copied—paste it with Ctrl/Cmd+V.");
      return "copied";
    }
    const selection = window.getSelection();
    if (hadSelection) {
      insertTextOverRange(element, selection, range, replacement);
      dispatchInput(element, replacement);
      return;
    }
    // Whole-field replace (nothing was selected): some rich editors (e.g. X's Draft.js)
    // desync their internal block model if every original character is removed in one
    // edit. Leaving the last original character in place, then trimming it separately,
    // keeps the editor's own reconciliation intact. Re-measure the field now rather than
    // trusting the snapshot's length, since real provider requests take long enough for
    // the editor's own idle/blur handling to shift the DOM out from under a stale offset.
    const originalLength = (element.innerText || element.textContent || "").replace(/\n$/, "").length;
    const keepRange = rangeForOffsets(element, 0, Math.max(0, originalLength - 1));
    insertTextOverRange(element, selection, keepRange, replacement);
    if (originalLength > 0) {
      const trailingRange = rangeForOffsets(element, replacement.length, replacement.length + 1);
      selection.removeAllRanges();
      selection.addRange(trailingRange);
      if (!document.execCommand("delete")) {
        trailingRange.deleteContents();
      }
    }
  }

  async function applyResult(snapshot, result) {
    if (settings.copyToClipboard) {
      await navigator.clipboard.writeText(result);
      showStatus("Typollama result copied to the clipboard.");
      return;
    }
    if (snapshot.kind === "input") {
      const { element } = snapshot;
      element.focus();
      const value = snapshot.hadSelection ? `${snapshot.before}${result}${snapshot.after}` : result;
      setNativeValue(element, value);
      const cursor = snapshot.hadSelection ? snapshot.selectionStart + result.length : result.length;
      try {
        element.setSelectionRange(cursor, cursor);
      } catch {
        /* some input types (email, number) don't support selection */
      }
      dispatchInput(element, result);
    } else {
      const outcome = await replaceEditable(snapshot, result);
      if (outcome === "copied") return;
    }
    showStatus("Typollama applied the result.");
  }

  function run(target, promptType) {
    if (busy) return showStatus("Typollama is already processing this frame.", true);
    if (!isSupported(target)) return showStatus("Focus a supported text field first.", true);
    const snapshot = snapshotFor(target);
    if (!snapshot.text.trim()) return showStatus("Select or enter text before running Typollama.", true);
    busy = true;
    showStatus("Typollama is working…");
    showProcessingIndicator(target);
    let port;
    try {
      port = chrome.runtime.connect({ name: "typollama:stream" });
    } catch (error) {
      busy = false;
      hideProcessingIndicator();
      return showStatus("Typollama was updated. Refresh this page and try again.", true);
    }
    let result = "";
    port.onMessage.addListener(async (message) => {
      if (message.type === "chunk") result += message.chunk;
      if (message.type === "error") {
        busy = false;
        hideProcessingIndicator();
        showStatus(message.message || "Typollama could not complete the request.", true);
        port.disconnect();
      }
      if (message.type === "done") {
        busy = false;
        try {
          if (!result) throw new Error("The provider returned no text.");
          await applyResult(snapshot, result);
        } catch (error) {
          showStatus(error.message || "Typollama could not apply the result.", true);
        }
        hideProcessingIndicator();
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => { busy = false; hideProcessingIndicator(); });
    port.postMessage({ type: "typollama:process", promptType, text: snapshot.text });
  }

  function shortcutFor(event) {
    const keys = [];
    if (event.ctrlKey) keys.push("Control");
    if (event.altKey) keys.push("Alt");
    if (event.shiftKey) keys.push("Shift");
    if (event.metaKey) keys.push("Meta");
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) keys.push(event.key);
    return keys.join(" + ");
  }

  function handleControlStroke(target) {
    controlPresses.push(Date.now());
    clearTimeout(controlTimer);
    controlTimer = setTimeout(() => {
      const count = controlPresses.length;
      const promptType = count === 2 ? "spellcheck" : count === 3 ? "proofread" : count === 4 ? "custom" : null;
      if (promptType && settings[keyFor("shortcutMode", promptType)] === `${["double", "triple", "quadruple"][count - 2]}_stroke`) run(target, promptType);
      controlPresses = [];
    }, 425);
  }

  document.addEventListener("focusin", (event) => {
    const target = editableTarget(event.target);
    if (isSupported(target)) lastTarget = target;
  }, true);

  document.addEventListener("keydown", (event) => {
    const target = editableTarget(event.target);
    if (!isSupported(target)) return;
    lastTarget = target;
    if (event.key === "Control") {
      if (!event.repeat && !controlKeyIsDown) {
        controlKeyIsDown = true;
        controlTarget = target;
      }
      return;
    }
    clearTimeout(controlTimer);
    controlPresses = [];
    controlKeyIsDown = false;
    const pressed = shortcutFor(event);
    for (const type of ["spellcheck", "proofread", "custom"]) {
      if (settings[keyFor("shortcutMode", type)] === "custom" && settings[keyFor("customShortcut", type)] === pressed) {
        event.preventDefault();
        event.stopPropagation();
        run(target, type);
        return;
      }
    }
  }, true);

  document.addEventListener("keyup", (event) => {
    if (event.key !== "Control" || !controlKeyIsDown) return;
    controlKeyIsDown = false;
    handleControlStroke(controlTarget || editableTarget(event.target) || lastTarget);
    controlTarget = null;
  }, true);

  window.addEventListener("blur", () => {
    controlKeyIsDown = false;
    controlTarget = null;
    controlPresses = [];
    clearTimeout(controlTimer);
  });

  window.addEventListener("resize", positionProcessingIndicator);
  document.addEventListener("scroll", positionProcessingIndicator, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "typollama:process") run(editableTarget(document.activeElement) || lastTarget, message.promptType || "spellcheck");
  });

  chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS)).then((stored) => Object.assign(settings, stored));
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    for (const [key, change] of Object.entries(changes)) if (key in settings) settings[key] = change.newValue;
  });
})();
