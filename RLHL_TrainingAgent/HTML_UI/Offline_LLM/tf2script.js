/* tfScript.js
   DeepSeek (host 11435) + Ollama (host 11434)
   ✅ Streaming output
   ✅ Chat-style UI (labels)
   ✅ Per-model conversation memory (messages array)
   ✅ Mode buttons are MODE SWITCHES (Both / DeepSeek / Ollama)
      - Clicking mode buttons does NOT send
      - It only highlights the active button + active output window
   ✅ Enter key sends to ACTIVE mode
   ✅ Run button sends to ACTIVE mode (same routing as Enter)
   ✅ New chat / Clear reset UI + both memories
*/

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 1) UI ELEMENTS (by id)
  // =========================
  const promptEl   = document.getElementById("prompt");

  const runBtn     = document.getElementById("runBtn");
  const clearBtn   = document.getElementById("clearBtn");
  const newChatBtn = document.getElementById("newChatBtn");

  // Mode switch buttons (NOT send buttons)
  const modeBothBtn     = document.getElementById("modeBoth");
  const modeDeepSeekBtn = document.getElementById("modeDeepSeek");
  const modeOllamaBtn   = document.getElementById("modeOllama");

    // Model status dots
  const deepSeekStatus = document.getElementById("deepseekStatus");
  const ollamaStatus   = document.getElementById("ollamaStatus");

  // Model response time labels
  const deepSeekTime = document.getElementById("deepseekTime");
  const ollamaTime   = document.getElementById("ollamaTime");

    // Output windows
  const deepSeekOutEl = document.getElementById("outA");
  const ollamaOutEl   = document.getElementById("outB");

  // =========================
  // 2) API SETTINGS
  // =========================
  const DEEPSEEK_BASE = "http://localhost:11435";
  const OLLAMA_BASE   = "http://localhost:11434";
  const CHAT_PATH     = "/api/chat";

  const DEEPSEEK_MODEL = "deepseek-r1:8b";
  const OLLAMA_MODEL   = "llama3:8b";

  // =========================
  // 3) MEMORY (messages arrays)
  // =========================
  let deepSeekHistory = [];
  let ollamaHistory   = [];

  // =========================
  // 4) MODE STATE
  // =========================
  // Active mode controls where Enter + Run button sends the prompt.
  // "both" | "deepseek" | "ollama"
  let activeMode = "both";

  // =========================
  // 5) SMALL HELPERS
  // =========================
  function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function clearUI() {
    if (promptEl) promptEl.value = "";
    if (deepSeekOutEl) deepSeekOutEl.innerHTML = "";
    if (ollamaOutEl) ollamaOutEl.innerHTML = "";
  }

  function safeString(v) {
    return typeof v === "string" ? v : "";
  }

  // Create one chat bubble in a window and return the <p> so we can stream text into it.
  function addChatMessage(outputEl, { role, label, text }) {
    if (!outputEl) return null;

    const msg = document.createElement("article");
    msg.className = `msg msg--${role}`;

    const lab = document.createElement("span");
    lab.className = "msg__label";
    lab.textContent = label;

    const body = document.createElement("p");
    body.className = "msg__text";
    body.textContent = safeString(text);

    msg.appendChild(lab);
    msg.appendChild(body);
    outputEl.appendChild(msg);

    scrollToBottom(outputEl);
    return body;
  }

  function showError(outputEl, modelLabel, message) {
    addChatMessage(outputEl, { role: "model", label: modelLabel, text: `Error: ${message}` });
  }
function setModelStatus(dotEl, state) {
  if (!dotEl) return;

  // remove all status classes first
  dotEl.classList.remove(
    "statusDot--idle",
    "statusDot--streaming",
    "statusDot--error"
  );

  // apply the new one
  if (state === "streaming") {
    dotEl.classList.add("statusDot--streaming");
  } else if (state === "error") {
    dotEl.classList.add("statusDot--error");
  } else {
    dotEl.classList.add("statusDot--idle");
  }
}
function setModelTime(timeEl, ms) {
  if (!timeEl) return;

  // If ms is null/undefined, show dash
  if (typeof ms !== "number") {
    timeEl.textContent = "—";
    return;
  }

  timeEl.textContent = `${ms} ms`;
}
  // =========================
  // 6) MODE UI HIGHLIGHTING
  // =========================
  function clearModeHighlights() {
    // Buttons
    [modeBothBtn, modeDeepSeekBtn, modeOllamaBtn].forEach((btn) => {
      if (!btn) return;
      btn.classList.remove("is-both-active", "is-deepseek-active", "is-ollama-active");
    });

    // Output windows
    [deepSeekOutEl, ollamaOutEl].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-both-active", "is-deepseek-active", "is-ollama-active");
    });
  }

  // Apply highlight classes that your CSS uses for glow/border color.
  function applyModeHighlights(mode) {
  clearModeHighlights();

  // Remove dim/active classes first
  [deepSeekOutEl, ollamaOutEl].forEach(el => {
    if (!el) return;
    el.classList.remove("is-dimmed", "is-active-panel");
  });

  if (mode === "both") {
  modeBothBtn?.classList.add("is-both-active");

  deepSeekOutEl?.classList.add("is-active-panel");
  ollamaOutEl?.classList.add("is-active-panel");

  return;
}

  if (mode === "deepseek") {
    modeDeepSeekBtn?.classList.add("is-deepseek-active");

    deepSeekOutEl?.classList.add("is-active-panel");
    ollamaOutEl?.classList.add("is-dimmed");
    return;
  }

  if (mode === "ollama") {
    modeOllamaBtn?.classList.add("is-ollama-active");

    ollamaOutEl?.classList.add("is-active-panel");
    deepSeekOutEl?.classList.add("is-dimmed");
  }
}

  function setActiveMode(mode) {
    activeMode = mode;
    applyModeHighlights(mode);
  }

  // =========================
  // 7) STREAMING CHAT REQUEST (GENERIC)
  // =========================
  async function streamChatReply({
    baseUrl,
    modelName,
    modelLabel,
    outputEl,
    historyRef,
    promptText
  }) {
    // Show user's message in this model window + store in that model's memory
    addChatMessage(outputEl, { role: "user", label: "D-Jade", text: promptText });
    historyRef.push({ role: "user", content: promptText });

    // Create assistant placeholder bubble (we stream into it)
    const assistantBodyEl = addChatMessage(outputEl, { role: "model", label: modelLabel, text: "" });
    if (!assistantBodyEl) {
      showError(outputEl, modelLabel, "Output window not found.");
      return;
    }

    const endpoint = `${baseUrl}${CHAT_PATH}`;
let fullAssistantText = "";

// Determine which status dot to control
const statusDot = (outputEl === deepSeekOutEl) ? deepSeekStatus : ollamaStatus;
const timeEl = (outputEl === deepSeekOutEl) ? deepSeekTime : ollamaTime;
const t0 = performance.now();
setModelTime(timeEl, null);

try {
  // Set dot to streaming BEFORE fetch starts
  setModelStatus(statusDot, "streaming");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: historyRef,
      stream: true
    })
  });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        assistantBodyEl.textContent = `Error: HTTP ${response.status}${errText ? ` — ${errText}` : ""}`;
        scrollToBottom(outputEl);
        return;
      }

      if (!response.body) {
        assistantBodyEl.textContent = "Error: streaming not supported by this browser/response.";
        scrollToBottom(outputEl);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama streams JSON lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          // /api/chat streaming token format:
          // { message: { role: "assistant", content: "..." }, done: false }
          const token = parsed?.message?.content;
          if (typeof token === "string" && token.length > 0) {
            fullAssistantText += token;
            assistantBodyEl.textContent += token;
            scrollToBottom(outputEl);
          }

          // When done, store assistant reply into memory
          if (parsed?.done === true) {
            historyRef.push({ role: "assistant", content: fullAssistantText });
            setModelStatus(statusDot, "idle");
            const t1 = performance.now();
            setModelTime(timeEl, Math.round(t1 - t0));
            scrollToBottom(outputEl);
          }

        }
      }
    } 
    catch (err) {
  setModelStatus(statusDot, "error");
  assistantBodyEl.textContent = `Error: ${err?.message || "Unknown error"}`;
  scrollToBottom(outputEl);
}
  }

  // =========================
  // 8) SUBMIT ROUTER (SENDS TO ACTIVE MODE)
  // =========================
  function getPromptTextOrShowErrors() {
    const promptText = (promptEl?.value || "").trim();
    if (!promptText) {
      // show errors in both so user sees it regardless of active mode
      showError(deepSeekOutEl, "DeepSeek-r1:8b", "Please type a prompt first.");
      showError(ollamaOutEl, "Ollama", "Please type a prompt first.");
      return null;
    }
    return promptText;
  }

  function clearPromptAfterSend() {
    if (promptEl) promptEl.value = "";
  }

  function submitToActiveMode() {
    const promptText = getPromptTextOrShowErrors();
    if (!promptText) return;

    clearPromptAfterSend();

    if (activeMode === "both") {
      // Send to both models in parallel
      streamChatReply({
        baseUrl: DEEPSEEK_BASE,
        modelName: DEEPSEEK_MODEL,
        modelLabel: "DeepSeek-r1:8b",
        outputEl: deepSeekOutEl,
        historyRef: deepSeekHistory,
        promptText
      });

      streamChatReply({
        baseUrl: OLLAMA_BASE,
        modelName: OLLAMA_MODEL,
        modelLabel: "Ollama",
        outputEl: ollamaOutEl,
        historyRef: ollamaHistory,
        promptText
      });
      return;
    }

    if (activeMode === "deepseek") {
      streamChatReply({
        baseUrl: DEEPSEEK_BASE,
        modelName: DEEPSEEK_MODEL,
        modelLabel: "DeepSeek-r1:8b",
        outputEl: deepSeekOutEl,
        historyRef: deepSeekHistory,
        promptText
      });
      return;
    }

    if (activeMode === "ollama") {
      streamChatReply({
        baseUrl: OLLAMA_BASE,
        modelName: OLLAMA_MODEL,
        modelLabel: "Ollama",
        outputEl: ollamaOutEl,
        historyRef: ollamaHistory,
        promptText
      });
    }
  }

  // =========================
  // 9) BUTTON WIRING
  // =========================

  // Mode buttons (mode switch only, no sending)
  modeBothBtn?.addEventListener("click", () => setActiveMode("both"));
  modeDeepSeekBtn?.addEventListener("click", () => setActiveMode("deepseek"));
  modeOllamaBtn?.addEventListener("click", () => setActiveMode("ollama"));

  // Run button sends to the ACTIVE mode
  runBtn?.addEventListener("click", () => {
    submitToActiveMode();
  });

  // Clear and New Chat: reset UI + BOTH memories
  function resetEverything() {
    clearUI();
    deepSeekHistory = [];
    ollamaHistory = [];
  }

  clearBtn?.addEventListener("click", () => resetEverything());
  newChatBtn?.addEventListener("click", () => resetEverything());

  // =========================
  // 10) ENTER KEY WIRING
  // =========================
  // Enter sends to ACTIVE mode
  // Shift+Enter adds a new line in the prompt box
  promptEl?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitToActiveMode();
    }
  });

  // =========================
  // 11) DEFAULT MODE ON LOAD
  // =========================
  setActiveMode("both");
});