// Paragraph styles, like Word's Styles gallery: each has a Latin font and a Persian font, because
// mixed Persian/English writing usually sets each script in its own face. Persian text is wrapped in
// `.fa` spans (src/editor/persian.js) that take the style's Persian font and size.
// Saved in page.json as layout.styles; turned into CSS by stylesCss().

export const STYLES = [
  { key: 'p', label: 'Normal', persian: 'عادی', selector: '.page' },
  { key: 'h1', label: 'Heading 1', persian: 'عنوان ۱', selector: '.page h1' },
  { key: 'h2', label: 'Heading 2', persian: 'عنوان ۲', selector: '.page h2' },
  { key: 'h3', label: 'Heading 3', persian: 'عنوان ۳', selector: '.page :is(h3, h4, h5, h6)' },
  { key: 'code', label: 'Code', persian: 'کد', selector: '.page pre' },
]

// Behind every chosen font, so a missing font still gives readable text.
const FALLBACK = { text: 'Georgia, "Times New Roman", Tahoma, serif', code: 'Consolas, "Courier New", monospace' }

// Empty font on a heading or Code = same as Normal's.
const style = (size, bold = false, latin = '', persian = '') => ({ latin, persian, size, persianSize: size, bold, italic: false, color: '#1a1a1a' })
export const defaultStyles = () => ({
  p: style(12, false, 'Georgia', 'Tahoma'),
  h1: style(24, true),
  h2: style(18, true),
  h3: style(15, true),
  code: style(10.8, false, 'Consolas'),
})

// Font names go into CSS strings, so anything that could end the string or the rule is dropped.
const fontName = (v) => (typeof v === 'string' ? v.replace(/["\\;{}<>\n\r]/g, '').trim().slice(0, 100) : '')
const size = (v, fallback) => (Number.isFinite(+v) && +v > 0 ? Math.min(96, Math.max(6, +v)) : fallback)

export function normalizeStyles(raw) {
  const d = defaultStyles()
  const r = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(STYLES.map(({ key }) => {
    const s = r[key] && typeof r[key] === 'object' ? r[key] : {}
    const def = d[key]
    return [key, {
      latin: 'latin' in s ? fontName(s.latin) : def.latin,
      persian: 'persian' in s ? fontName(s.persian) : def.persian,
      size: size(s.size, def.size),
      persianSize: size(s.persianSize, size(s.size, def.persianSize)),
      bold: typeof s.bold === 'boolean' ? s.bold : def.bold,
      italic: typeof s.italic === 'boolean' ? s.italic : def.italic,
      color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : def.color,
    }]
  }))
}

// CSS font-family stacks of a style: { latin, persian }; null = inherit (from Normal).
export function fontStacks(key, s) {
  const fallback = key === 'code' ? FALLBACK.code : FALLBACK.text
  const stack = (name) => (name ? `"${name}", ${fallback}` : key === 'p' ? fallback : null)
  return { latin: stack(s.latin), persian: stack(s.persian) }
}

// The document CSS for the styles; overrides document.css. Persian size is a ratio to the Latin
// size (--fa-scale), so Persian runs in a smaller header or inline code shrink along.
export function stylesCss(styles) {
  return STYLES.map(({ key, selector }) => {
    const s = styles[key]
    const { latin, persian } = fontStacks(key, s)
    const rules = [
      latin && `font-family: ${latin}`,
      persian && `--fa-font: ${persian}`,
      `--fa-scale: ${+(s.persianSize / s.size).toFixed(4)}`,
      `font-size: ${s.size}pt`,
      `font-weight: ${s.bold ? 'bold' : 'normal'}`,
      `font-style: ${s.italic ? 'italic' : 'normal'}`,
      `color: ${s.color}`,
    ]
    // Inline code shares the Code style's font, not its size.
    const extra = key === 'code' && latin ? `\n.page code { font-family: ${latin}; }` : ''
    return `${selector} { ${rules.filter(Boolean).join('; ')}; }${extra}`
  }).join('\n')
}

// Style of the block at the cursor, and applying one to the selected blocks.
export function styleAt(editor) {
  if (!editor) return 'p'
  for (const level of [1, 2, 3]) if (editor.isActive('heading', { level })) return `h${level}`
  return editor.isActive('codeBlock') ? 'code' : 'p'
}

export function applyStyle(editor, key) {
  const chain = editor.chain().focus()
  if (key === 'p') chain.setParagraph().run()
  else if (key === 'code') chain.setCodeBlock().run()
  else chain.setHeading({ level: Number(key[1]) }).run()
}

// Font names offered in the font boxes; any installed font can also be typed.
export const COMMON_FONTS = {
  latin: ['Georgia', 'Times New Roman', 'Cambria', 'Calibri', 'Arial', 'Segoe UI', 'Helvetica', 'Garamond',
    'Liberation Serif', 'DejaVu Serif', 'Noto Serif', 'Consolas', 'Courier New', 'Menlo', 'DejaVu Sans Mono'],
  persian: ['Vazirmatn', 'B Nazanin', 'B Lotus', 'B Zar', 'B Mitra', 'B Titr', 'IRANSans', 'Sahel', 'Shabnam',
    'Samim', 'Tahoma', 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Times New Roman'],
}

// Installed font families, where the webview can list them (Chromium / WebView2, after a permission
// prompt); [] elsewhere. Call from a click or focus: the browser requires a user gesture.
let installed
export async function installedFonts() {
  if (installed) return installed
  try {
    const fonts = await window.queryLocalFonts()
    return (installed = [...new Set(fonts.map((f) => f.family))].sort())
  } catch {
    return [] // not supported, or no permission (yet)
  }
}
