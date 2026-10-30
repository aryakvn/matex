<script setup>
// Page setup dialog: header/footer text and size, and page numbering. Edits the document's layout
// object live, so the sheets behind the dialog update as you type.
import { ref } from 'vue'
import { NUMBER_FORMATS, ALIGNS, defaultLayout } from '../utils/layout.js'

const props = defineProps({ layout: { type: Object, required: true } })

const dialog = ref(null)
defineExpose({ open: () => dialog.value.showModal() })

const zones = [
  { key: 'header', title: 'Header' },
  { key: 'footer', title: 'Footer' },
]
// Styles have their own panel, so Reset here leaves them alone.
const reset = () => Object.assign(props.layout, { ...defaultLayout(), styles: props.layout.styles })
</script>

<template>
  <dialog ref="dialog" class="setup" @click="$event.target === dialog && dialog.close()">
    <form method="dialog">
      <h2>Page setup</h2>

      <fieldset v-for="z in zones" :key="z.key">
        <legend>{{ z.title }}</legend>
        <div class="setup-row">
          <label>Height (mm)
            <input v-model.number="layout[`${z.key}Height`]" type="number" min="5" max="100" step="1" />
          </label>
          <label>Text size (pt)
            <input v-model.number="layout[`${z.key}Size`]" type="number" min="6" max="36" step="1" />
          </label>
        </div>
      </fieldset>
      <p class="setup-hint">
        Double-click a page's top or bottom margin to write its header or footer. There, <code>{page}</code> and
        <code>{pages}</code> fill in, and <code v-pre>{{ code }}</code> runs JavaScript with <code>page</code>,
        <code>pages</code>, <code>number</code>, <code>title</code> and <code>date</code>. The height is the page margin on that side.
      </p>

      <fieldset>
        <legend>Page numbers</legend>
        <div class="setup-row">
          <label>Show in
            <select v-model="layout.number.where">
              <option value="none">Nowhere</option>
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </label>
          <label>Align
            <select v-model="layout.number.align" :disabled="layout.number.where === 'none'">
              <option v-for="a in ALIGNS" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
          <label>Format
            <select v-model="layout.number.format" :disabled="layout.number.where === 'none'">
              <option v-for="f in NUMBER_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
          </label>
          <label>Start at
            <input v-model.number="layout.number.start" type="number" step="1" :disabled="layout.number.where === 'none'" />
          </label>
        </div>
        <div class="setup-row">
          <label class="check"><input v-model="layout.number.persian" type="checkbox" /> Persian digits (۱۲۳)</label>
          <label class="check"><input v-model="layout.number.skipFirst" type="checkbox" /> No number on the first page</label>
        </div>
      </fieldset>

      <div class="setup-actions">
        <button type="button" class="pop-btn" @click="reset">Reset</button>
        <button type="submit" class="pop-btn primary">Done</button>
      </div>
    </form>
  </dialog>
</template>
