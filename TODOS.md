# TODOs

MaTex exists because writing a Persian thesis offline on Linux, with your own fonts, shouldn't be hard (see [README](README.md#why)). It's for programmers: Markdown and HTML for content, CSS for looks. Items are roughly in priority order within each section.

## Next: the reason this project exists

- [ ] **Custom fonts.** Let a document use any font file (e.g. Vazirmatn, B Nazanin, IRANSans).
  - Store font files inside the `.matex` archive (`assets/fonts/`) and load them with `@font-face`, so the document prints the same on any machine.
  - [x] Font picker per paragraph style, with separate Latin and Persian fonts (Styles panel). Fonts must still be installed.
- [ ] **Per-document CSS.** Add a `style.css` inside the `.matex` archive, applied on top of `document.css`.
  - Edit it in an in-app CSS editor with live preview.
  - This is the programmer feature: page size, margins, heading numbering, and how tables and code look are all just CSS.
- [ ] **Print / PDF.** Print the page through the webview's print engine using `document.css` + `style.css`.
  - Support `@page` margins, page breaks (`break-before`), and running headers/footers where the engine supports them.
- [ ] **Base direction per document.** Choose RTL for mostly-Persian documents, so new empty lines start on the right.
- [ ] **Persian-friendly defaults.** Bundle one good Persian font as the default, and handle Persian digits and ZWNJ (half-space) input.

## Later

- [ ] Math (KaTeX or MathJax, saved as `$…$` / `$$…$$` in Markdown).
- [ ] Page layouts and templates (thesis, article, book).
- [ ] Footnotes, citations and bibliography.
- [ ] Multi-file books (chapters as separate files in one project).
- [ ] Export to PDF / HTML / DOCX.
- [ ] Raw Markdown/HTML source view for the times you want it.
- [ ] Double-click a `.matex` file to open it (OS file association, single instance).
- [ ] Persian UI translation.
- [ ] Code signing for macOS and Windows builds.

## Check on the built apps

Nobody has run these yet. They work in the browser, but are untested in the Tauri builds.

- [ ] macOS: Cmd+Q with unsaved changes. Does it ask before quitting? If not, handle `RunEvent::ExitRequested` in `src-tauri/src/lib.rs`.
- [ ] macOS: does the unsigned app open with "unknown developer", or say "damaged"? If "damaged", set `bundle.macOS.signingIdentity: "-"`.
- [ ] Windows: dropping an image file onto the page inserts it.
- [ ] Linux: pasting an image from the clipboard works under WebKitGTK.
- [ ] All: Open and Save work with real paths, including Save after Save as.

## Known small issues

- [ ] A Persian image file name (`تصویر.png`) is saved as `.png`. Fall back to `image` when the safe name is empty.
- [ ] A reopened SVG image doesn't render (the blob has no MIME type). Infer the type from the extension.
- [ ] A `]` in an image's file name breaks its Markdown alt text. Escape it.
- [ ] Several images dropped at once land in reverse order.
- [ ] Saving overwrites the file in place, so a crash mid-save can corrupt it. Write to a temp file, then rename.
- [ ] Pressing Ctrl+S twice quickly on an untitled document opens two Save dialogs. Add an in-flight guard.
- [ ] The link box rejects `example.com` and `#anchor` (`type="url"`).
- [ ] The macOS app from a manual workflow run won't launch: `upload-artifact` drops the executable bit. Tag releases are fine.
- [ ] `csp: null` lets opened documents load remote images. Add a CSP such as `img-src 'self' blob: data: https:`.
- [ ] `<` and `&` are saved as `&lt;` and `&amp;`.
- [ ] Tab in the empty line after a list pulls it into the last list item.
- [ ] HTML the editor doesn't know about loses its tags on save; the text is kept. Affected so far:
  - `<span>`, `<div align>`, `<mark>`
  - comments and `<details>`
  - task-list checkboxes
  - footnotes

  Add a node or mark for each one as the toolbar learns to make it.
