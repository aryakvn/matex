<div align="center">

<img src="app-icon.png" alt="MaTex logo" width="128" />

# MaTex

**The offline word processor for people who think in Markdown.**<br/>
Write in Markdown and HTML, style with CSS, print a finished paper. Persian and English on the same page.

[![Latest release](https://img.shields.io/github/v/release/aryakvn/matex?style=for-the-badge&logo=github&label=release&color=0f6cbd)](https://github.com/aryakvn/matex/releases/latest)
[![Open in browser](https://img.shields.io/badge/open%20in-browser-0f6cbd?style=for-the-badge&logo=googlechrome&logoColor=white)](https://matex.aryakvn.ir/)

[![Pages](https://img.shields.io/github/actions/workflow/status/aryakvn/matex/pages.yml?branch=main&label=web%20build&logo=githubactions&logoColor=white)](https://github.com/aryakvn/matex/actions/workflows/pages.yml)
[![Release build](https://img.shields.io/github/actions/workflow/status/aryakvn/matex/release.yml?label=desktop%20build&logo=githubactions&logoColor=white)](https://github.com/aryakvn/matex/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/aryakvn/matex/total?logo=github)](https://github.com/aryakvn/matex/releases)
[![Last commit](https://img.shields.io/github/last-commit/aryakvn/matex?logo=git&logoColor=white)](https://github.com/aryakvn/matex/commits/main)

![Windows](https://img.shields.io/badge/Windows-0078D4?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8?logo=pwa&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)
![Tiptap](https://img.shields.io/badge/Tiptap-3-000000)

[**⬇️ Download**](https://github.com/aryakvn/matex/releases/latest) ·
[**🌐 Try it online**](https://matex.aryakvn.ir/) ·
[**📝 Changelog**](CHANGELOG.md) ·
[**🗺️ Roadmap**](TODOS.md)

</div>

---

## 💡 Why

Writing a thesis in Persian on Linux is harder than it should be. There was no solid offline editor on Linux that handled Persian properly and let you use your own fonts. The options were either heavy office suites that fought right-to-left text, or LaTeX, with a learning curve a thesis deadline doesn't leave room for.

MaTex is the editor that was missing. It's small, it works offline on Linux, macOS and Windows, and it treats Persian as a first-class language. It's built for people who already think in Markdown, HTML and CSS. If you can write a stylesheet, you can lay out your document.

## 🚀 Get MaTex

| | Platform | Get it |
| --- | --- | --- |
| 🪟 | **Windows** | `.msi` or `.exe` installer from the [latest release](https://github.com/aryakvn/matex/releases/latest) |
| 🍎 | **macOS** | Universal `.app` (Intel + Apple Silicon) from the [latest release](https://github.com/aryakvn/matex/releases/latest) |
| 🐧 | **Linux** | `.deb` from the [latest release](https://github.com/aryakvn/matex/releases/latest) |
| 🌐 | **Any browser** | Open [matex.aryakvn.ir](https://matex.aryakvn.ir/) and install it as an app. It keeps working offline. |

> [!NOTE]
> Builds are unsigned for now, so macOS and Windows will warn about an unknown developer.

## ✨ Features

- ✍️ **Visual editing.** A clean page with an Office-style ribbon. No split pane, no source view.
- ⌨️ **Markdown as you type.** `## ` becomes a heading, `**bold**` becomes bold, `- ` starts a list, three backticks start a code block. Pasted Markdown arrives formatted.
- 🔀 **Persian and English together.** Each paragraph picks its own direction from its first letter, and English words inside Persian read in the right order. The ¶ buttons force a direction when the guess is wrong.
- 🖨️ **Print-first pages.** Real sheets with page setup (paper, orientation, margins), headers and footers, sections and multi-column layout. What you see is what the browser's print engine produces.
- 🎨 **Style with CSS.** Every element has a class (`.heading-1`, `.persian`, `.toc-item`) and an id. The CSS panel styles the document live and in print. Paragraph styles and your own font files travel inside the document.
- 📚 **Paper tools.** Table of contents, footnotes, references, captions with cross-references (`[IMG-1]`, `[TBL-1]`, `[EQ-1]`).
- ➗ **Equations.** KaTeX math, saved as `$…$` and `$$…$$`.
- 📊 **Charts.** Mermaid diagrams (flowchart, sequence, pie, gantt, …) drawn live, saved as ```` ```mermaid ```` fences.
- 🧩 **HTML where Markdown stops.** HTML blocks are drawn live (sanitized) and saved verbatim. Code fields are Monaco, with autocomplete.
- ⚙️ **Script fields.** `{{ page }}`-style JavaScript fields for page numbers, dates and anything a document script computes.
- 🔍 **Find and replace.** Match case, whole words and regular expressions; Arabic ي/ك also find Persian ی/ک.
- 🤖 **AI agents (MCP).** The desktop app can serve the open document to Claude Code, Claude Desktop or any MCP client at `http://127.0.0.1:7420/mcp`: the agent reads and edits the Markdown and CSS, live and undoable (Edit → AI agents).
- 🖼️ **Images.** Insert, paste or drop; resize, align, wrap, rotate and filter. Tables too.
- 📴 **Offline.** No account, no cloud. Your files stay on your disk.

## 📦 The `.matex` file

A `.matex` file is an ordinary zip:

```
my-thesis.matex
├── DOCUMENT.md      # clean Markdown, HTML only where Markdown can't express something
├── style.css        # the document's own CSS (optional)
├── script.js        # the document script (optional)
├── fonts/           # font files the document uses (optional)
└── assets/
    └── figure-1.png # every image the document uses, referenced as assets/figure-1.png
```

Rename it to `.zip` and any tool can read it. `DOCUMENT.md` stays readable in any Markdown viewer.

## 🛠️ Develop

Requires Node 22. The interface runs in a normal browser, so you don't need Rust for day-to-day work.

```sh
npm install
npm run dev      # http://localhost:1420
npm test         # vitest
npm run build    # production web build in dist/
```

The project is laid out like this:

| Path | What lives there |
| --- | --- |
| `src/editor/extensions.js` | Tiptap setup: Markdown in and out, per-paragraph direction |
| `src/editor/` | Sections, pagination, notes, captions, math, Mermaid, fields, search |
| `src/components/` | `EditorToolbar`, `ToolbarMenu`, side panels |
| `src/composables/useDocument.js` | New / Open / Save / Save as, unsaved-changes guard, images, fonts |
| `src/utils/archive.js`, `assets.js` | `.matex` zip ⇄ Markdown + images |
| `src/utils/platform.js` | The only file that knows Tauri from the browser |
| `src/sw.js`, `public/manifest.webmanifest` | Installable, offline web build (the `pwa()` plugin in `vite.config.js` writes `dist/sw.js`) |
| `src/styles/document.css` | The document's stylesheet, kept print-ready |
| `src-tauri/` | Tauri 2 desktop shell |

## 🏗️ Build the desktop apps

GitHub Actions builds everything:

- **Web:** every push to `main` deploys to [matex.aryakvn.ir](https://matex.aryakvn.ir/) (`.github/workflows/pages.yml`).
- **Release:** push a version tag, such as `git tag v0.1.0 && git push --tags`, to get a draft GitHub Release with the `.deb`, macOS `.app`, Windows `.msi` and `.exe` (`.github/workflows/release.yml`).
- **Test build:** run the release workflow by hand from the Actions tab to get the same files as workflow artifacts.

To build locally you need a current Rust toolchain (Tauri 2 needs Rust 1.77.2 or newer) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), then `npm run tauri build`.

## 🗺️ Roadmap

See [TODOS.md](TODOS.md) for what's next and [CHANGELOG.md](CHANGELOG.md) for what shipped.
