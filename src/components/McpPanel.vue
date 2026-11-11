<script setup>
// Side panel content: turns the MCP server (composables/useMcp.js) on and off and shows how to
// connect an AI agent to it.
import { MCP_URL } from '../utils/mcp.js'
import { isTauri } from '../utils/platform.js'

defineProps({
  on: { type: Boolean, default: false },
  error: { type: String, default: '' },
  tools: { type: Array, default: () => [] },
  showHelp: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

const claudeCode = `claude mcp add --transport http matex ${MCP_URL}`
const copy = (text) => navigator.clipboard?.writeText(text)
</script>

<template>
  <div class="mcp">
    <p v-if="!isTauri" class="ref-warn">The MCP server runs in the desktop app; a browser can't open one.</p>

    <div v-if="showHelp" class="ref-text">
      <p>
        An AI agent connected here (Claude Code, Claude Desktop, Cursor…) can read the open document and
        change it: edit its Markdown, insert at your cursor, read what you selected, and set the document CSS.
        Its changes show at once, and Ctrl+Z undoes each one. It can't save, open or close files.
      </p>
      <p>
        Only programs on this computer can connect, and any of them can while this is on. MaTex asks
        before an agent adds a <code v-pre>{{ }}</code> script field.
      </p>
    </div>

    <label class="check">
      <input type="checkbox" :checked="on" :disabled="!isTauri" @change="emit('toggle', $event.target.checked)" />
      Let AI agents use this document
    </label>
    <p v-if="error" class="ref-warn">{{ error }}</p>

    <template v-if="on">
      <h3 class="ref-h">Server address</h3>
      <p class="mcp-row"><code>{{ MCP_URL }}</code><button type="button" class="pop-btn" @click="copy(MCP_URL)">Copy</button></p>
      <p class="ref-hint">Streamable HTTP. Add it to your agent as an MCP server with this URL.</p>

      <h3 class="ref-h">Claude Code</h3>
      <p class="mcp-row"><code>{{ claudeCode }}</code><button type="button" class="pop-btn" @click="copy(claudeCode)">Copy</button></p>
      <p class="ref-hint">
        An agent that can only start programs (Claude Desktop) connects through
        <code>npx mcp-remote {{ MCP_URL }}</code>.
      </p>

      <h3 class="ref-h">What the agent can do</h3>
      <dl class="ref-list">
        <template v-for="t in tools" :key="t.name">
          <dt><code>{{ t.name }}</code></dt>
          <dd>{{ t.description }}</dd>
        </template>
      </dl>
    </template>
  </div>
</template>
