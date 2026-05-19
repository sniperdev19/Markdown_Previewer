# ⬡ Markdown Previewer

Un éditeur Markdown en temps réel avec prévisualisation HTML instantanée, coloration syntaxique et interface sombre/claire.

> Projet #4 — Défi 30 jours / 30 projets

---

## 🚀 Démo

Ouvrez simplement `index.html` dans votre navigateur — aucune installation requise.

---

## ✨ Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| ⚡ Rendu en temps réel | La prévisualisation se met à jour à chaque frappe |
| 🎨 Coloration syntaxique | Blocs de code colorés via **highlight.js** (thème GitHub Dark) |
| 🌙 / ☀️ Thème sombre / clair | Basculement en un clic |
| ↔️ Panneau redimensionnable | Divider glissable entre l'éditeur et la prévisualisation |
| 📋 Copie HTML | Copie le HTML rendu dans le presse-papier |
| 🖥️ Mode plein écran | Affiche la prévisualisation en plein écran (`Échap` pour quitter) |
| 🧹 Effacement | Vide l'éditeur en un clic |
| 📐 Compteur de caractères | Affiché en temps réel |

### Barre d'outils

| Bouton | Action | Raccourci |
|---|---|---|
| **B** | Gras | `Ctrl+B` |
| *I* | Italique | `Ctrl+I` |
| H | Titre (`##`) | — |
| 🔗 | Lien `[texte](url)` | — |
| `</>` | Code inline ou bloc | — |
| ❝ | Citation (`>`) | — |

> **Tab** dans l'éditeur insère 2 espaces.

---

## 🏗️ Structure du projet

```
4.Markdown_Previewer/
├── index.html   # Structure HTML
├── style.css    # Styles (thèmes clair/sombre, layout, typographie)
└── script.js    # Logique : rendu Markdown, toolbar, raccourcis, divider
```

---

## 🛠️ Technologies

- **HTML / CSS / JavaScript** — Vanilla, aucun framework
- [**marked.js** v9](https://marked.js.org/) — Parsing Markdown → HTML (GFM activé)
- [**highlight.js** v11](https://highlightjs.org/) — Coloration syntaxique des blocs de code

---

## 📦 Installation

```bash
# Cloner ou télécharger le projet, puis ouvrir :
open index.html
# ou glisser le fichier dans votre navigateur
```

---

## 📝 Syntaxe Markdown supportée

- Titres (`#`, `##`, `###`…)
- **Gras**, *italique*, `code inline`
- Listes ordonnées et non ordonnées
- Listes de tâches `- [x]`
- Tableaux GFM
- Citations (`>`)
- Blocs de code avec langage (` ```js `)
- Liens et images
- Règles horizontales (`---`)
