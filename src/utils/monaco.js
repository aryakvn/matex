// Monaco (the VS Code editor) for the app's code fields, loaded on first use by CodeEdit.vue.
// Only what CSS and HTML need, not editor.main (which bundles TypeScript and JSON, ~15 MB):
// the core, editing contributions, and the CSS/HTML language services with their completions,
// hover docs and checks. Their workers are bundled by Vite, so everything works offline.
import * as monaco from 'monaco-editor/editor/editor.api.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker'
import 'monaco-editor/editor/browser/coreCommands.js'
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js'
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js'
import 'monaco-editor/editor/contrib/colorPicker/browser/colorPickerContribution.js'
import 'monaco-editor/editor/contrib/comment/browser/comment.js'
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js'
import 'monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo.js'
import 'monaco-editor/editor/contrib/find/browser/findController.js'
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js'
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js'
import 'monaco-editor/editor/contrib/linkedEditing/browser/linkedEditing.js'
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js'
import 'monaco-editor/editor/contrib/placeholderText/browser/placeholderText.contribution.js'
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js'
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js'
import 'monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter.js'
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js'
import 'monaco-editor/languages/definitions/css/register.js'
import 'monaco-editor/languages/definitions/html/register.js'
import { cssDefaults } from 'monaco-editor/languages/features/css/register.js'
import 'monaco-editor/languages/features/html/register.js'

// One worker per language service (its completions and checks), plus the editor's own.
self.MonacoEnvironment = {
  getWorker: (_, label) => (label === 'css' ? new CssWorker() : label === 'html' ? new HtmlWorker() : new EditorWorker()),
}

// Ids are how this app targets one element (… → Style in CSS), so don't warn about them.
cssDefaults.setOptions({ ...cssDefaults.options, lint: { ...cssDefaults.options.lint, idSelector: 'ignore' } })

// Follow the system theme like the rest of the app (app.css). The theme is global to Monaco.
const dark = matchMedia('(prefers-color-scheme: dark)')
const theme = () => monaco.editor.setTheme(dark.matches ? 'vs-dark' : 'vs')
theme()
dark.addEventListener('change', theme)

export default monaco
