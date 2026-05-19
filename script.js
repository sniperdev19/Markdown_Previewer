const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const charCount = document.getElementById("char-count");

// ── marked.js config ────────────────────────────────
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

// ── Render ───────────────────────────────────────────
function render() {
  const md = editor.value.trim();
  charCount.textContent = `${editor.value.length} caractère${editor.value.length !== 1 ? "s" : ""}`;

  if (!md) {
    preview.innerHTML = `
      <div class="preview-empty">
        <span class="empty-icon">📝</span>
        <p>Commencez à taper du Markdown dans l'éditeur…</p>
      </div>`;
    return;
  }

  preview.innerHTML = marked.parse(md);
  preview
    .querySelectorAll("pre code")
    .forEach((el) => hljs.highlightElement(el));
}

editor.addEventListener("input", render);

// ── Default content ──────────────────────────────────
editor.value = `# Bienvenue dans le Markdown Previewer 🎉

Tapez votre Markdown à **gauche** et voyez le rendu HTML en **temps réel** à droite.

---

## Fonctionnalités

- ✅ Rendu en temps réel
- ✅ Coloration syntaxique du code
- ✅ Tableaux, citations, liens
- ✅ Thème clair / sombre
- ✅ Panneau redimensionnable

## Exemple de code

\`\`\`javascript
function hello(name) {
  console.log(\`Bonjour, \${name} !\`);
}
hello('monde');
\`\`\`

## Tableau

| Syntaxe | Description |
|---------|-------------|
| \`**gras**\` | **gras** |
| \`*italique*\` | *italique* |
| \`[lien](url)\` | [lien](https://example.com) |
| \`\`code\`\` | \`code\` |

## Citation

> "Le plus grand voyage commence par un seul pas."
> — Lao-Tseu

## Liste de tâches

- [x] Créer un éditeur Markdown
- [x] Ajouter la prévisualisation
- [ ] Partager avec le monde
`;
render();

// ── Toolbar actions ──────────────────────────────────
function wrapSelection(before, after = before) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const sel = editor.value.substring(start, end) || "texte";
  const replacement = before + sel + after;
  editor.setRangeText(replacement, start, end, "select");
  editor.focus();
  render();
}

document
  .getElementById("btn-bold")
  .addEventListener("click", () => wrapSelection("**"));

document
  .getElementById("btn-italic")
  .addEventListener("click", () => wrapSelection("_"));

document.getElementById("btn-heading").addEventListener("click", () => {
  const start = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
  editor.setRangeText("## ", lineStart, lineStart, "end");
  editor.focus();
  render();
});

document.getElementById("btn-link").addEventListener("click", () => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const sel = editor.value.substring(start, end) || "texte du lien";
  editor.setRangeText(`[${sel}](url)`, start, end, "end");
  editor.focus();
  render();
});

document.getElementById("btn-code").addEventListener("click", () => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const sel = editor.value.substring(start, end);
  if (sel.includes("\n")) {
    editor.setRangeText(`\`\`\`\n${sel || "code"}\n\`\`\``, start, end, "end");
  } else {
    wrapSelection("`");
  }
  editor.focus();
  render();
});

document.getElementById("btn-quote").addEventListener("click", () => {
  const start = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
  editor.setRangeText("> ", lineStart, lineStart, "end");
  editor.focus();
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

// ── Copy HTML ─────────────────────────────────────────
document.getElementById("btn-copy").addEventListener("click", () => {
  navigator.clipboard
    .writeText(preview.innerHTML)
    .then(() => showToast("HTML copié ! 📋"));
});

// ── Clear ─────────────────────────────────────────────
document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("Effacer tout le contenu ?")) {
    editor.value = "";
    render();
    editor.focus();
  }
});

// ── Fullscreen preview ────────────────────────────────
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

// ── Keyboard shortcuts ────────────────────────────────
editor.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "b") {
      e.preventDefault();
      wrapSelection("**");
    }
    if (e.key === "i") {
      e.preventDefault();
      wrapSelection("_");
    }
  }
  // Tab → insert spaces
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText("  ", start, start, "end");
    render();
  }
});

// ── Resizable divider ─────────────────────────────────
const divider = document.getElementById("divider");
const container = document.querySelector(".container");
const editorPane = document.querySelector(".editor-pane");

let dragging = false;

divider.addEventListener("mousedown", (e) => {
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

// ── Toast helper ──────────────────────────────────────
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}
