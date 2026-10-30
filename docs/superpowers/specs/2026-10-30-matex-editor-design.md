# MaTex — bare-minimum editor

Date: 2026-10-30

## Intent

MaTex is a desktop word processor for writing papers and books. It works the way LaTeX Studio does, but you write in Markdown/HTML instead of LaTeX. The main feature, eventually, is **printing**: a document should turn into a clean printed page or PDF with no conversion step. This first version is **only the editor**. Layouts, print/PDF, math and export come later, and every decision here keeps that path open.

Why the editor works the way it does: writing speed. You type Markdown shortcuts and they become formatting right away. A toolbar covers whatever you don't remember the syntax for.

## Goals

1. A visual (WYSIWYG) editor that looks and feels like Google Docs, Word, or Medium's editor: a clean page with the tools where you'd expect them.
2. Markdown typed into the editor becomes formatting immediately (`## `, `**bold**`, `- `, `> `, ``` ``` ```, etc.). The symbols don't stay on screen.
3. A toolbar with buttons and dropdowns that does the same formatting.
4. Mixed Persian/English writing. Each paragraph picks its own direction automatically.
5. Documents save as one archive holding clean Markdown plus their assets.
6. CI builds `.deb`, macOS `.app`, Windows `.msi` and `.exe` installers.

## Non-goals (this version)

Math/equations, citations, OS file association / double-click to open, Persian UI, page layouts, print/PDF/DOCX export, multi-file books/projects, themes, a raw source view, custom spellcheck (the OS/webview one is fine), code signing.

## Anti-goals (a failure even if it works)

- **Anything that can't print as plain HTML + CSS.** The document must be only Markdown + HTML + one plain CSS stylesheet. No canvas rendering, no editor-only visual tricks that a browser's print engine couldn't reproduce from the saved file.
- Saved Markdown that's unreadable in another Markdown tool (e.g. a wall of HTML for ordinary paragraphs).
- Direction handling that breaks mixed text: English words inside a Persian paragraph rendering in the wrong order, or the user having to set direction by hand.
- A cluttered, IDE-like UI.

## Constraints

- **Stack (user's choice):** Vue 3, Composition API, `<script setup>`, plain JavaScript (no TypeScript). Tauri 2 desktop shell. GitHub Actions builds.
- **Printability (user's rule):** the content area is real DOM styled by one plain stylesheet (`document.css` or similar). That file is written as a print stylesheet waiting to happen. It has no dependence on app chrome, so future print/PDF can load `DOCUMENT.md` rendered to HTML + this CSS and nothing else.
- Local Rust is 1.74.1. Tauri 2 needs a newer toolchain, so the builder should `rustup update` (or note it) before running locally. CI uses current stable.
- Not a git repo yet. Initialise one. The GitHub remote is the user's to add.

## Decided

### Editor behaviour (user)
- Visual mode only. No split pane, no source pane.
- Markdown auto-detection while typing turns it into formatting at once.
- Toolbar + dropdowns, Docs/Word/Medium style.
- Basics only in v1: headings, paragraphs, bold, italic, strikethrough, inline code, links, bullet/numbered lists, blockquote, code block, horizontal rule, images, tables. Math is explicitly later.

### Direction (user)
- Auto-detect per paragraph (per block: paragraph, heading, list item, quote, table cell) from the first strong character. Mixed-direction text inside a block must render correctly.
- Nothing about direction is stored in the file. It's worked out again on open. (Native `dir="auto"` on each block does exactly this.)
- **App UI is English, base direction LTR** (user). Toolbar, menus, dialogs and window title are in English and laid out left-to-right. An empty or neutral-only block (a new line, or one starting with a number) falls back to LTR until its first strong letter, so a Persian line starts on the left and moves right once you type. The user accepted this.

### File format (user)
- A document is a **zip archive** containing:
  - `DOCUMENT.md`: clean Markdown, with inline HTML only for things Markdown can't express.
  - `assets/`: every image (and later, other asset) the document uses, referenced from the Markdown by relative path (`assets/<name>.png`).
- Images pasted or dropped into the editor are copied into `assets/` (on save) and referenced relatively.
- *Claude's call:* the extension is `.matex` (still a plain zip inside), so the OS can associate it with the app later. The user may switch to plain `.zip`.
- **No OS file association in v1** (user). Files open only through File > Open. Double-click-to-open, launch-with-file handling and single-instance come later.

### How it gets made (Claude's calls, user saw them and agreed)
- **Editor engine:** Tiptap (ProseMirror) with Vue 3 bindings. StarterKit's input rules supply the Markdown-as-you-type behaviour. A Tiptap Markdown extension (official `@tiptap/markdown` if stable, otherwise `tiptap-markdown`) handles load/save.
- **No router, no Pinia.** It's a single screen with one editor. Add them when a second screen or shared state shows up.
- **No component kit.** A hand-built toolbar with plain CSS, because shadcn-vue would pull in Tailwind for a dozen buttons. Swap it in later if wanted.
- **File commands:** New, Open, Save, Save As via native Tauri dialogs, plus keyboard shortcuts (Ctrl/Cmd+N/O/S, Shift+S for Save As). Window title shows the file name and an unsaved-changes marker.
- **Releases:** GitHub Actions workflow triggered by pushing a `v*` tag. A matrix of ubuntu / macos / windows uses `tauri-apps/tauri-action`, and the outputs go to a **draft** GitHub Release the user publishes by hand. Artefacts: `.deb`, `.app` (zipped or as the action produces it), `.msi` (WiX), `.exe` (NSIS). Unsigned.

## Left to the builder

- Exact Tiptap packages/versions and the Markdown extension choice, verified against Tiptap's current docs.
- Whether zip read/write runs in JS (e.g. `fflate` + Tauri fs plugin) or Rust (`zip` crate behind a Tauri command). Pick the smaller, more robust one.
- How pasted images are held in memory before save (blob URLs → written into the zip on save) and mapped back to `assets/` paths on open.
- How unknown/raw HTML in an opened `DOCUMENT.md` is preserved on round-trip (best effort; at minimum, don't silently drop content).
- Image file naming in `assets/` (avoid collisions).
- Toolbar layout and icon set (inline SVG or a tiny icon dependency). Keep it Docs-like and minimal.
- Default document fonts (system fonts are fine for v1; for Persian, use whatever the OS provides).
- Repo layout per Tauri 2 defaults (`src/`, `src-tauri/`). Keep files few.
- One runnable check for the non-trivial logic (Markdown ⇄ editor round-trip and zip pack/unpack). Keep it small.
- `CHANGELOG.md` entry under `## [Unreleased]`.
