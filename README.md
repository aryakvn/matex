<p align="center"><img src="app-icon.png" alt="MaTex logo" width="128" /></p>

# MaTex

A lightweight, offline, cross-platform word processor for programmers. You write in Markdown and HTML, style with CSS, and get a document ready to print. Persian (RTL) and English (LTR) can share a page.

## Why

My girlfriend at the time ran Linux and had to write her thesis in Persian. There was no solid offline editor on Linux that handled Persian properly and let her use her own fonts. The options were either heavy office suites that fought right-to-left text, or LaTeX, with a learning curve a thesis deadline doesn't leave room for.

MaTex is the editor she needed. It's small, it works offline on Linux, macOS and Windows, and it treats Persian as a first-class language. It's built for people who already think in Markdown, HTML and CSS. If you can write a stylesheet, you can lay out your document.

## What it does today

- **Visual editing:** a clean page with a Docs-style toolbar. No split pane, no source view.
- **Markdown as you type:** `## ` becomes a heading, `**bold**` becomes bold, `- ` starts a list, three backticks start a code block. The toolbar does the same for anything you don't remember.
- **Mixed Persian and English:** each paragraph picks its own direction from its first letter. English words inside a Persian paragraph read in the right order. The ¶ buttons force a paragraph left-to-right or right-to-left when the first letter guesses wrong.
- **Basics:**
  - headings, bold, italic, strikethrough, inline code
  - links, lists, quotes, code blocks, divider lines
  - images (insert, paste, or drop) and tables
- **Print-first:** the page is plain HTML styled by one plain CSS file (`src/styles/document.css`). Nothing is drawn on a canvas, so what you see is what the browser's print engine produces.

## The `.matex` file

A `.matex` file is an ordinary zip:

```
my-thesis.matex
├── DOCUMENT.md      # clean Markdown, HTML only where Markdown can't express something
└── assets/
    └── figure-1.png # every image the document uses, referenced as assets/figure-1.png
```

Rename it to `.zip` and any tool can read it. `DOCUMENT.md` stays readable in any Markdown viewer.

## Develop

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
| `src/components/` | `EditorToolbar`, `ToolbarMenu` |
| `src/composables/useDocument.js` | New / Open / Save / Save as, unsaved-changes guard, images |
| `src/utils/archive.js`, `assets.js` | `.matex` zip ⇄ Markdown + images |
| `src/utils/platform.js` | The only file that knows Tauri from the browser |
| `src/styles/document.css` | The document's stylesheet, kept print-ready |
| `src-tauri/` | Tauri 2 desktop shell |

## Build the desktop apps

GitHub Actions (`.github/workflows/release.yml`) builds all platforms:

- **Release:** push a version tag, such as `git tag v0.1.0 && git push --tags`, to get a draft GitHub Release with the `.deb`, macOS `.app`, Windows `.msi` and `.exe`.
- **Test build:** run the workflow by hand from the Actions tab to get the same files as workflow artifacts.

Builds are unsigned for now, so macOS and Windows will warn about an unknown developer.

To build locally you need a current Rust toolchain (Tauri 2 needs Rust 1.77.2 or newer) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), then `npm run tauri build`.

## Roadmap

See [TODOS.md](TODOS.md).
