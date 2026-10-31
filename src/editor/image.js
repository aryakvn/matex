import Image from '@tiptap/extension-image'

// Picture settings (Picture group of the toolbar, resize handles in App.vue), saved as a Pandoc
// attribute block right after the image:
//   ![alt](assets/a.png){width=50% .center .grayscale brightness=120% contrast=90% .flip-h}
// Width is a percentage of the text column, so it prints the same on any paper. Items MaTex doesn't
// know (`#id`, `height=3cm`) are kept as written.
export const IMAGE_ALIGNS = ['left', 'center', 'right']
export const IMAGE_FILTERS = ['grayscale', 'sepia', 'invert']
const FLIPS = { 'flip-h': 'flipH', 'flip-v': 'flipV' }
// ![alt](src "title"){attrs}; without the {…} the built-in image tokenizer takes it.
const IMG = /^!\[((?:\\.|[^\]\\\n])*)\]\(\s*([^\s()]+)(?:\s+"((?:\\.|[^"\\\n])*)")?\s*\)\{([^{}\n]*)\}/

export const clampWidth = (n) => Math.round(Math.min(100, Math.max(5, n)))

export function parseImageAttrs(text) {
  const attrs = {}
  const extra = []
  for (const item of text.trim().split(/\s+/).filter(Boolean)) {
    const cls = item[0] === '.' ? item.slice(1) : null
    const [, key, value] = /^(width|brightness|contrast)=(\d+(?:\.\d+)?)%$/.exec(item) ?? []
    if (IMAGE_ALIGNS.includes(cls)) attrs.align = cls
    else if (IMAGE_FILTERS.includes(cls)) attrs.filter = cls
    else if (FLIPS[cls]) attrs[FLIPS[cls]] = true
    else if (key === 'width') attrs.width = clampWidth(+value)
    else if (key) attrs[key] = Math.round(Math.min(300, +value))
    else extra.push(item)
  }
  if (extra.length) attrs.extra = extra.join(' ')
  return attrs
}

// `{…}` for an image's Markdown, or ''.
export function imageAttrBlock(a = {}) {
  const items = [
    a.width && `width=${a.width}%`,
    a.align && `.${a.align}`,
    a.filter && `.${a.filter}`,
    a.brightness != null && a.brightness !== 100 && `brightness=${a.brightness}%`,
    a.contrast != null && a.contrast !== 100 && `contrast=${a.contrast}%`,
    a.flipH && '.flip-h',
    a.flipV && '.flip-v',
    a.extra,
  ].filter(Boolean)
  return items.length ? `{${items.join(' ')}}` : ''
}

// The CSS filter for an image's settings, or ''.
export function filterCss({ filter, brightness = 100, contrast = 100 }) {
  return [
    filter && `${filter}(1)`,
    brightness !== 100 && `brightness(${brightness}%)`,
    contrast !== 100 && `contrast(${contrast}%)`,
  ].filter(Boolean).join(' ')
}

const percent = (style, fn) => {
  const m = new RegExp(`${fn}\\(([\\d.]+)%\\)`).exec(style ?? '')
  return m ? +m[1] : 100
}
const flag = (cls) => ({ default: false, parseHTML: (el) => el.classList.contains(cls), renderHTML: (a) => (a[FLIPS[cls]] ? { class: cls } : {}) })

// Drawn with classes (`align-center`, `filter-sepia`, `flip-h`) and inline style (width, filter,
// transform), so the CSS panel can still override any of it.
export const Picture = Image.extend({
  addAttributes() {
    return {
      ...this.parent(),
      width: {
        default: null,
        parseHTML: (el) => parseFloat(el.style.width) || null,
        renderHTML: ({ width }) => (width ? { style: `width: ${width}%` } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => IMAGE_ALIGNS.find((a) => el.classList.contains(`align-${a}`)) ?? null,
        renderHTML: ({ align }) => (align ? { class: `align-${align}` } : {}),
      },
      filter: {
        default: null,
        parseHTML: (el) => IMAGE_FILTERS.find((f) => el.classList.contains(`filter-${f}`)) ?? null,
        renderHTML: (a) => {
          const css = filterCss(a)
          return { ...(a.filter && { class: `filter-${a.filter}` }), ...(css && { style: `filter: ${css}` }) }
        },
      },
      brightness: { default: 100, parseHTML: (el) => percent(el.style.filter, 'brightness'), renderHTML: () => ({}) },
      contrast: { default: 100, parseHTML: (el) => percent(el.style.filter, 'contrast'), renderHTML: () => ({}) },
      flipH: flag('flip-h'),
      flipV: {
        ...flag('flip-v'),
        renderHTML: (a) => {
          const scale = a.flipH || a.flipV ? { style: `transform: scale(${a.flipH ? -1 : 1}, ${a.flipV ? -1 : 1})` } : {}
          return { ...scale, ...(a.flipV && { class: 'flip-v' }) }
        },
      },
      extra: { default: null, rendered: false },
    }
  },

  markdownTokenizer: {
    name: 'image',
    level: 'inline',
    start: '![',
    tokenize(src) {
      const m = IMG.exec(src)
      if (m) return { type: 'image', raw: m[0], text: m[1], href: m[2], title: m[3] ?? null, attrs: parseImageAttrs(m[4]) }
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('image', { src: token.href, title: token.title, alt: token.text, ...token.attrs }),
  // ponytail: text typed right after an image that looks like `{…}` reopens as its settings; escape it if that bites.
  renderMarkdown(node, h, ctx) {
    return this.parent(node, h, ctx) + imageAttrBlock(node.attrs)
  },
})
