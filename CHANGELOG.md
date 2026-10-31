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

### Changed
- Replace the app icon with the new MaTex logo (desktop icons regenerated from `app-icon.png`, browser favicon, title strip) and show it at the top of the README.
- Excluded headings now leave the table of contents on screen too (it shows what will print); bring them back from the excluded-headings menu beside the title.
- Restyle app chrome after Microsoft Fluent 2: grey canvas, title strip with app icon, file name and unsaved state, floating rounded command bar, Fluent dropdown, menus, inputs and buttons in light and dark.

### Fixed
- Stop code block backgrounds and quote borders from running through the bottom margin and the gap between sheets when they split across pages.
- Let a code block or quote split across pages run through both sheets' margins, clearing only the gap between sheets.
- Align page breaks to line boxes instead of glyph boxes, so the sheet gap over a split code block or quote sits exactly on the gap between sheets and each sheet's text starts exactly at its top margin.
- Make the left-to-right / right-to-left buttons work in bulleted and numbered lists: the list item now takes the direction, so its bullet or number and indent move to that side (also when reopened).
