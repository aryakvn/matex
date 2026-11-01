# Changelog

<!--
Maintained for both humans and Claude Code to reference. Before
implementing a feature or fix, check the entries below first — it may
already be done, which saves searching the whole codebase.

Format (based on Keep a Changelog: https://keepachangelog.com/en/1.1.0/):
- New entries go under "## [Unreleased]" until a release is cut.
- Categories: Added, Changed, Fixed, Deprecated, Removed, Security.
  Only add a category heading once it has an entry under it.
- One bullet per entry, imperative mood, one line where possible:
    - Add CSV export to the reports page. (Refs: JIRA-482, #210)
- Include "(Refs: ...)" only when there's an external reference — a Jira
  key, GitHub issue/PR number, Trello card title/URL, or similar tracker
  ID. Comma-separate multiple references. Omit the parenthetical entirely
  if there's nothing to reference.
- To cut a release: rename "## [Unreleased]" to "## [X.Y.Z] - YYYY-MM-DD"
  and start a fresh, empty "## [Unreleased]" section above it.
- Never delete or rewrite past entries — only append.
-->

## [Unreleased]

### Added
- Add header, footer and page numbers (File → Page setup…): text in left/centre/right slots with `{page}`/`{pages}`, adjustable heights (which are the page margins) and text size, number position, format, start value, Persian digits, skip first page. Saved as `page.json` in the `.matex` archive.
- Add WYSIWYG editor: Markdown typed as you write becomes formatting, Docs-style toolbar (text style, bold/italic/strike/code, links, lists, quotes, divider, images, tables).
- Detect text direction per paragraph so Persian and English can be mixed in one document.
- Add `.matex` documents: a zip with `DOCUMENT.md` plus `assets/` for images; New, Open, Save, Save as with Ctrl/Cmd shortcuts and an unsaved-changes guard.
- Add Tauri desktop shell and GitHub Actions build for `.deb`, macOS `.app`, Windows `.msi` and `.exe` (draft release on `v*` tags).
- Add README (project story, file format, development and release steps) and TODOS roadmap.
- Add CLAUDE.md with commands and architecture notes for Claude Code.
- Add auto table of contents (toolbar button, saved as `[TOC]`) listing all headings live; each entry's "…" menu excludes or re-includes that heading, saved as `## Title {.unlisted}`.
- Show a dot leader and printed page number after each table of contents entry; pages are estimated from the A4 layout and update as the document changes.
- Lay the document out on separate A4 sheets like Microsoft Word: text flows from sheet to sheet, paragraphs split at line level, headings stay with the next block, margins repeat on every sheet, and each sheet prints as exactly one page. Table of contents page numbers now come from these page breaks.
- Add syntax highlighting to code blocks (highlight.js common languages, bundled for offline use): the language comes from the Markdown fence (```js), blocks without one are auto-detected; colours print.
- Add left-to-right and right-to-left buttons (¶ arrows, like Word) that force a paragraph's or heading's direction over auto-detection; press the lit one again to return to auto. New lines keep the direction, and it is saved as an invisible LRM/RLM mark at the start of the line, which GitHub and other viewers also respect.
- Edit the header and footer in place like Microsoft Word: double-click a sheet's top or bottom margin to type into its left/centre/right slots (the body dims), double-click the body or press Esc to go back.
- Make each header/footer slot a rich editor: the main toolbar formats the focused slot (bold, links, lists, images, tables...); slots are saved as Markdown, and their images go into `assets/` like the body's.
- Run JavaScript in header/footer text with `{{ code }}` (variables `page`, `pages`, `number`, `title`, `date`; an expression or statements with `return`), filled in per page. Opening a document whose header or footer has scripts asks before running them.
- Add a right-hand side panel for tools, opened from the toolbar; the first one, Header & footer scripts (`{ }` button), lists the `{{ }}` variables with this page's values, syntax and examples, each with an Insert button for the header/footer being edited.
- Dock the side panel beside the pages instead of floating over them: the page area makes room and the page keeps its A4 width (a window too narrow for both scrolls the pages sideways). A ? button in the panel's header shows its help text.
- Add a ? button to the Header/Footer tag shown while editing; it opens the side panel with the script help showing. The panel stays closed until asked for.
- Add a Styles panel (Aa button), like Word's Styles gallery: Normal, Heading 1–3 and Code, each tile drawn in its own fonts; click to apply, pencil to change. Each style has a Latin font and a separate Persian font with its own size (e.g. Times New Roman 12 + B Nazanin 14), plus bold, italic and colour. Persian text in the page, headers/footers and table of contents gets the Persian font. Font boxes suggest common fonts and, where the webview allows, the installed ones. Saved in `page.json`.
- Add footnotes and references, Wikipedia style (x² toolbar menu). A footnote shows as a superscript number and prints at the bottom of the sheet its marker is on, above the footer and under a short divider; the page breaks make room for it, and you type and edit it right there. A reference shows as a superscript `[1]`; citing the same source again reuses its number, and a References list (saved as `[REFERENCES]`) can go anywhere in the document. Clicking any marker or References entry opens a popup to edit or delete it. Both are numbered automatically, Persian notes read right-to-left, and they are saved as standard Markdown footnotes (`[^1]` / `[^ref-1]` with `[^1]: text` lines at the end).
- Give every element of the document a class named after what it is (`.paragraph`, `.heading.heading-1`, `.list-item`, `.code-block`, `.table-cell`, `.bold`, `.link`, `.toc-item`, `.note.footnote`...) and a unique id (`#paragraph-3`, `#heading-2-1`, `#persian-5`, `#sheet-2`, `#footer-1-center`, `#toc-entry-3`...). Right-to-left blocks get `.persian` (`.heading-1.persian`), and Persian runs are `span.persian`.
- Add a CSS panel (code-file button): the document's own CSS with syntax colours, applied live inside the page and in print, saved as `style.css` in the `.matex` archive. Rules win over the Styles panel; `&` is the page; `@page` and `@font-face` work.
- Add a "…" button over any selection in the page; its "Style in CSS" pins the selection's id and opens the CSS panel with a `#id { }` rule ready to fill. Part of a line becomes a span saved as `[words]{#id}`; whole paragraphs and headings are saved as `text {#id}` / `## Title {#id}` (Pandoc attributes).

- Add HTML blocks (</> button): raw HTML between paragraphs, drawn live in the page and saved in the Markdown exactly as written. Click one to edit its code in a popup under it. It is always sanitized when drawn (no scripts, event handlers or `<style>`), so opening someone else's document can't run code; style it from the CSS panel (`.html-block`).
- Add paper size (A3, A4, A5, B5, Letter, Legal), landscape orientation, left/right margins and 1–4 columns to Page setup; top/bottom margins are now set there too. Columns fill each sheet in order and need Chromium 145+ (the Windows app); the macOS and Linux apps show one column for now.
- Add sections, like Word's "next page" section breaks (columns button in the toolbar): each section starts on a new sheet and has its own number of columns, and "Style this section in CSS" gives it an id and opens a `#id { }` rule, so a few pages can be one column and the next two columns with their own styling. Saved as Pandoc fenced divs (`::: {#appendix .section columns=2}` … `:::`); a document with one plain section stays plain Markdown. With more than one section, a small "Section N" tag shows above each on screen (not printed). Backspace at a section's start or "Remove section break" joins it to the one before.
- Add captions and cross-references for images, tables and HTML blocks (captions button): select one and «Add caption» puts `fig-1: ` (`tbl-1`, `shape-1`) under it; the text before the first `:` is the label (bold). Refer to a caption from the same menu or by typing `[IMG-1]` / `[TBL-1]` / `[SHP-1]`; the reference shows the caption's label and follows when the label is renamed (`??` if the caption is gone). Saved as `: fig-1: text {#IMG-1}` under the media and `[IMG-1]` in the text.
- Make the table of contents title editable: click it and type (e.g. «فهرست مطالب»). Saved as `[TOC: Title]`; the default "Contents" still saves as `[TOC]`.
- Add a Word-style status bar at the bottom of the window: the page the cursor is on ("Page 2 of 5") and the document's word count.
- Add picture tools: select an image for a Picture group in the ribbon (width as % of the text column, align left/center/right, grayscale/sepia/invert filters, brightness and contrast sliders, flip, reset) and corner handles to drag-resize it. Saved as a Pandoc attribute block after the image (`![a](assets/a.png){width=50% .center .sepia brightness=120%}`); unknown items in it are kept.
- Add text wrapping around images (Wrap text button in the Picture group): the image floats to its left or right side and text flows beside it; its caption floats with it at the same width. Turning it on picks the paragraph's start side and a 40% width if none was set; centring ends it. Saved as `.wrap` (`{width=40% .right .wrap}`).
- Tint the Picture group of the ribbon a washed-out violet (its own `--context*` tokens, light and dark), like Word's coloured contextual tabs, so it stands out while an image is selected.
- Add image rotation (rotate left/right 90° in the Picture group). The turn is drawn into the image itself as a new asset (`photo-rot90.jpg`), so the image takes the right room on the page and shows turned in any Markdown viewer. Each turn is redrawn from the original (no repeated JPEG re-compression within a session), and turning back to 0° gives the original file. JPEG and WebP stay in their format; others, SVG included, become PNG. Images from the web can't be rotated.
- Add zoom (25–300%): slider, −/+ and a reset-to-100% button at the right of the status bar, plus Ctrl + = / - / 0 and Ctrl + mouse wheel. The pages are scaled on screen only, so lines and page breaks stay exactly as printed; the window scrolls sideways when zoomed past its width (also at 100% in a narrow window, instead of squeezing the page).
- Add Mermaid charts (Chart button in Insert): flowcharts, sequence, pie, gantt and other diagrams, drawn live and printed as vector graphics; the code is edited in a popup under the chart, which also shows syntax errors (the page keeps the last chart that drew). Charts are centred and never taller than a sheet's text area. Saved as a ```mermaid fence, so any Markdown viewer that knows Mermaid draws it too. Charts can be captioned as figures. Mermaid loads on the first chart only and runs in strict mode (no scripts or click handlers).
### Changed
- Replace the app icon with the new MaTex logo (desktop icons regenerated from `app-icon.png`, browser favicon, title strip) and show it at the top of the README.
- Excluded headings now leave the table of contents on screen too (it shows what will print); bring them back from the excluded-headings menu beside the title.
- Restyle app chrome after Microsoft Fluent 2: grey canvas, title strip with app icon, file name and unsaved state, floating rounded command bar, Fluent dropdown, menus, inputs and buttons in light and dark.
- Rename the Persian-run class from `.fa` to `.persian`.
- The number of columns is set per section (toolbar's columns menu) instead of in Page setup; Page setup keeps the gap between columns.

- The CSS panel and HTML blocks edit code in Monaco (the VS Code editor) with CSS/HTML autocomplete, hover docs, colour swatches and checks; loaded the first time a code field opens, and works offline.
- A section's CSS background now fills its whole sheets, margins included (and prints), instead of only the text area.
- The toolbar is a Word-style ribbon: a menu row (File) on top, then Undo, Font, Paragraph, Insert and Layout groups, each two rows of buttons with a caption underneath.
- Closer to Office 2023 / Fluent 2: the document name is centred in the title bar, File is a Fluent tab (underline indicator on hover and while open), ribbon group dividers stop short of the edges, icons are drawn thinner, and scrollbars are thin.
- Side panels slide in and out, pushing the pages aside smoothly, instead of the pages jumping to make room when one opens or closes.
### Fixed
- Pasting text copied from a MaTex document no longer starts a new section; it joins the section it is pasted into.
- Stop code block backgrounds and quote borders from running through the bottom margin and the gap between sheets when they split across pages.
- Let a code block or quote split across pages run through both sheets' margins, clearing only the gap between sheets.
- Align page breaks to line boxes instead of glyph boxes, so the sheet gap over a split code block or quote sits exactly on the gap between sheets and each sheet's text starts exactly at its top margin.
- Make the left-to-right / right-to-left buttons work in bulleted and numbered lists: the list item now takes the direction, so its bullet or number and indent move to that side (also when reopened).
- Lists and the table of contents now read in the direction of their first item: a list starting with Persian puts every bullet or number on the right (and one starting with English on the left), unless an item's direction is set by hand. Before, both were always left to right, because `dir="auto"` skips child elements that have their own direction.
- Keep a caption on the same sheet as its image or table; a figure near a sheet's bottom no longer leaves its caption on the next one.
- Fix Done/Esc in an HTML block's code popup doing nothing when the block was the last thing in the document (the node view's Vue proxy made ProseMirror think the block was two positions long); it now adds a paragraph after the block when nothing follows it.
- Fix the first keys typed right after inserting an HTML block replacing the block with text: focus moves into the code field at once, before Monaco has loaded.
- Fix code fields (CSS panel, HTML blocks) writing Windows line endings (CRLF) into the saved document; they always use LF.
