# MaTex Bare-Minimum Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A WYSIWYG Markdown editor (Vue 3 + Tiptap) in a Tauri 2 shell. It saves `.matex` zip archives (`DOCUMENT.md` + `assets/`), and GitHub Actions builds deb/app/msi/exe.

**Architecture:** One screen: `App.vue` hosts a toolbar and a Tiptap editor. Pure helpers (`archive.js`, `assets.js`) turn editor Markdown + in-memory image blobs into a zip and back. `platform.js` is the only file that knows Tauri vs browser; it uses native dialogs in Tauri and file input/download in the browser. That way the whole UI can be tested in a plain browser. Document styling lives in one plain `document.css`, kept print-ready.

**Tech Stack:** vue 3.5, vite 8, @vitejs/plugin-vue 6, @tiptap/{core,vue-3,starter-kit,markdown,extension-image,extension-table,pm} 3.32, fflate 0.8, lucide-vue-next 1.0, vitest 5 + jsdom, Tauri 2.12 (@tauri-apps/cli, api, plugin-dialog, plugin-fs).

**Spec:** `docs/superpowers/specs/2026-10-30-matex-editor-design.md`

## Global Constraints

- Plain JavaScript, Composition API, `<script setup>`. No TypeScript, router, Pinia or component kit.
- Document = Markdown + HTML + `src/styles/document.css` only. No canvas, nothing the print engine can't reproduce.
- Direction: Tiptap editor option `textDirection: 'auto'`. Never write `dir` into the Markdown.
- UI language English, base direction LTR.
- File: `.matex` = zip with `DOCUMENT.md` at root + `assets/<name>`. Markdown references `assets/<name>` relatively.
- No OS file association, no code signing.
- Interface testing happens in the browser (`npm run dev`), not in Tauri. The user tests the CI-built app by hand.
- Local Rust (1.74) is too old for Tauri 2. Don't run `tauri dev/build` locally; CI compiles.

## Review Focus

1. **Unsaved work lost on New/Open/close.** Expect a confirm before discarding a dirty document. Covered in Task 4 (browser check + `beforeunload` / Tauri `onCloseRequested`).
2. **Opening a non-MaTex or corrupt file.** Expect an error message and the current document left untouched. Covered by `unpack` tests (Task 3) and the browser check (Task 4).
3. **Images survive save → reopen.** A pasted image comes back after reopening; images deleted from the text aren't stored. Covered by `assets.test.js` (Task 3).
4. **Persian + English mixed paragraphs round-trip unchanged** with no `dir` attributes in the Markdown. Covered by `markdown.test.js` (Task 1).
5. **Unknown inline HTML in an opened file isn't silently dropped.** At minimum its text survives. Covered by `markdown.test.js` (Task 1).

---

### Task 1: Scaffold + editor core

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.js`, `src/App.vue`, `src/editor/extensions.js`, `src/styles/app.css`, `src/styles/document.css`
- Test: `tests/markdown.test.js`

**Interfaces:**
- Produces: `extensions` (array, `src/editor/extensions.js`) = StarterKit (link included, `openOnClick: false`), Image, TableKit, Markdown. Also `editorOptions` = `{ extensions, textDirection: 'auto', contentType: 'markdown' }`, spread into every `new Editor` / `useEditor`.
- Scripts: `dev` (vite), `build` (vite build), `test` (vitest run). Vitest `environment: 'jsdom'` set in `vite.config.js`.

- [ ] **Step 1: Init.** Write `package.json` (`"type": "module"`, `"private": true`, name `matex`, version `0.1.0`), then install the Tech Stack packages (Tauri ones in Task 5). `.gitignore`: `node_modules`, `dist`, `src-tauri/target`.

- [ ] **Step 2: Write the failing test** `tests/markdown.test.js`, with a helper `roundTrip(md)` that builds `new Editor({ ...editorOptions, content: md })` and returns `editor.getMarkdown()`:
  - `round-trips basics`: a fixture with `# H1`, `## H2`, a paragraph with `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[link](https://example.com)`, `- a`/`- b`, `1. a`/`2. b`, `> quote`, a fenced ```` ```js ```` block, `---`, `![alt](assets/fig.png)`, and a 2×2 pipe table. Assert `roundTrip(md).trim() === md.trim()`. If Tiptap normalises the syntax (e.g. `_italic_`, `***`), change the **fixture** to Tiptap's canonical form once, then pin it.
  - `keeps mixed Persian/English text`: `'سلام MaTex دنیا\n\nHello سلام'` round-trips exactly.
  - `sets dir=auto on blocks but not in markdown`: after mounting into a jsdom element, `editor.view.dom.querySelector('p').getAttribute('dir') === 'auto'`, and `getMarkdown()` doesn't contain `dir`.
  - `does not drop unknown inline html text`: `'Text <span class="x">kept</span> end'` gives Markdown that contains `kept` and `end`.

- [ ] **Step 3: Run** `npx vitest run tests/markdown.test.js`. Expected: FAIL (`extensions.js` missing).

- [ ] **Step 4: Implement** `src/editor/extensions.js`. `Markdown` comes from `@tiptap/markdown`, `TableKit` from `@tiptap/extension-table`, `Image` from `@tiptap/extension-image`. Set `TableKit.configure({ table: { resizable: false } })`, because column widths can't go into Markdown.

- [ ] **Step 5: Run** the tests. Expected: PASS. If unknown-HTML text is lost, add Tiptap's HTML handling option, or keep raw HTML as literal text. Note the chosen behaviour in a `ponytail:` comment.

- [ ] **Step 6: Minimal shell.** `App.vue` uses `useEditor({ ...editorOptions, content: '' })` + `<EditorContent>`, inside `<main class="desk"><article class="page">`. `document.css`: everything is scoped under `.page` (serif stack with Persian-capable fallbacks, e.g. `Georgia, "Times New Roman", Tahoma, serif`), A4-ish width `210mm` with `max-width: 100%`, padding `25mm 20mm`, white background, table borders, image `max-width: 100%`. Add `@media print` that hides the toolbar, drops the desk background and shadow, and sets `@page { size: A4; margin: 0 }`. `app.css`: grey desk, sticky top area, light/dark only for chrome (the page stays white).

- [ ] **Step 7: Browser check.** Run `npm run dev` and open it via chrome-devtools. Type `## Title` + space: it becomes an H2. Type `**b**`: it becomes bold. Type a Persian line, then an English line: they align right and left respectively.

- [ ] **Step 8: Commit** `Scaffold Vue editor with Markdown round-trip and auto direction`.

### Task 2: Toolbar

**Files:**
- Create: `src/components/EditorToolbar.vue`
- Modify: `src/App.vue` (mount it above the page)

**Interfaces:**
- Consumes: Tiptap `editor` instance (Task 1).
- Produces: `<EditorToolbar :editor @file="(action) => …" @image="…" />`, where `action` is one of `'new' | 'open' | 'save' | 'saveAs'` and `image` fires after the user has chosen an image `File` (payload: `File`). Task 4 wires both.

- [ ] **Step 1: Build the toolbar.** Left to right:
  - **File** dropdown: New, Open…, Save, Save As…, with shortcut hints.
  - Undo, Redo.
  - Block-type `<select>`: Paragraph, Heading 1–3, Code block. It reflects the current block.
  - Bold, Italic, Strike, Inline code.
  - Link: a small inline popover with a URL input plus Apply/Remove. **Don't use `window.prompt`**, because it doesn't work in Tauri webviews.
  - Bullet list, Numbered list, Quote, Horizontal rule.
  - Image: a hidden `<input type="file" accept="image/*">` that emits `image`.
  - **Table** dropdown: Insert 3×3, Add row, Add column, Delete row, Delete column, Delete table. Only Insert is enabled outside a table.

  Every button is a `<button>` with an icon (lucide-vue-next), `title` and `aria-label`, `aria-pressed` when the mark/node is active (`editor.isActive`), and is disabled when `editor.can()` says so. Add CSS hover/focus/active transitions. The toolbar wraps on narrow windows.

- [ ] **Step 2: Browser check.** Every button applies its format to a selection, and active states follow the cursor. Link popover: add and remove a link. Table: insert, add a row, delete. Check that Tab and Shift+Tab inside a list indent and outdent.

- [ ] **Step 3: Commit** `Add Docs-style editor toolbar`.

### Task 3: Archive + asset helpers

**Files:**
- Create: `src/utils/archive.js`, `src/utils/assets.js`
- Test: `tests/archive.test.js`, `tests/assets.test.js`

**Interfaces:**
- Produces (`archive.js`):
  - `pack({ markdown: string, files: Record<string, Uint8Array> }) → Uint8Array`: a zip with `DOCUMENT.md` (UTF-8) plus each `files` key as its path (keys look like `assets/x.png`).
  - `unpack(bytes: Uint8Array) → { markdown: string, files: Record<string, Uint8Array> }`: `files` holds only entries under `assets/`. It throws `Error('Not a MaTex document')` when the bytes aren't a zip or `DOCUMENT.md` is missing.
- Produces (`assets.js`): `createAssetStore()`, which returns:
  - `add(file: Blob, name?: string) → string blob URL`: stores the bytes under a unique, safe name. It lowercases, replaces anything outside `[a-z0-9._-]` with `-`, and on collision adds `-2`, `-3`… before the extension.
  - `load(markdown, files) → markdown`: clears the store, registers each `assets/<name>` under its own name, and returns Markdown where every image reference `assets/<name>` is replaced by its blob URL.
  - `collect(markdown) → Promise<{ markdown, files }>`: replaces each stored blob URL found in the Markdown with `assets/<name>`. `files` holds only the referenced assets.
  - `clear()`: revokes all URLs.
- Replace only inside link targets: after `](` or `src="` / `src='`, and followed by `)`, whitespace or a quote. Text that merely mentions `assets/x.png` stays as it is.

- [ ] **Step 1: Write the failing tests.**
  - `archive.test.js`:
    - `pack→unpack round-trips` Markdown with Persian text and a 3-byte `assets/a.png`.
    - `unpack rejects random bytes` and `unpack rejects zip without DOCUMENT.md`. Both expect `/Not a MaTex document/`.
  - `assets.test.js`:
    - `add gives unique safe names`: adding `My Fig.PNG` twice gives names `my-fig.png` and `my-fig-2.png`, which you can see through `collect` output keys.
    - `collect stores only referenced assets`: two added images with only one URL in the Markdown gives one file, and the Markdown contains `![x](assets/<name>)`.
    - `load then collect round-trips`: `load('![a](assets/a.png) see assets/a.png', {'assets/a.png': bytes})` turns the link into `blob:` and leaves the plain-text mention alone. Then `collect` returns the original Markdown and identical bytes.

- [ ] **Step 2: Run** `npx vitest run tests/archive.test.js tests/assets.test.js`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement.** Use fflate `zipSync` / `unzipSync`, and `strToU8` / `strFromU8`. Use `URL.createObjectURL` (Node 22 has it). Keep the map as `blobUrl → { name, blob }`.

- [ ] **Step 4: Run** all tests (`npm test`). Expected: PASS.

- [ ] **Step 5: Commit** `Add .matex archive and asset store helpers`.

### Task 4: File commands, images, unsaved-changes guard

**Files:**
- Create: `src/utils/platform.js`, `src/composables/useDocument.js`
- Modify: `src/App.vue`, `src/editor/extensions.js` (only if paste/drop needs editorProps there; otherwise keep it in App)

**Interfaces:**
- Consumes: `pack`, `unpack`, `createAssetStore` (Task 3), `editorOptions` (Task 1), and toolbar events (Task 2).
- Produces (`platform.js`, the only file that imports `@tauri-apps/*`, via dynamic `import()` so the browser build never loads them):
  - `isTauri`: `'__TAURI_INTERNALS__' in window`.
  - `openFile() → Promise<{ name, path: string|null, bytes: Uint8Array } | null>`.
    - Tauri: dialog `open({ filters: [{ name: 'MaTex', extensions: ['matex', 'zip'] }] })`, then fs `readFile`.
    - Browser: hidden `<input type=file accept=".matex,.zip">`.
    - `null` means the user cancelled.
  - `saveFile(bytes, { path, name, saveAs }) → Promise<{ name, path } | null>`.
    - Tauri: reuse `path` unless `saveAs` or there's no path, else dialog `save({ defaultPath: name, filters })`, then fs `writeFile`.
    - Browser: always download `name` through an `<a download>` and return `{ name, path: null }`.
  - `ask(message) → Promise<boolean>`: Tauri dialog `ask`, browser `window.confirm`.
  - `showError(message)`: Tauri dialog `message` with kind `error`, browser `window.alert`.
  - `setTitle(title)`: sets `document.title`, and in Tauri also `getCurrentWindow().setTitle`.
  - `onCloseRequest(isDirty: () => boolean)`.
    - Tauri: `onCloseRequested`, calling `preventDefault` unless `await ask(...)`.
    - Browser: `beforeunload` when dirty.
- Produces (`useDocument(editor)` in `src/composables/useDocument.js`) → `{ name, dirty, newDoc, openDoc, save, saveAs, insertImage(file) }`.
  - `name` defaults to `Untitled.matex`.
  - `dirty` becomes true on editor `update` and false after load/save.
  - New/Open ask `Discard unsaved changes?` when dirty.
  - Open runs `unpack`, then `assets.load`, then `editor.commands.setContent(md, { contentType: 'markdown' })`. On error it calls `showError(err.message)` and leaves the editor untouched.
  - Save runs `editor.getMarkdown()`, then `assets.collect`, then `pack`, then `saveFile`.
  - The title is `${dirty ? '• ' : ''}${name} — MaTex`, through `setTitle`.

- [ ] **Step 1: Implement `platform.js` and `useDocument.js`** to the interfaces above.

- [ ] **Step 2: Wire App.vue.**
  - Toolbar `@file` / `@image` call into `useDocument`.
  - `editorProps.handlePaste` / `handleDrop` turn image `File`s into `assets.add`, then `setImage({ src: url, alt: file.name })`. Non-image pastes fall through.
  - A window `keydown` listener handles Ctrl/Cmd+N, O, S and Shift+S with `preventDefault`. Ctrl+N stays browser-reserved in Chrome, which is fine.
  - Call `onCloseRequest(() => dirty.value)` once on mount.

- [ ] **Step 3: Browser check (chrome-devtools).**
  - Type text and paste/insert an image, then Save: a `.matex` file downloads.
  - Reopen it via Open: text and image come back, and the title has no `•`.
  - Edit: `•` appears. New: a confirm shows; cancel keeps the text.
  - Open a `.txt` renamed to `.matex`: an error shows and the document is unchanged.
  - Unzip the saved file in the shell: it has `DOCUMENT.md` + `assets/<name>`, and the Markdown references `assets/<name>`.

- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: tests pass and the build succeeds with no `@tauri-apps` errors.

- [ ] **Step 5: Commit** `Add open/save of .matex files with image assets`.

### Task 5: Tauri shell + release workflow + docs

**Files:**
- Create:
  - `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
  - `src-tauri/icons/*` (generated), `app-icon.png`
  - `.github/workflows/release.yml`
- Modify: `package.json` (add `@tauri-apps/cli` dev dep, `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`; script `"tauri": "tauri"`), `CHANGELOG.md`, `~/.claude/CLAUDE.md` (component index)

**Interfaces:**
- Consumes: the `npm run build` output in `dist/`.

- [ ] **Step 1: Write the Tauri files.**
  - `lib.rs` registers `tauri_plugin_dialog::init()` and `tauri_plugin_fs::init()`.
  - `tauri.conf.json`:
    - `productName` `MaTex`, `identifier` `com.aryakvn.matex`, `version` `0.1.0`.
    - `build.frontendDist` `../dist`, `devUrl` `http://localhost:1420`, `beforeBuildCommand` `npm run build`, `beforeDevCommand` `npm run dev`.
    - Window `title` `MaTex`, size 1100×800.
    - `bundle.targets` `["deb", "app", "msi", "nsis"]`.
  - The capability `default` covers the main window with: `core:default`, `core:window:allow-set-title`, `core:window:allow-destroy`, `dialog:default`, `fs:allow-read-file`, `fs:allow-write-file`, and an fs scope that allows `**` (paths come only from the user's own dialog choices).

- [ ] **Step 2: Icons.** Write a simple `app-icon.png` (an "M" on a page), then run `npx tauri icon app-icon.svg`. Expected: `src-tauri/icons/` holds png/ico/icns.

- [ ] **Step 3: Workflow** `.github/workflows/release.yml`.
  - Triggers: `push` tags `v*` and `workflow_dispatch`. Permissions: `contents: write`.
  - Matrix:
    - `ubuntu-22.04`: apt `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.
    - `macos-latest`: args `--target universal-apple-darwin`, rust targets `aarch64-apple-darwin,x86_64-apple-darwin`.
    - `windows-latest`.
  - Steps: checkout, setup-node 22 with npm cache, `dtolnay/rust-toolchain@stable`, `swatinem/rust-cache` (workspace `./src-tauri -> target`), `npm ci`, `tauri-apps/tauri-action@v0` with `tagName: ${{ github.ref_name }}`, `releaseName: 'MaTex ${{ github.ref_name }}'`, `releaseDraft: true`.
  - For `workflow_dispatch` (no tag), upload the bundles with `actions/upload-artifact` instead of a release. Gate the release inputs on `startsWith(github.ref, 'refs/tags/')`.

- [ ] **Step 4: Validate.** Run `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json'))"` (and the same for the capability). Run `npx tauri info`, which should list the config without errors; ignore warnings about the Rust version. Run `npm test && npm run build`. Expected: everything passes.

- [ ] **Step 5: Docs.**
  - `CHANGELOG.md`, under `## [Unreleased]` → `### Added`, one line each: the editor (Markdown shortcuts, toolbar, per-paragraph direction), the `.matex` format, the release workflow.
  - Global `~/.claude/CLAUDE.md` Component index: add a `### MaTex (E:/Projects/MaTex)` section with one-liners for `editorOptions`, `EditorToolbar`, `useDocument`, `createAssetStore`, `pack`/`unpack`, and `platform.js`.

- [ ] **Step 6: Commit** `Add Tauri shell and GitHub release workflow`.
