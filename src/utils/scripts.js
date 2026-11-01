// {{ code }} anywhere in the document (a `field` node, editor/fields.js): JavaScript run for the
// sheet it is on, its result shown as text.
// It runs with the app's full rights (chosen over a sandbox); useDocument asks before running
// the scripts of a document opened from disk.
// An expression ({{ page * 2 }}) is returned as is; statements need a `return`.
// The document script (layout.script, the scripts panel, saved as script.js) runs before each one,
// so its functions and variables are in scope there and it sees the page's variables too.

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
let compiledFor = '' // the document script the cache was built with

// Whether Markdown has a field; `\{{` (escaped, literal text) doesn't count.
export const hasScripts = (text) => /\{\{[\s\S]+?\}\}/.test(text.replace(/\\[\s\S]/g, ''))

// ponytail: the document script reruns for every {{ }} on every sheet; fine for helpers, run it once
// into a scope object if documents start doing heavy work there.
function compile(code, script) {
  if (script !== compiledFor) {
    compiled.clear()
    compiledFor = script
  }
  if (!compiled.has(code)) {
    let fn
    try {
      fn = new Function(...NAMES, `${script}\nreturn (${code}\n)`)
    } catch {
      try {
        fn = new Function(...NAMES, `${script}\n${code}`)
      } catch (err) {
        fn = () => { throw err }
      }
    }
    compiled.set(code, fn)
  }
  return compiled.get(code)
}

// One field's code → its text. vars: { page, pages, number, title, date }; script: the document
// script. A failing script shows its error in place.
export function runScript(code, vars, script = '') {
  try {
    const value = compile(code.trim(), script)(...NAMES.map((n) => vars[n]))
    return value == null ? '' : String(value)
  } catch (err) {
    return `⚠ ${err.message}`
  }
}
