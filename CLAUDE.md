# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MaTex is an offline WYSIWYG Markdown word processor (Tauri 2 + Vue 3 + Tiptap 3) for writing Persian/English papers and books. Printing is the main feature. Product direction and known issues are in `TODOS.md`; user-facing overview is in `README.md`.

## Commands

```sh
npm run dev                          # Vite on http://localhost:1420 (strictPort — 5173 is taken by another project)
npm test                             # vitest run (jsdom)
npx vitest run tests/assets.test.js  # one file
npx vitest run -t "round-trips"      # tests whose name matches
npm run build                        # web build to dist/
npm run tauri build                  # desktop app; needs Rust >= 1.77.2 + Tauri prerequisites
```

There is no linter or formatter configured.

Test the UI in a browser with `npm run dev`. The desktop apps are built only by GitHub Actions; the user tests those builds by hand. Rust code can't be compiled on this machine (local Rust is too old), so changes under `src-tauri/` are first compiled in CI.

Releases come from `.github/workflows/release.yml`. Pushing a `v*` tag creates a draft GitHub Release with deb, macOS universal `.app`, msi and nsis exe. Running the workflow by hand produces the same files as workflow artifacts. CI runs `npm test` before building.

## Architecture

**Markdown is the stored format; the Tiptap document is the in-memory one.** A `.matex` file is a zip with `DOCUMENT.md` and `assets/*`.
- **Open:** `unpack(bytes)` → `assets.load(markdown, files)` rewrites `assets/x.png` targets to blob URLs → `setContent(md, { contentType: 'markdown' })`.
- **Save:** `editor.getMarkdown()` → `assets.collect(md)` rewrites blob URLs back to `assets/<name>` and keeps only referenced files → `pack()`.
- `src/composables/useDocument.js` drives both flows and owns the asset store, the dirty flag and the window title.

**Editor setup lives in one place.** Every editor is created with `...editorOptions` from `src/editor/extensions.js`: extensions + `textDirection: 'auto'` + `contentType: 'markdown'`.
- Per-paragraph RTL/LTR comes from `dir="auto"` in the DOM only. Auto is never written to the Markdown.
  - A manual override (toolbar ¶ buttons, `toggleDirection('ltr'|'rtl')`) is the node's `dir` attr, saved as a leading LRM/RLM mark. `src/editor/direction.js` adds the mark in paragraph/heading `renderMarkdown` and removes it in one wrapper around `editor.markdown.parse`, because list items and table cells build paragraphs without the paragraph parser.
- Markdown round-trip safety is enforced in that file and pinned by `tests/markdown.test.js`:
  - `escapeBlockStart` escapes paragraph text that would reparse as a heading, list, rule or code block.
  - Tables save in Tiptap's canonical padded form.
  - HTML with no matching extension keeps its text but loses its tags. Add a node or mark per HTML feature.

**`src/utils/platform.js` is the only file that touches Tauri.**
- It lazy-imports `@tauri-apps/*` and falls back to browser equivalents: a file input, an `<a download>`, `confirm`/`alert`, `beforeunload`.
- New native calls go there.
- Each new native call also needs a permission in `src-tauri/capabilities/default.json`. The capabilities are deliberately minimal: no broad fs scope, since dialog-picked paths are allowed automatically.

**Styling is split between document and app chrome.**
- `src/styles/document.css` is the document's only stylesheet. It is scoped to `.page`, sized for A4 with `@page`, and uses logical properties for RTL.
- App chrome (toolbar, menus, light/dark tokens) lives in `src/styles/app.css` and is hidden in print. It follows Microsoft Fluent 2 (Office 2023 look); reuse its tokens (`--surface`, `--stroke`, `--brand`, `--shadow-4`/`--shadow-16`, ...) instead of new colours.
- Keep the document HTML + CSS only, with no canvas rendering, so it prints and converts to PDF through the webview.

**Behaviors that span files:**
- `show()` in `useDocument` replaces the editor state, which also clears the undo history. This keeps Undo from bringing back the previous document after New/Open.
- App shortcuts go through `fileAction(e)` in `src/utils/keys.js`, which matches `e.code` (`KeyS`), not `e.key`, so they work on the Persian keyboard layout. Mod-Shift-S is Save as, so Strike was moved to Mod-Shift-X.
- Image paste and drop are handled in `App.vue` `editorProps` and go through `doc.insertImage(file, pos)`. `tauri.conf.json` sets `dragDropEnabled: false` so the webview receives file drops.

## Conventions

- Vue 3 Composition API with `<script setup>`, plain JavaScript (no TypeScript). Icons come from `lucide-vue-next`.
- The UI is English and LTR; the document content is mixed Persian/English.
- Rust crates are pinned to `~minor` to match the npm `@tauri-apps/*` versions; no `Cargo.lock` is committed. Bump both together.
- Add an entry under `## [Unreleased]` in `CHANGELOG.md` for each change. Append only.
