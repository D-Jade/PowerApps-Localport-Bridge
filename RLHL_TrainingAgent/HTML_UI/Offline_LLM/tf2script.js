const dimensions = ["correctness", "clarity", "usefulness", "instruction", "safety"];
const ratings = Object.fromEntries(dimensions.map(d => [d, { A: 0, B: 0 }]));

// Explicit DOM bindings (avoid window.prompt collision + id-as-global reliance)
const promptEl = document.getElementById("prompt");
const outAEl = document.getElementById("outA");
const outBEl = document.getElementById("outB");
const noteEl = document.getElementById("note");

const runBtn = document.getElementById("runBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

// DeepSeek (Ollama-style) endpoint on port 11435
const DEEPSEEK_GENERATE_URL = "http://localhost:11435/api/generate";
const DEEPSEEK_MODEL = "deepseek-r1:8b";
// OLLAMA (Ollama-style) endpoint on port 11435
const OLLAMA_B_URL = "http://localhost:11434/api/generate";
const OLLAMA_B_MODEL = "llama3:8b"; // use the exact model name you pulled



function renderStars() {
  document.querySelectorAll(".row").forEach(row => {
    const dim = row.dataset.dim;
    row.querySelectorAll(".stars").forEach(starBox => {
      const model = starBox.dataset.model;
      starBox.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const s = document.createElement("div");
        s.className = "star" + (i <= ratings[dim][model] ? " on" : "");
        s.textContent = "★";
        s.onclick = () => {
          ratings[dim][model] = i;
          renderStars();
        };
        starBox.appendChild(s);
      }
    });
  });
}

async function runDeepSeek(promptText) {
  outAEl.classList.remove("muted");
  outAEl.textContent = "";

  const res = await fetch(DEEPSEEK_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      prompt: promptText,
      stream: true
    })
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`DeepSeek request failed (${res.status}). ${msg}`.trim());
  }

  if (!res.body) {
    throw new Error("DeepSeek response has no body (stream not available).");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // ✅ FIX: must split on "\n"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const chunk = JSON.parse(trimmed);

      if (typeof chunk.response === "string") {
        outAEl.textContent += chunk.response;
      }
      if (chunk.done) return;
    }
  }
}
async function runOllamaB(promptText) {
  outBEl.classList.remove("muted");
  outBEl.textContent = "";

  const res = await fetch(OLLAMA_B_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_B_MODEL,
      prompt: promptText,
      stream: true
    })
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Model B request failed (${res.status}). ${msg}`.trim());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.response) outBEl.textContent += chunk.response;
      if (chunk.done) return;
    }
  }
}

runBtn.onclick = async () => {
  const p = (promptEl.value || "").trim();

  if (!p) {
    outAEl.classList.add("muted");
    outAEl.textContent = "Please enter a prompt first.";
    return;
  }

  outAEl.classList.remove("muted");
  outAEl.textContent = "Running DeepSeek…";
  outBEl.classList.remove("muted");
  outBEl.textContent = "Running Model B…";

  try {
    await Promise.all([
      runDeepSeek(p),
      runOllamaB(p)
    ]);
  } catch (err) {
    // show which one failed by leaving the individual function errors intact
    if (!outAEl.textContent || outAEl.textContent.startsWith("Running")) {
      outAEl.classList.add("muted");
      outAEl.textContent = `DeepSeek error: ${err?.message || String(err)}`;
    }
    if (!outBEl.textContent || outBEl.textContent.startsWith("Running")) {
      outBEl.classList.add("muted");
      outBEl.textContent = `Model B error: ${err?.message || String(err)}`;
    }
  }
};


clearBtn.onclick = () => {
  promptEl.value = "";
  noteEl.value = "";
};

saveBtn.onclick = () => {
  const payload = {
    prompt: promptEl.value,
    ratings,
    note: noteEl.value,
    timestamp: new Date().toISOString()
  };
  console.log(payload);
};

renderStars();
