// Service worker for the web build (not Tauri). The `pwa()` plugin in vite.config.js
// writes dist/sw.js as `const VERSION, FILES` + this file, so FILES is every built file.
// Everything is cached on install, so the app works offline after the first visit.
// A new deploy installs a new worker that waits until every MaTex tab is closed,
// so an open tab never loses the lazy chunks (Monaco, Mermaid) of its own version.
const CACHE = `matex-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith('matex-') && k !== CACHE).map((k) => caches.delete(k)))))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  // Any page URL gets the app shell; everything else is the cached file, else the network.
  // ignoreVary: servers add Vary: Origin, and module requests carry an Origin the precache lacked.
  const key = req.mode === 'navigate' ? 'index.html' : req
  e.respondWith(caches.open(CACHE).then((cache) => cache.match(key, { ignoreVary: true })).then((hit) => hit || fetch(req)))
})
