// The only place that knows whether we run inside Tauri or a plain browser.
// Tauri: native dialogs + real file paths. Browser: file input + download, so the
// whole UI can be tried with `npm run dev`. Tauri modules load lazily so the
// browser never touches them.

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const filters = [{ name: 'MaTex document', extensions: ['matex', 'zip'] }]
const baseName = (path) => path.split(/[\\/]/).pop()
const dialog = () => import('@tauri-apps/plugin-dialog')
const fs = () => import('@tauri-apps/plugin-fs')

function pickInBrowser(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

// → { name, path, bytes } | null when cancelled
export async function openFile() {
  if (isTauri) {
    const path = await (await dialog()).open({ multiple: false, directory: false, filters })
    if (!path) return null
    return { name: baseName(path), path, bytes: await (await fs()).readFile(path) }
  }
  const file = await pickInBrowser('.matex,.zip')
  if (!file) return null
  return { name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) }
}

// → { name, path } | null when cancelled. The browser always downloads.
export async function saveFile(bytes, { path, name, saveAs }) {
  if (isTauri) {
    if (saveAs || !path) {
      path = await (await dialog()).save({ defaultPath: name, filters })
      if (!path) return null
    }
    await (await fs()).writeFile(path, bytes)
    return { name: baseName(path), path }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { name, path: null }
}

export async function ask(message) {
  if (isTauri) return (await dialog()).ask(message, { title: 'MaTex', kind: 'warning' })
  return window.confirm(message)
}

export async function showError(message) {
  if (isTauri) return (await dialog()).message(message, { title: 'MaTex', kind: 'error' })
  window.alert(message)
}

export async function setTitle(title) {
  document.title = title
  if (isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTitle(title)
  }
}

// Ask before the window closes with unsaved work.
export async function onCloseRequest(isDirty) {
  if (isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().onCloseRequested(async (event) => {
      if (isDirty() && !(await ask('Close without saving your changes?'))) event.preventDefault()
    })
    return
  }
  window.addEventListener('beforeunload', (event) => {
    if (isDirty()) event.preventDefault()
  })
}
