// {{ code }} in a header/footer slot: JavaScript run once per sheet, its result shown as text.
// It runs with the app's full rights (chosen over a sandbox); useDocument asks before running
// the scripts of a document opened from disk.
// An expression ({{ page * 2 }}) is returned as is; statements need a `return`.

const SCRIPT = /\{\{([\s\S]+?)\}\}/g
// What a script can use; also the side panel's reference (ScriptReference.vue). App.vue fills them.
export const VARIABLES = [
  { name: 'page', type: 'number', about: 'This sheet, counted from 1.' },
  { name: 'pages', type: 'number', about: 'How many sheets the document has.' },
  { name: 'number', type: 'number', about: 'The page number as Page setup counts it (its start value applied).' },
  { name: 'title', type: 'string', about: 'The file name without .matex.' },
  { name: 'date', type: 'Date', about: 'The current date and time, when the page is drawn.' },
]
export const EXAMPLES = [
  { code: '{{ page }} / {{ pages }}', about: 'Page of total.' },
  { code: "{{ page.toLocaleString('fa') }}", about: 'Page in Persian digits.' },
  { code: "{{ date.toLocaleDateString('fa-IR') }}", about: 'Today in the Persian (Shamsi) calendar.' },
  { code: '{{ date.getFullYear() }}', about: 'This year.' },
  { code: "{{ page % 2 ? title : '' }}", about: 'Title on odd pages only.' },
  { code: '{{ pages - page }}', about: 'Pages left after this one.' },
  { code: "{{ if (page === 1) return ''; return 'Draft' }}", about: 'Statements: nothing on page 1, else Draft.' },
]
const NAMES = VARIABLES.map((v) => v.name)
const compiled = new Map()

export const hasScripts = (text) => /\{\{[\s\S]+?\}\}/.test(text)

function compile(code) {
  if (!compiled.has(code)) {
    let fn
    try {
      fn = new Function(...NAMES, `return (${code}\n)`)
    } catch {
      try {
        fn = new Function(...NAMES, code)
      } catch (err) {
        fn = () => { throw err }
      }
    }
    compiled.set(code, fn)
  }
  return compiled.get(code)
}

// vars: { page, pages, number, title, date }. A failing script shows its error in place.
export function runScripts(text, vars) {
  return text.replace(SCRIPT, (_, code) => {
    try {
      const value = compile(code.trim())(...NAMES.map((n) => vars[n]))
      return value == null ? '' : String(value)
    } catch (err) {
      return `⚠ ${err.message}`
    }
  })
}
