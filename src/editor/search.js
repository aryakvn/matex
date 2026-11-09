// Find and replace in the body (FindPanel.vue). The query lives in a plugin that marks every match
// with a decoration (.search-match, the selected one .search-current); commands move the selection
// between matches and replace them. Matches are found in each textblock's text; a match never spans
// an inline atom (note, field, equation).
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const searchKey = new PluginKey('search')

// Word letters for "Whole words": any script's letters, digits and marks, plus the Persian half-space.
const WORD = '[\\p{L}\\p{N}\\p{M}_\\u200C]'
// Without "Match case", Arabic ye/kaf match their Persian forms (ي ى → ی, ك → ک). One character for
// one, so positions still line up; letter case is left to the regex's i flag for the same reason.
const fold = (s) => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')

// The query as a global regex, or null when empty. Throws on an invalid regular expression.
export function searchRegex({ query = '', caseSensitive = false, wholeWord = false, regex = false } = {}) {
  if (!query) return null
  let source = regex ? query : (caseSensitive ? query : fold(query)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (wholeWord) source = `(?<!${WORD})(?:${source})(?!${WORD})`
  return new RegExp(source, `gu${caseSensitive ? '' : 'i'}`)
}

// [{ from, to, match }] in document order. `match` is the RegExpExecArray, for $1 in replacements.
export function findMatches(doc, options) {
  const re = searchRegex(options)
  if (!re) return []
  const found = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Runs of text between inline atoms, each searched on its own.
    const runs = [{ text: '', at: pos + 1 }]
    node.forEach((child, offset) => {
      if (child.isText) runs.at(-1).text += child.text
      else runs.push({ text: '', at: pos + 1 + offset + child.nodeSize })
    })
    for (const { text, at } of runs) {
      re.lastIndex = 0
      for (let m; (m = re.exec(options.caseSensitive || options.regex ? text : fold(text)));) {
        if (!m[0]) { re.lastIndex++; continue } // an empty match (^, a*) would loop
        found.push({ from: at + m.index, to: at + m.index + m[0].length, match: m })
      }
    }
    return false
  })
  return found
}

// The replacement for one match: literal, or with $&, $1, $<name> and $$ for a regular expression.
export function replacementFor(match, text, regex) {
  if (!regex) return text
  return text.replace(/\$(\$|&|\d{1,2}|<[^>]*>)/g, (s, k) =>
    k === '$' ? '$' : k === '&' ? match[0] : k[0] === '<' ? (match.groups?.[k.slice(1, -1)] ?? '') : (match[+k] ?? s))
}

// { options, matches, error } for the panel; index = the match the selection is on, or -1.
export function searchState(state) {
  const s = searchKey.getState(state)
  if (!s) return { matches: [], index: -1, error: null }
  const { from, to } = state.selection
  return { ...s, index: s.matches.findIndex((m) => m.from === from && m.to === to) }
}

function search(options, doc) {
  try {
    return { options, matches: findMatches(doc, options), error: null }
  } catch (e) {
    return { options, matches: [], error: e.message }
  }
}

// The first match after `to` (backwards: the last before `from`), wrapping around.
const nextMatch = (matches, from, to, backwards) => backwards
  ? (matches.findLast((m) => m.to <= from) ?? matches.at(-1))
  : (matches.find((m) => m.from >= to) ?? matches[0])

// No focus: typing stays in the Find box; .search-current shows where the selection is.
const select = (tr, m) => tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView()

export const Search = Extension.create({
  name: 'search',

  addCommands() {
    return {
      // { query, caseSensitive, wholeWord, regex }; an empty query clears the highlights.
      setSearch: (options) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(searchKey, options)
        return true
      },
      findNext: (backwards = false) => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection
        const m = nextMatch(searchState(state).matches, from, to, backwards)
        if (m && dispatch) select(tr, m)
        return !!m
      },
      // Replaces the selected match, then selects the next; with none selected it only finds one,
      // like Word, so nothing is replaced unseen.
      replaceNext: (text) => ({ tr, state, dispatch, commands }) => {
        const { matches, index, options } = searchState(state)
        if (index < 0) return commands.findNext()
        if (!dispatch) return true
        const m = matches[index]
        tr.insertText(replacementFor(m.match, text, options.regex), m.from, m.to)
        const end = tr.mapping.map(m.to)
        const next = nextMatch(findMatches(tr.doc, options), end, end, false)
        if (next) select(tr, next)
        return true
      },
      // Every match, in one step (one Undo). Last first, so earlier positions stay put.
      replaceAll: (text) => ({ tr, state, dispatch }) => {
        const { matches, options } = searchState(state)
        if (!matches.length) return false
        if (dispatch) {
          for (const m of [...matches].reverse()) tr.insertText(replacementFor(m.match, text, options.regex), m.from, m.to)
        }
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [new Plugin({
      key: searchKey,
      state: {
        init: () => ({ options: {}, matches: [], error: null }),
        // ponytail: searches the whole document again on every edit while a query is set; fine for a
        // book, map old matches through the step if typing lags with Find open.
        apply(tr, old) {
          const options = tr.getMeta(searchKey)
          if (options) return search(options, tr.doc)
          return tr.docChanged && old.options.query ? search(old.options, tr.doc) : old
        },
      },
      props: {
        decorations(state) {
          const { matches, index } = searchState(state)
          if (!matches.length) return null
          return DecorationSet.create(state.doc, matches.map((m, i) =>
            Decoration.inline(m.from, m.to, { class: i === index ? 'search-match search-current' : 'search-match' })))
        },
      },
    })]
  },
})
