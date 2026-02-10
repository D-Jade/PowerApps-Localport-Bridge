const dimensions = ["correctness", "clarity", "usefulness", "instruction", "safety"];
const ratings = Object.fromEntries(dimensions.map(d => [d, { A: 0, B: 0 }]));

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

document.getElementById("runBtn").onclick = () => {
  outA.textContent = "Model A output placeholder";
  outB.textContent = "Model B output placeholder";
};

document.getElementById("clearBtn").onclick = () => {
  prompt.value = "";
  note.value = "";
};

document.getElementById("saveBtn").onclick = () => {
  const payload = {
    prompt: prompt.value,
    ratings,
    note: note.value,
    timestamp: new Date().toISOString()
  };
  console.log(payload);
};

renderStars();
