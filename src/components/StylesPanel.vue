<script setup>
// Side panel content: the Styles gallery, like Word's. Each tile is drawn in its own fonts; a click
// applies it to the selected paragraphs, the pencil opens its settings: a Latin font and a Persian
// font (each script in its own face), sizes, bold/italic and colour. Edits show on the page at once.
import { ref, computed } from 'vue'
import { Pencil, RotateCcw } from 'lucide-vue-next'
import { STYLES, styleAt, applyStyle, fontStacks, defaultStyles, normalizeStyles, COMMON_FONTS, installedFonts } from '../utils/styles.js'

const props = defineProps({
  editor: { type: Object, default: null },
  styles: { type: Object, required: true }, // layout.styles, edited in place
  showHelp: { type: Boolean, default: false },
})

const current = computed(() => styleAt(props.editor))
const editing = ref(null) // key of the style whose settings are open

// Tile and font box previews; an empty heading font shows Normal's.
const stacks = (key) => {
  const s = normalizeStyles(props.styles)
  const own = fontStacks(key, s[key])
  const base = fontStacks('p', s.p)
  return { latin: own.latin ?? base.latin, persian: own.persian ?? base.persian ?? base.latin }
}
const tileFont = (key, script) => {
  const s = props.styles[key]
  const pt = script === 'persian' ? s.persianSize : s.size
  return {
    fontFamily: stacks(key)[script],
    fontSize: `${Math.min(Number(pt) || 12, 18) * (4 / 3)}px`,
    fontWeight: s.bold ? 'bold' : 'normal',
    fontStyle: s.italic ? 'italic' : 'normal',
    color: s.color,
  }
}

const installed = ref([])
const fontList = (script) => [...new Set([...COMMON_FONTS[script], ...installed.value])]
async function loadInstalled() {
  if (!installed.value.length) installed.value = await installedFonts()
}

const reset = (key) => Object.assign(props.styles[key], defaultStyles()[key])
const sameAs = (key) => (key === 'p' ? 'Default' : 'Same as Normal')
</script>

<template>
  <p v-if="showHelp" class="ref-text">
    Each style has two fonts: the Latin font for English text and the Persian font for Persian text, so a
    mixed line uses both. Leave a heading's or Code's font empty to use Normal's. Fonts must be installed
    on the computer that opens the document.
  </p>
  <p class="ref-hint">Click a style to apply it; the pencil changes it everywhere it is used.</p>

  <ul class="style-list">
    <li v-for="s in STYLES" :key="s.key" :class="['style-item', { current: current === s.key }]">
      <div class="style-tile">
        <button type="button" class="style-apply" :aria-pressed="current === s.key" :disabled="!editor" @click="applyStyle(editor, s.key)">
          <span :style="tileFont(s.key, 'latin')">{{ s.label }}</span>
          <span dir="rtl" :style="tileFont(s.key, 'persian')">{{ s.persian }}</span>
        </button>
        <button
          type="button" class="tb-btn" :title="`Modify ${s.label}`" :aria-label="`Modify ${s.label}`"
          :aria-expanded="editing === s.key" @click="editing = editing === s.key ? null : s.key"
        >
          <Pencil :size="16" />
        </button>
      </div>

      <form v-if="editing === s.key" class="style-form" @submit.prevent>
        <label>Latin font
          <input
            v-model.trim="styles[s.key].latin" type="text" list="fonts-latin" dir="ltr" :placeholder="sameAs(s.key)"
            :style="{ fontFamily: stacks(s.key).latin }" @focus="loadInstalled"
          />
        </label>
        <label>Size (pt)
          <input v-model.number="styles[s.key].size" type="number" min="6" max="96" step="0.5" />
        </label>
        <label>Persian font
          <input
            v-model.trim="styles[s.key].persian" type="text" list="fonts-persian" dir="ltr" :placeholder="sameAs(s.key)"
            :style="{ fontFamily: stacks(s.key).persian }" @focus="loadInstalled"
          />
        </label>
        <label>Size (pt)
          <input v-model.number="styles[s.key].persianSize" type="number" min="6" max="96" step="0.5" />
        </label>
        <div class="style-row">
          <label class="check"><input v-model="styles[s.key].bold" type="checkbox" /> Bold</label>
          <label class="check"><input v-model="styles[s.key].italic" type="checkbox" /> Italic</label>
          <label class="check">Colour <input v-model="styles[s.key].color" type="color" /></label>
          <button type="button" class="tb-btn style-reset" :title="`Reset ${s.label}`" :aria-label="`Reset ${s.label}`" @click="reset(s.key)">
            <RotateCcw :size="16" />
          </button>
        </div>
      </form>
    </li>
  </ul>

  <datalist id="fonts-latin"><option v-for="f in fontList('latin')" :key="f" :value="f" /></datalist>
  <datalist id="fonts-persian"><option v-for="f in fontList('persian')" :key="f" :value="f" /></datalist>
</template>
