import { afterAll } from 'vitest'

// ProseMirror's DOM observer flushes on a 20 ms window.setTimeout. Let it run
// while jsdom is still up, or it throws "document is not defined" after teardown.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 50)))
