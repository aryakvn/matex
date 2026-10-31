<script setup>
// Side panel content: the document's own CSS (layout.css, saved in page.json), applied live to the
// page and in print (scopeCss in utils/styles.js). A textarea laid over a highlighted copy of its
// text (highlight.js), so it reads like a code editor without bundling one.
// addRule(selector) is how the page's "…" menu adds `#id { }` and puts the cursor in it.
import { ref, computed } from 'vue'
import hljs from 'highlight.js/lib/core'
import cssLanguage from 'highlight.js/lib/languages/css'

hljs.registerLanguage('css', cssLanguage)

const css = defineModel({ type: String, default: '' })
defineProps({ showHelp: { type: Boolean, default: false } })

const area = ref(null)
// The trailing newline keeps the copy as tall as the textarea when the text ends in one.
const html = computed(() => `${hljs.highlight(css.value, { language: 'css' }).value}\n`)

// Tab indents instead of leaving the field (Esc closes the panel). insertText keeps Undo working.
function indent() {
  if (!document.execCommand('insertText', false, '  ')) area.value.setRangeText('  ', area.value.selectionStart, area.value.selectionEnd, 'end')
}

// Typed into the textarea (not set through v-model, which lands a tick later and moves the cursor),
// so Ctrl+Z takes it back out.
function addRule(selector) {
  const el = area.value
  const head = `${selector} {`
  let caret = el.value.indexOf(head)
  el.focus()
  if (caret >= 0) caret += head.length
  else {
    const end = el.value.replace(/\s+$/, '').length
    const text = `${end ? '\n\n' : ''}${head}\n  \n}\n`
    el.setSelectionRange(end, el.value.length)
    if (!document.execCommand('insertText', false, text)) {
      el.setRangeText(text, end, el.value.length)
      css.value = el.value
    }
    caret = el.value.length - 3
  }
  el.setSelectionRange(caret, caret)
  // A textarea that grows with its text never scrolls, so the panel does.
  const lines = css.value.slice(0, caret).split('\n').length
  const body = el.closest('.side-body')
  if (body) body.scrollTop = el.offsetTop + lines * parseFloat(getComputedStyle(el).lineHeight) - body.clientHeight / 2
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

  <div class="css-edit">
    <pre class="css-code" aria-hidden="true" v-html="html" />
    <textarea
      ref="area" v-model="css" class="css-input" aria-label="Document CSS" spellcheck="false"
      autocomplete="off" autocapitalize="off" placeholder=".heading-1 { color: #0f6cbd; }"
      @keydown.tab.exact.prevent="indent"
    />
  </div>

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
