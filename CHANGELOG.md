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
