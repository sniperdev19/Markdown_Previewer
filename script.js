const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const charCount = document.getElementById("char-count");
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");
const chkImages = document.getElementById("chk-images");

let currentFile = null;
let currentName = "document";

// ── Libraries config ─────────────────────────────────
marked.setOptions({ breaks: true, gfm: true });

const PDFJS_VERSION = "3.11.174";
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});
turndown.use(turndownPluginGfm.gfm);

// ── Render preview ───────────────────────────────────
function render() {
  const md = editor.value.trim();
  const n = editor.value.length;
  charCount.textContent = `${n} caractère${n > 1 ? "s" : ""}`;

  if (!md) {
    preview.innerHTML = `
      <div class="preview-empty">
        <span class="empty-icon">📄</span>
        <p>Déposez un fichier Word, PDF, HTML ou TXT pour le convertir en Markdown…</p>
      </div>`;
    return;
  }

  preview.innerHTML = DOMPurify.sanitize(marked.parse(md));
  preview
    .querySelectorAll("pre code")
    .forEach((el) => hljs.highlightElement(el));
}

editor.addEventListener("input", render);
render();

// ── File handling ────────────────────────────────────
const handlers = {
  docx: convertDocx,
  pdf: convertPdf,
  html: convertHtmlFile,
  htm: convertHtmlFile,
  txt: async (file) => file.text(),
  md: async (file) => file.text(),
};

async function handleFile(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  currentFile = file;
  currentName = file.name.replace(/\.[^.]+$/, "") || "document";
  showFileInfo(file, ext);
  chkImages.closest(".option").hidden = ext !== "docx";

  if (ext === "doc") {
    return fail(
      "Le format .doc (Word 97-2003) n'est pas supporté — enregistrez-le en .docx."
    );
  }
  const handler = handlers[ext];
  if (!handler) return fail(`Format « .${ext} » non supporté.`);

  setLoading(true, "Conversion en cours…");
  try {
    const md = await handler(file);
    editor.value = cleanMarkdown(md);
    render();
    if (!editor.value.trim()) {
      return fail(
        ext === "pdf"
          ? "Aucun texte trouvé — ce PDF est probablement un scan (OCR non supporté)."
          : "Le document semble vide."
      );
    }
    setMeta("Converti avec succès", "ok");
    showToast("Conversion terminée ✅");
  } catch (err) {
    console.error(err);
    fail(`Échec de la conversion : ${err.message || err}`);
  } finally {
    setLoading(false);
  }
}

function fail(msg) {
  setMeta(msg, "error");
  showToast("Conversion impossible ⚠️");
}

function showFileInfo(file, ext) {
  document.getElementById("drop-empty").hidden = true;
  document.getElementById("drop-file").hidden = false;
  document.getElementById("file-badge").textContent = ext.toUpperCase();
  document.getElementById("file-name").textContent = file.name;
  setMeta(formatSize(file.size));
}

function setMeta(text, state = "") {
  const el = document.getElementById("file-meta");
  el.textContent = text;
  el.className = `file-meta ${state}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

function setLoading(on, text) {
  loader.hidden = !on;
  if (text) loaderText.textContent = text;
}

function cleanMarkdown(md) {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── DOCX → Markdown ──────────────────────────────────
async function convertDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const options = {};
  if (!chkImages.checked) {
    options.convertImage = mammoth.images.imgElement(() => ({ src: "" }));
  }
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, options);
  return htmlToMarkdown(html);
}

async function convertHtmlFile(file) {
  return htmlToMarkdown(await file.text());
}

function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(
    DOMPurify.sanitize(html),
    "text/html"
  );

  // Drop images without source (images ignored)
  doc.querySelectorAll('img[src=""]').forEach((img) => img.remove());

  // Tables: GFM needs a header row of <th> and single-line cells
  doc.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("td, th").forEach((cell) => {
      cell.innerHTML = cell.innerHTML
        .replace(/<\/p>\s*<p>/gi, "<br>")
        .replace(/<\/?p>/gi, "");
    });
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      firstRow.querySelectorAll("td").forEach((td) => {
        const th = doc.createElement("th");
        th.innerHTML = td.innerHTML;
        td.replaceWith(th);
      });
    }
  });

  return turndown.turndown(doc.body);
}

chkImages.addEventListener("change", () => {
  if (currentFile) handleFile(currentFile);
});

// ── PDF → Markdown ───────────────────────────────────
async function loadPdfWorker() {
  // A cross-origin worker URL is rejected by browsers; load it through a blob
  try {
    const res = await fetch(PDFJS_WORKER_URL);
    const blob = new Blob([await res.text()], { type: "text/javascript" });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
}

async function convertPdf(file) {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) await loadPdfWorker();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    setLoading(true, `Lecture de la page ${i} / ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(groupLines(content.items));
  }
  return pdfLinesToMarkdown(pages);
}

// Group raw text items into visual lines (same baseline), sorted top→bottom
function groupLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const size = Math.abs(it.transform[3]) || it.height || 10;
    let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, size * 0.35));
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, w: it.width, size, str: it.str });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    row.items.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = null;
    for (const it of row.items) {
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      const needsSpace =
        gap > it.size * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str);
      text += (needsSpace ? " " : "") + it.str;
      prevEnd = it.x + it.w;
    }
    // size = dominant (by characters) size on the line
    const bySize = new Map();
    row.items.forEach((it) =>
      bySize.set(it.size, (bySize.get(it.size) || 0) + it.str.length)
    );
    const size = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      y: row.y,
      x: row.items[0].x,
      size: Math.round(size * 2) / 2,
      text: text.replace(/\s+/g, " ").trim(),
    };
  });
}

const BULLET_RE = /^[•●▪◦‣▫■□○·–—-]\s+/;
const NUMBER_RE = /^(\d{1,3})[.)]\s+/;

function pdfLinesToMarkdown(pages) {
  // Body font size = most common size, weighted by characters
  const weights = new Map();
  pages.flat().forEach((l) =>
    weights.set(l.size, (weights.get(l.size) || 0) + l.text.length)
  );
  if (!weights.size) return "";
  const bodySize = [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Sizes clearly larger than body → heading levels (biggest = h1)
  const headingSizes = [...weights.keys()]
    .filter((s) => s >= bodySize * 1.15)
    .sort((a, b) => b - a)
    .slice(0, 4);
  const levelOf = (size) => {
    const idx = headingSizes.indexOf(size);
    return idx === -1 ? 0 : idx + 1;
  };

  const out = [];
  let para = null; // { text, size, y }

  const flush = () => {
    if (para) out.push(para.text);
    para = null;
  };

  pages.forEach((lines, pageIndex) => {
    let prev = null;
    lines.forEach((line) => {
      const level = levelOf(line.size);
      const gap = prev ? prev.y - line.y : 0;
      const newBlock = !prev || gap > prev.size * 1.7;

      if (level) {
        // merge multi-line headings of the same size
        if (para && para.heading === level && !newBlock) {
          para.text += " " + line.text;
        } else {
          flush();
          para = {
            heading: level,
            text: `${"#".repeat(level)} ${line.text}`,
            size: line.size,
          };
        }
        prev = line;
        return;
      }

      const bullet = line.text.match(BULLET_RE);
      const number = line.text.match(NUMBER_RE);

      if (bullet || number) {
        flush();
        para = {
          list: true,
          text: bullet
            ? `- ${line.text.slice(bullet[0].length)}`
            : `${number[1]}. ${line.text.slice(number[0].length)}`,
          size: line.size,
        };
      } else if (
        para &&
        !para.heading &&
        (!newBlock || (pageIndex > 0 && !prev && continuesParagraph(para.text, line.text)))
      ) {
        // continuation of the current paragraph / list item
        para.text = joinLines(para.text, line.text);
      } else {
        flush();
        para = { text: line.text, size: line.size };
      }
      prev = line;
    });
  });
  flush();

  // Consecutive list items stay tight, everything else is separated by a blank line
  return out
    .map((block, i) => {
      const isList = /^(- |\d+\. )/.test(block);
      const prevIsList = i > 0 && /^(- |\d+\. )/.test(out[i - 1]);
      return (i === 0 ? "" : isList && prevIsList ? "\n" : "\n\n") + block;
    })
    .join("");
}

function joinLines(a, b) {
  if (/\w-$/.test(a) && /^[a-zà-ÿ]/.test(b)) return a.slice(0, -1) + b; // hyphenation
  return `${a} ${b}`;
}

// A paragraph cut by a page break: no final punctuation + lowercase start
function continuesParagraph(text, next) {
  return !/[.!?:;»")\]]$/.test(text) && /^[a-zà-ÿ]/.test(next);
}

// ── Open / drag & drop ───────────────────────────────
const openPicker = () => fileInput.click();
document.getElementById("btn-open").addEventListener("click", openPicker);
dropzone.addEventListener("click", openPicker);
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openPicker();
  }
});

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files[0]);
  fileInput.value = "";
});

let dragDepth = 0;
document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  dropzone.classList.add("drag-over");
});
document.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropzone.classList.remove("drag-over");
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove("drag-over");
  handleFile(e.dataTransfer.files[0]);
});

// ── Output actions ───────────────────────────────────
document.getElementById("btn-copy-md").addEventListener("click", () => {
  if (!editor.value.trim()) return showToast("Rien à copier");
  navigator.clipboard
    .writeText(editor.value)
    .then(() => showToast("Markdown copié ! 📋"));
});

document.getElementById("btn-copy").addEventListener("click", () => {
  if (!editor.value.trim()) return showToast("Rien à copier");
  navigator.clipboard
    .writeText(preview.innerHTML)
    .then(() => showToast("HTML copié ! 📋"));
});

document.getElementById("btn-download").addEventListener("click", () => {
  if (!editor.value.trim()) return showToast("Rien à télécharger");
  const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentName}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!editor.value && !currentFile) return;
  if (!confirm("Effacer le fichier et le contenu ?")) return;
  editor.value = "";
  currentFile = null;
  currentName = "document";
  document.getElementById("drop-empty").hidden = false;
  document.getElementById("drop-file").hidden = true;
  chkImages.closest(".option").hidden = true;
  render();
});

// ── Theme toggle ─────────────────────────────────────
const btnTheme = document.getElementById("btn-theme");
let dark = true;
btnTheme.addEventListener("click", () => {
  dark = !dark;
  document.body.dataset.theme = dark ? "" : "light";
  btnTheme.textContent = dark ? "🌙" : "☀️";
});

// ── Fullscreen preview ───────────────────────────────
const previewPane = document.querySelector(".preview-pane");
const btnFs = document.getElementById("btn-fullscreen");
btnFs.addEventListener("click", () => {
  previewPane.classList.toggle("fullscreen");
  btnFs.textContent = previewPane.classList.contains("fullscreen")
    ? "Quitter"
    : "Plein écran";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    previewPane.classList.remove("fullscreen");
    btnFs.textContent = "Plein écran";
  }
});

// ── Editor: Tab → insert spaces ──────────────────────
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText("  ", start, start, "end");
    render();
  }
});

// ── Resizable divider ────────────────────────────────
const divider = document.getElementById("divider");
const container = document.querySelector(".container");
const editorPane = document.querySelector(".editor-pane");

let dragging = false;

divider.addEventListener("mousedown", () => {
  dragging = true;
  divider.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
});

document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = container.getBoundingClientRect();
  const total = rect.width - divider.offsetWidth;
  let pct = ((e.clientX - rect.left) / total) * 100;
  pct = Math.max(20, Math.min(80, pct));
  editorPane.style.flex = "none";
  editorPane.style.width = `${pct}%`;
  previewPane.style.flex = "1";
});

document.addEventListener("mouseup", () => {
  if (!dragging) return;
  dragging = false;
  divider.classList.remove("dragging");
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

// ── Toast helper ─────────────────────────────────────
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}
