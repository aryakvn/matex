<script setup>
// Side panel content: the document's own CSS (layout.css, saved as style.css), applied live to the
// page and in print (scopeCss in utils/styles.js).
// addRule(selector) is how the page's "…" menu adds `#id { }` and puts the cursor in it.
import { ref } from 'vue'
import CodeEdit from './CodeEdit.vue'

const css = defineModel({ type: String, default: '' })
defineProps({ showHelp: { type: Boolean, default: false } })

const code = ref(null)

// An edit in Monaco, so Ctrl+Z there takes it back out.
async function addRule(selector) {
  const editor = await code.value.ready()
  const model = editor.getModel()
  const head = `${selector} {`
  let found = model.findNextMatch(head, { lineNumber: 1, column: 1 }, false, true, null, false)
  if (!found) {
    const text = model.getValue().replace(/\s+$/, '')
    const end = model.getPositionAt(text.length)
    const range = { startLineNumber: end.lineNumber, startColumn: end.column, endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()) }
    editor.executeEdits('add-rule', [{ range, text: `${text ? '\n\n' : ''}${head}\n  \n}\n` }])
    found = model.findNextMatch(head, { lineNumber: 1, column: 1 }, false, true, null, false)
  }
  // Inside the rule: the indented line under its head.
  const line = found.range.startLineNumber + 1
  editor.setPosition({ lineNumber: line, column: model.getLineMaxColumn(line) })
  editor.focus()
  // The editor grows with its text and never scrolls, so the panel does.
  const body = editor.getDomNode().closest('.side-body')
  const host = editor.getDomNode().parentElement
  if (body) body.scrollTop = host.offsetTop + editor.getTopForLineNumber(line) - body.clientHeight / 2
}
defineExpose({ addRule })

const CLASSES = [
  ['.paragraph', 'Normal text'],
  ['.heading .heading-1 … .heading-6', 'Headings'],
  ['.persian', 'Right-to-left blocks, and span.persian for every Persian run'],
  ['.bold .italic .strike .underline .code .link', 'Text formatting'],
  ['.bullet-list .ordered-list .list-item', 'Lists'],
  ['.blockquote .code-block .horizontal-rule .image', 'Blocks'],
  ['.table .table-row .table-header .table-cell', 'Tables'],
  ['.toc .toc-title .toc-item .toc-l1 .toc-page', 'Table of contents'],
  ['.note .footnote .reference', 'Note markers in the text'],
  ['.fn-area .fn-item .references .refs-item', 'Footnotes at the sheet bottom, References list'],
  ['.sheet .hf-header .hf-footer .hf-slot', 'Sheets, headers and footers'],
  ['.span', 'Text you gave an id with …'],
  ['.html-block', 'HTML blocks (</> button)'],
]
const IDS = [
  ['#paragraph-3', 'The 3rd paragraph. Every element has one: #heading-2-1, #list-item-4, #persian-5, #footnote-2'],
  ['#sheet-2 #header-2-left #footer-1-center #footnotes-2', 'Per sheet'],
  ['#toc-entry-3 #footnote-text-1 #reference-text-1', 'Rows of the lists'],
]
</script>

<template>
  <div v-if="showHelp" class="ref-text">
    <p>
      This CSS styles the document, on screen and in print, and is saved with it. Rules apply inside the
      page only and win over the Styles panel. Write <code>&amp;</code> for the page itself
      (<code>&amp; { --x: 1 }</code>); <code>@page</code> and <code>@font-face</code> work as usual.
    </p>
    <p>
      Numbered ids follow the order of the document, so they move when you add blocks above. To pin one,
      select the text in the page and choose <b>…</b> → <b>Style in CSS</b>: the selection gets an id of its
      own, saved in the Markdown as <code>text {#id}</code> or <code>[words]{#id}</code>.
    </p>
  </div>
  <p v-else class="ref-hint">Select text in the page and press … to add its id here.</p>

  <CodeEdit ref="code" v-model="css" language="css" label="Document CSS" placeholder=".heading-1 { color: #0f6cbd; }" />

  <template v-if="showHelp">
    <h3 class="ref-h">Classes</h3>
    <dl class="ref-list">
      <template v-for="[sel, about] in CLASSES" :key="sel">
        <dt><code>{{ sel }}</code></dt>
        <dd>{{ about }}</dd>
      </template>
    </dl>
    <h3 class="ref-h">Ids</h3>
    <dl class="ref-list">
      <template v-for="[sel, about] in IDS" :key="sel">
        <dt><code>{{ sel }}</code></dt>
        <dd>{{ about }}</dd>
      </template>
    </dl>
  </template>
</template>
