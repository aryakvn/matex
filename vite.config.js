import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// Writes dist/sw.js after a build: src/sw.js prefixed with every built file and a hash of
// their contents, so each deploy that changes anything gets a new cache. No plugin
// dependency: precaching the whole (flat, hashed) dist is all the app needs to run offline.
function pwa() {
  let outDir
  return {
    name: 'matex-pwa',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    writeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile())
        .map((f) => relative(outDir, join(f.parentPath, f.name)).replaceAll('\\', '/'))
        .filter((f) => f !== 'sw.js' && !/\.(ttf|woff)$/.test(f)) // every SW browser takes KaTeX's woff2
        .sort()
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const head = `const VERSION = '${hash.digest('hex').slice(0, 12)}'\nconst FILES = ${JSON.stringify(files)}\n`
      writeFileSync(join(outDir, 'sw.js'), head + readFileSync('src/sw.js', 'utf8'))
    },
  }
}

export default defineConfig({
  plugins: [vue(), pwa()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['tests/setup.js'] },
})
