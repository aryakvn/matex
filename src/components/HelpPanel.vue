<script>
// Help menu topics, in the order the panel shows them. Each key is a section id below (help-<key>).
export const HELP_TOPICS = [
  { key: 'start', title: 'Getting started' },
  { key: 'writing', title: 'Writing with Markdown' },
  { key: 'persian', title: 'Persian and English' },
  { key: 'styles', title: 'Text styles and fonts' },
  { key: 'media', title: 'Pictures, tables, charts and equations' },
  { key: 'notes', title: 'Footnotes, references and captions' },
  { key: 'pages', title: 'Pages, sections and columns' },
  { key: 'header', title: 'Header, footer and page numbers' },
  { key: 'css', title: 'Styling with CSS and HTML' },
  { key: 'keys', title: 'Keyboard shortcuts' },
]
</script>

<script setup>
// The Help side panel: how to use MaTex, one section per Help menu topic. show(key) scrolls to one.
import { ref } from 'vue'
import { version } from '../../package.json'

const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'
const root = ref(null)

function show(key) {
  const el = root.value?.querySelector(`#help-${key}`)
  const box = root.value?.closest('.side-body')
  if (el && box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top
}
defineExpose({ show })

const keys = [
  ['New / Open', `${mod}N / ${mod}O`],
  ['Save / Save as', `${mod}S / ${mod}Shift+S`],
  ['Print', `${mod}P`],
  ['Undo / Redo', `${mod}Z / ${mod}Y`],
  ['Bold / Italic', `${mod}B / ${mod}I`],
  ['Strikethrough', `${mod}Shift+X`],
  ['Inline code', `${mod}E`],
  ['Line break in the same paragraph', 'Shift+Enter'],
  ['Indent / outdent a list item', 'Tab / Shift+Tab'],
  ['Zoom in / out / 100%', `${mod}= / ${mod}- / ${mod}0`],
  ['Zoom with the mouse', `${mod}wheel`],
  ['Leave a header, footer or popup', 'Esc'],
]
</script>

<template>
  <div ref="root" class="help">
    <nav aria-label="Help topics">
      <ul class="help-toc">
        <li v-for="t in HELP_TOPICS" :key="t.key"><a :href="`#help-${t.key}`" @click.prevent="show(t.key)">{{ t.title }}</a></li>
      </ul>
    </nav>

    <section id="help-start">
      <h3 class="ref-h">Getting started</h3>
      <p>MaTex is a word processor that saves Markdown. Type on the page; the ribbon and the Edit and Insert menus format what you select.</p>
      <p>File → New, Open, Save and Save as work on <code>.matex</code> files. A <code>.matex</code> file is a zip holding <code>DOCUMENT.md</code> (the text), <code>style.css</code> (your CSS), <code>page.json</code> (page setup and styles) and <code>assets/</code> (the images). Rename it to <code>.zip</code> to look inside.</p>
      <p>The title bar shows the file name and "Unsaved changes" until you save. MaTex asks before closing or opening another file over unsaved work.</p>
      <p>File → Print… prints the pages exactly as they look on screen, one sheet per page, without the app around them. To get a PDF, pick a PDF printer in the print dialog.</p>
      <p>The status bar shows the page the cursor is on, the word count and the zoom. Zoom only changes the screen; lines and page breaks stay as they print.</p>
    </section>

    <section id="help-writing">
      <h3 class="ref-h">Writing with Markdown</h3>
      <p>Markdown you type turns into formatting at once:</p>
      <ul class="help-list">
        <li><code># </code>, <code>## </code>, <code>### </code> at a line's start: heading 1–3</li>
        <li><code>**bold**</code>, <code>*italic*</code>, <code>~~strike~~</code>, <code>`code`</code></li>
        <li><code>- </code> or <code>1. </code>: bulleted or numbered list</li>
        <li><code>&gt; </code>: quote; <code>---</code>: divider line</li>
        <li><code>```js</code> + Enter: code block, coloured for that language</li>
        <li><code>```mermaid</code> + Enter: chart</li>
        <li><code>$$x^2$$</code>: inline equation; <code>$$$x^2$$$</code> on its own line: equation block</li>
      </ul>
      <p>To write text that looks like Markdown (a line starting with <code>#</code>), just type it; MaTex escapes it when saving.</p>
    </section>

    <section id="help-persian">
      <h3 class="ref-h">Persian and English</h3>
      <p>Each paragraph takes its direction from its first letter: Persian reads right to left, English left to right, and English words inside Persian text stay in order.</p>
      <p>When the first letter guesses wrong, use the ¶ buttons (Paragraph group, or Edit → Left-to-right / Right-to-left text). Press the lit one again to go back to automatic.</p>
      <p>Persian text gets its own font and size, set per style in the Styles panel.</p>
    </section>

    <section id="help-styles">
      <h3 class="ref-h">Text styles and fonts</h3>
      <p>The style box in the Font group (or Edit → Normal, Heading 1–3, Code) sets the paragraph's style.</p>
      <p>The Aa button (Edit → Styles and fonts…) opens the Styles panel: click a style to apply it, the pencil to change it. Each style has a Latin font and a Persian font with its own size, plus bold, italic and colour.</p>
      <p>A font that isn't installed (on an iPad, fonts usually can't be) can be added with Add font… at the bottom of the Styles panel: pick TTF, OTF, WOFF or WOFF2 files. They are saved inside the .matex, so the document looks the same on any device. Add each weight (Regular, Bold) as its own file.</p>
    </section>

    <section id="help-media">
      <h3 class="ref-h">Pictures, tables, charts and equations</h3>
      <p><b>Pictures:</b> Insert → Image…, or paste or drop an image on the page. Select it for the Picture group: width (% of the text column), align, wrap text around it, filters, brightness and contrast, rotate and flip. Drag its bottom corners to resize.</p>
      <p><b>Tables:</b> Insert → Insert table. With the cursor in a table, add rows and columns from Insert and delete them from the same list.</p>
      <p><b>Charts:</b> Insert → Chart (Mermaid) adds a chart; click it to edit its code (flowchart, sequence, pie, gantt…). Errors show under the code. See mermaid.js.org for the chart types.</p>
      <p><b>Equations:</b> Insert → Equation (inline or block), or the Σ button, then type LaTeX (<code>\frac{a}{b}</code>, <code>\sqrt{x}</code>, <code>\sum_{i=1}^n</code>). Click an equation to edit it. They are saved as <code>$x$</code> and <code>$$ … $$</code>, like Pandoc; a <code>$</code> typed as text stays text. KaTeX draws them; see katex.org for the commands it knows. Give a block a caption (Insert → Add caption, <code>eq-1: …</code>) to refer to it as <code>[EQ-1]</code>, or number it in place with <code>\tag{1}</code>.</p>
      <p><b>HTML blocks:</b> Insert → HTML block, for what Markdown can't express. It is drawn without scripts or <code>&lt;style&gt;</code>; style it from the CSS panel.</p>
    </section>

    <section id="help-notes">
      <h3 class="ref-h">Footnotes, references and captions</h3>
      <p><b>Footnote:</b> Insert → Footnote, then type its text at the bottom of the page. It prints at the bottom of the sheet its number is on.</p>
      <p><b>Reference:</b> Insert → New reference adds <code>[1]</code>; Cite reuses an existing one. Insert → References list puts the list where you want it.</p>
      <p>Click a number or a list entry to edit or delete the note. Numbers update by themselves.</p>
      <p><b>Captions:</b> select an image, chart, equation block, table or HTML block, then Insert → Add caption. The text before the first <code>:</code> is its label (<code>fig-1</code>). Refer to it from Insert → Refer to…, or type <code>[IMG-1]</code>; the reference follows when the label changes.</p>
      <p><b>Table of contents:</b> Insert → Table of contents lists every heading with its page. Click its title to rename it; use an entry's … to leave a heading out.</p>
    </section>

    <section id="help-pages">
      <h3 class="ref-h">Pages, sections and columns</h3>
      <p>File → Page setup… sets the paper (A3, A4, A5, B5, Letter, Legal), orientation, margins, header and footer and the column gap. Text flows from sheet to sheet as it will print.</p>
      <p>Insert → Section break starts a new sheet. Each section has its own columns (Edit → One column / 2 columns…). Backspace at a section's start, or Edit → Remove section break, joins it to the one before.</p>
      <p>Columns need the Windows app (Chromium 145+); the macOS and Linux apps show one column for now.</p>
    </section>

    <section id="help-header">
      <h3 class="ref-h">Header, footer and page numbers</h3>
      <p>Double-click a sheet's top or bottom margin to type in its left, centre and right slots. Double-click the body or press Esc to go back.</p>
      <p><code>{page}</code> and <code>{pages}</code> fill in the page number and count. Page setup sets the number's position, format, first value, Persian digits and whether page 1 skips it.</p>
      <p><code v-pre>{{ code }}</code> runs JavaScript for the page it is on, such as <code v-pre>{{ page.toLocaleString('fa') }}</code>, here and anywhere in the text: paragraphs, headings, tables, captions, notes. Type it or use Insert → Script field; click one to edit its code. Edit → Header and footer scripts… lists what scripts can use, and its Document script holds functions and variables every <code v-pre>{{ }}</code> can call. MaTex asks before running scripts in a document you open.</p>
      <p>For literal braces type <code v-pre>\{{ … }}</code>: the backslash goes and the text stays. Pressing Ctrl+Z right after a field appears also turns it back into text. In the saved Markdown, literal braces are written <code v-pre>\{{</code>.</p>
    </section>

    <section id="help-css">
      <h3 class="ref-h">Styling with CSS and HTML</h3>
      <p>Edit → Document CSS… opens the CSS panel. Its rules style the page live and in print, and win over the Styles panel. <code>&amp;</code> is the page; <code>@page</code> and <code>@font-face</code> work.</p>
      <p>Every element has a class (<code>.paragraph</code>, <code>.heading-1</code>, <code>.persian</code>, <code>.table</code>, <code>.note</code>…) and an id. Select text and press the … beside it → Style in CSS for a rule that targets exactly that. Edit → Style this section in CSS does the same for the section.</p>
    </section>

    <section id="help-keys">
      <h3 class="ref-h">Keyboard shortcuts</h3>
      <dl class="help-keys">
        <template v-for="[what, key] in keys" :key="what">
          <dt>{{ what }}</dt>
          <dd><kbd>{{ key }}</kbd></dd>
        </template>
      </dl>
      <p class="ref-hint">Shortcuts use the key's place on the keyboard, so they also work on the Persian layout.</p>
    </section>

    <section id="help-about">
      <h3 class="ref-h">About MaTex</h3>
      <p>MaTex {{ version }}: a Markdown word processor for Persian and English papers and books. Works offline on Windows, macOS and Linux.</p>
    </section>
  </div>
</template>
