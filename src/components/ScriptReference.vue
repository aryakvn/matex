<script setup>
// Side panel content: what {{ }} scripts can use, with this sheet's live values and ready examples.
// "Insert" puts a snippet at the cursor: in the text, a header/footer being edited, or a note.
// Above them, the document script (v-model:script = layout.script): shared functions and variables.
import { VARIABLES, EXAMPLES } from '../utils/scripts.js'
import CodeEdit from './CodeEdit.vue'

const script = defineModel('script', { type: String, default: '' })

defineProps({
  vars: { type: Object, required: true }, // the values a script on the current sheet would get
  scriptsOn: { type: Boolean, default: true },
  showHelp: { type: Boolean, default: false }, // the panel's ? button
})
const emit = defineEmits(['insert'])

const show = (v) => (v instanceof Date ? v.toLocaleString() : JSON.stringify(v))
</script>

<template>
  <p v-if="!scriptsOn" class="ref-warn">Scripts are turned off for this document, so they show as typed. Reopen it and choose to run them.</p>

  <p v-if="showHelp" class="ref-text">
    Type <code v-pre>{{ code }}</code> anywhere: in the text, a table, a caption, a note, a header or footer.
    It runs as JavaScript for the page it is on and its result is shown as text; click it to edit the code.
    An expression works as is; several statements need a <code>return</code>. For literal braces type
    <code v-pre>\{{ … }}</code> (saved as <code v-pre>\{{</code>), or press Ctrl+Z right after a field appears.
    In headers and footers <code>{page}</code> and <code>{pages}</code> also fill in without code.
  </p>
  <p class="ref-hint">Insert puts the code at the cursor: in the text, a header or footer you are editing, or a note.</p>

  <h3 class="ref-h">Document script</h3>
  <p v-if="showHelp" class="ref-text">
    Functions and variables declared here can be used in every <code v-pre>{{ }}</code>, such as
    <code v-pre>{{ chapter() }}</code>. It runs before each one, so it can read the variables below too.
    Saved with the document.
  </p>
  <CodeEdit v-model="script" language="javascript" label="Document script" :min-height="120" placeholder="function chapter() { return page < 10 ? 'Part 1' : 'Part 2' }" />

  <h3 class="ref-h">Variables</h3>
  <dl class="ref-list">
    <template v-for="v in VARIABLES" :key="v.name">
      <dt>
        <code>{{ v.name }}</code> <span class="ref-type">{{ v.type }}</span>
        <button type="button" class="pop-btn ref-insert" @click="emit('insert', `{{ ${v.name} }}`)">Insert</button>
      </dt>
      <dd>{{ v.about }} <span class="ref-now">Now: <code>{{ show(vars[v.name]) }}</code></span></dd>
    </template>
  </dl>

  <h3 class="ref-h">Examples</h3>
  <ul class="ref-list ref-examples">
    <li v-for="x in EXAMPLES" :key="x.code">
      <code class="ref-code" dir="ltr">{{ x.code }}</code>
      <span>{{ x.about }}</span>
      <button type="button" class="pop-btn ref-insert" @click="emit('insert', x.code)">Insert</button>
    </li>
  </ul>
</template>
