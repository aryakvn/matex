<script setup>
// Side panel content: what {{ }} scripts can use, with this sheet's live values and ready examples.
// "Insert" puts a snippet into the header/footer slot being edited (only there do scripts run).
import { VARIABLES, EXAMPLES } from '../utils/scripts.js'

defineProps({
  vars: { type: Object, required: true }, // the values a script on the current sheet would get
  canInsert: { type: Boolean, default: false },
  scriptsOn: { type: Boolean, default: true },
  showHelp: { type: Boolean, default: false }, // the panel's ? button
})
const emit = defineEmits(['insert'])

const show = (v) => (v instanceof Date ? v.toLocaleString() : JSON.stringify(v))
</script>

<template>
  <p v-if="!scriptsOn" class="ref-warn">Scripts are turned off for this document, so they show as typed. Reopen it and choose to run them.</p>

  <p v-if="showHelp" class="ref-text">
    Write <code v-pre>{{ code }}</code> in a header or footer. It runs once per page as JavaScript and its
    result is shown as text. An expression works as is; several statements need a <code>return</code>.
    <code>{page}</code> and <code>{pages}</code> also fill in without code.
  </p>
  <p class="ref-hint">{{ canInsert ? 'Insert puts the code into the header or footer you are editing.' : 'Double-click a page\'s top or bottom margin to edit its header or footer, then insert from here.' }}</p>

  <h3 class="ref-h">Variables</h3>
  <dl class="ref-list">
    <template v-for="v in VARIABLES" :key="v.name">
      <dt>
        <code>{{ v.name }}</code> <span class="ref-type">{{ v.type }}</span>
        <button type="button" class="pop-btn ref-insert" :disabled="!canInsert" @click="emit('insert', `{{ ${v.name} }}`)">Insert</button>
      </dt>
      <dd>{{ v.about }} <span class="ref-now">Now: <code>{{ show(vars[v.name]) }}</code></span></dd>
    </template>
  </dl>

  <h3 class="ref-h">Examples</h3>
  <ul class="ref-list ref-examples">
    <li v-for="x in EXAMPLES" :key="x.code">
      <code class="ref-code" dir="ltr">{{ x.code }}</code>
      <span>{{ x.about }}</span>
      <button type="button" class="pop-btn ref-insert" :disabled="!canInsert" @click="emit('insert', x.code)">Insert</button>
    </li>
  </ul>
</template>
