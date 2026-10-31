<script setup>
// Code field: a Monaco editor (utils/monaco.js, loaded on first use) that grows with its text,
// with the language's completions. `ready()` (exposed) resolves to the Monaco editor once it is up.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const code = defineModel({ type: String, default: '' })
const props = defineProps({
  language: { type: String, required: true }, // 'css' | 'html'
  label: { type: String, required: true },
  placeholder: { type: String, default: '' },
  minHeight: { type: Number, default: 240 },
})

const host = ref(null)
let editor = null
let done
const loaded = new Promise((resolve) => { done = resolve })

onMounted(async () => {
  const { default: monaco } = await import('../utils/monaco.js')
  if (!host.value) return // closed while loading
  editor = monaco.editor.create(host.value, {
    value: code.value,
    language: props.language,
    ariaLabel: props.label,
    placeholder: props.placeholder,
    automaticLayout: true,
    fixedOverflowWidgets: true, // suggestions aren't clipped by the panel or popup
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    lineNumbers: 'off',
    folding: false,
    glyphMargin: false,
    lineDecorationsWidth: 8,
    wordWrap: 'on',
    tabSize: 2,
    fontSize: 13,
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    scrollbar: { vertical: 'hidden', alwaysConsumeMouseWheel: false },
  })
  // Grow with the text; the panel or page scrolls, not the editor.
  const fit = () => { host.value.style.height = `${Math.max(props.minHeight, editor.getContentHeight())}px` }
  editor.onDidContentSizeChange(fit)
  fit()
  editor.onDidChangeModelContent(() => { code.value = editor.getValue() })
  done(editor)
})

// Outside changes (Open, Undo in the page) replace the text; typing here already matches.
watch(code, (value) => { if (editor && value !== editor.getValue()) editor.setValue(value) })
onBeforeUnmount(() => editor?.dispose())

defineExpose({ ready: () => loaded })
</script>

<template>
  <div ref="host" class="code-edit" dir="ltr" :style="{ height: `${minHeight}px` }" />
</template>
