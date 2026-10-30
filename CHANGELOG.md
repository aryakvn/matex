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
- Add WYSIWYG editor: Markdown typed as you write becomes formatting, Docs-style toolbar (text style, bold/italic/strike/code, links, lists, quotes, divider, images, tables).
- Detect text direction per paragraph so Persian and English can be mixed in one document.
- Add `.matex` documents: a zip with `DOCUMENT.md` plus `assets/` for images; New, Open, Save, Save as with Ctrl/Cmd shortcuts and an unsaved-changes guard.
- Add Tauri desktop shell and GitHub Actions build for `.deb`, macOS `.app`, Windows `.msi` and `.exe` (draft release on `v*` tags).
- Add README (project story, file format, development and release steps) and TODOS roadmap.
- Add CLAUDE.md with commands and architecture notes for Claude Code.
- Add auto table of contents (toolbar button, saved as `[TOC]`) listing all headings live; each entry's "…" menu excludes or re-includes that heading, saved as `## Title {.unlisted}`.
- Show a dot leader and printed page number after each table of contents entry; pages are estimated from the A4 layout and update as the document changes.
- Lay the document out on separate A4 sheets like Microsoft Word: text flows from sheet to sheet, paragraphs split at line level, headings stay with the next block, margins repeat on every sheet, and each sheet prints as exactly one page. Table of contents page numbers now come from these page breaks.

### Changed
- Excluded headings now leave the table of contents on screen too (it shows what will print); bring them back from the excluded-headings menu beside the title.
- Restyle app chrome after Microsoft Fluent 2: grey canvas, title strip with app icon, file name and unsaved state, floating rounded command bar, Fluent dropdown, menus, inputs and buttons in light and dark.
