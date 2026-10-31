<script setup>
// Page setup dialog: paper, margins, column gap, header/footer text size, and page numbering.
// The number of columns belongs to each section (toolbar's Layout menu). Edits the document's layout
// object live, so the sheets behind the dialog update as you type.
import { ref } from 'vue'
import { NUMBER_FORMATS, ALIGNS, PAPERS, defaultLayout } from '../utils/layout.js'

const props = defineProps({ layout: { type: Object, required: true } })

const dialog = ref(null)
defineExpose({ open: () => dialog.value.showModal() })

const zones = [
  { key: 'header', title: 'Header' },
  { key: 'footer', title: 'Footer' },
]
// Top and bottom margins are the header and footer heights.
const margins = [
  { key: 'headerHeight', label: 'Top', min: 5 },
  { key: 'footerHeight', label: 'Bottom', min: 5 },
  { key: 'marginLeft', label: 'Left', min: 0 },
  { key: 'marginRight', label: 'Right', min: 0 },
]
const paperLabel = (name) => `${name} (${PAPERS[name].join(' × ')} mm)`
// Styles have their own panel, so Reset here leaves them alone.
const reset = () => Object.assign(props.layout, { ...defaultLayout(), styles: props.layout.styles })
</script>

<template>
  <dialog ref="dialog" class="setup" @click="$event.target === dialog && dialog.close()">
    <form method="dialog">
      <h2>Page setup</h2>

      <fieldset>
        <legend>Paper</legend>
        <div class="setup-row">
          <label class="grow">Size
            <select v-model="layout.paper">
              <option v-for="(_, p) in PAPERS" :key="p" :value="p">{{ paperLabel(p) }}</option>
            </select>
          </label>
          <label>Orientation
            <select v-model="layout.landscape">
              <option :value="false">Portrait</option>
              <option :value="true">Landscape</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Margins (mm)</legend>
        <div class="setup-row margins">
          <label v-for="m in margins" :key="m.key">{{ m.label }}
            <input v-model.number="layout[m.key]" type="number" :min="m.min" max="100" step="1" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Columns</legend>
        <div class="setup-row">
          <label>Gap (mm)
            <input v-model.number="layout.columnGap" type="number" min="0" max="50" step="1" />
          </label>
        </div>
        <p class="setup-hint setup-warn">Set the number of columns for each section in the toolbar's Layout menu.</p>
      </fieldset>

      <fieldset>
        <legend>Header and footer</legend>
        <div class="setup-row">
          <label v-for="z in zones" :key="z.key">{{ z.title }} text size (pt)
            <input v-model.number="layout[`${z.key}Size`]" type="number" min="6" max="36" step="1" />
          </label>
        </div>
      </fieldset>
      <p class="setup-hint">
        Double-click a page's top or bottom margin to write its header or footer. There, <code>{page}</code> and
        <code>{pages}</code> fill in, and <code v-pre>{{ code }}</code> runs JavaScript with <code>page</code>,
        <code>pages</code>, <code>number</code>, <code>title</code> and <code>date</code>. The header and footer fill the top and bottom margins.
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
