/* tf2script.js
   Drag & drop + click-to-upload for ONE drop zone.
   Requires these IDs in your HTML:
   - dropZone     (the big dashed box)
   - audioFile    (a hidden <input type="file">)
   - statusBox    (a div/span to show status text)  [optional but recommended]
*/

(() => {
  "use strict";

  const el = {
    dropZone: document.getElementById("dropZone"),
    audioFile: document.getElementById("audioFile"),
    statusBox: document.getElementById("statusBox"),
  };

  function setStatus(msg, type = "info") {
    if (!el.statusBox) return;
    el.statusBox.textContent = msg;

    // Optional: add simple status coloring hooks via CSS if you want
    el.statusBox.dataset.status = type; // info | ok | warn | err
  }

  function isAudioFile(file) {
    if (!file) return false;
    // Some browsers give empty type; fall back to extension check.
    const mimeOk = file.type && file.type.startsWith("audio/");
    const extOk = /\.(wav|mp3|m4a|aac|ogg|flac|webm)$/i.test(file.name);
    return mimeOk || extOk;
  }

  function handleFile(file) {
    try {
      if (!file) {
        setStatus("No file selected.", "warn");
        return;
      }

      if (!isAudioFile(file)) {
        setStatus("Please upload an audio file (wav/mp3/m4a/ogg/flac/webm).", "err");
        return;
      }

      // Safety cap (adjust as needed)
      const MAX_MB = 50;
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_MB) {
        setStatus(`File is too large (${sizeMb.toFixed(1)} MB). Max is ${MAX_MB} MB.`, "err");
        return;
      }

      // Store for later (e.g., upload to API)
      window.selectedAudioFile = file;

      // Optional: quick local URL (useful for preview if you add an <audio> tag later)
      window.selectedAudioUrl = URL.createObjectURL(file);

      setStatus(`Loaded: ${file.name} (${sizeMb.toFixed(1)} MB)`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Unexpected error while processing the audio file.", "err");
    }
  }

  function wireEvents() {
    if (!el.dropZone || !el.audioFile) {
      console.error("Missing #dropZone or #audioFile in HTML.");
      return;
    }

    // Click-to-upload (clicking the drop area opens picker)
    el.dropZone.addEventListener("click", () => {
      try {
        el.audioFile.click();
      } catch (err) {
        console.error(err);
        setStatus("Could not open file picker.", "err");
      }
    });

    // File picker -> handle file
    el.audioFile.addEventListener("change", () => {
      const file = el.audioFile.files && el.audioFile.files[0] ? el.audioFile.files[0] : null;
      handleFile(file);
    });

    // Drag visuals
    ["dragenter", "dragover"].forEach((evt) => {
      el.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      el.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.remove("is-dragover");
      });
    });

    // Drop -> handle file
    el.dropZone.addEventListener("drop", (e) => {
      try {
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0] ? dt.files[0] : null;
        handleFile(file);
      } catch (err) {
        console.error(err);
        setStatus("Unexpected error while dropping the file.", "err");
      }
    });

    setStatus("Ready. Drop an audio file or click to upload.", "info");
  }

  // Run
  wireEvents();
})();