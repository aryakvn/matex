// Model Context Protocol over HTTP ("streamable HTTP", JSON answers only, no sessions), spoken by the
// webview: the desktop app's Rust side only carries the requests (src-tauri/src/lib.rs). Pure, so the
// protocol is tested without Tauri; the tools themselves come from composables/useMcp.js.
import { version } from '../../package.json'

export const MCP_PORT = 7420
export const MCP_URL = `http://127.0.0.1:${MCP_PORT}/mcp`
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] // newest first; tools only, same in all

const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]'])
const hostOf = (s) => { try { return new URL(s.includes('//') ? s : `http://${s}`).hostname } catch { return null } }

// Only a local agent may call: the Host must be the loopback name (so a web page can't reach the server
// by pointing its own domain at 127.0.0.1) and a browser request must come from a localhost page.
export const allowed = (host, origin) => LOCAL.has(hostOf(host ?? '')) && (origin == null || LOCAL.has(hostOf(origin)))

const reply = (id, result) => ({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

// One JSON-RPC message → its response, or null for a notification (or a response from the client).
// `tools`: [{ name, description, inputSchema, run(args) → text }]; `run` throwing is a tool error the
// agent reads, not a protocol error.
export async function answer(message, tools, instructions = '') {
  const { id, method, params } = message ?? {}
  if (typeof method !== 'string') return message?.id === undefined ? null : fail(message.id ?? null, -32600, 'Invalid request')
  if (id === undefined) return null
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'matex', title: 'MaTex', version },
        instructions,
      })
    }
    case 'ping': return reply(id, {})
    case 'tools/list': return reply(id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name)
      if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`)
      try {
        return reply(id, { content: [{ type: 'text', text: String(await tool.run(params.arguments ?? {})) }] })
      } catch (e) {
        return reply(id, { content: [{ type: 'text', text: e?.message ?? String(e) }], isError: true })
      }
    }
    default: return fail(id, -32601, `Method not found: ${method}`)
  }
}

// One HTTP request from the server → { status, body }.
export async function handleHttp({ method, url, host, origin, body }, tools, instructions) {
  if (!allowed(host, origin)) return { status: 403, body: '' }
  if (url.split('?')[0] !== '/mcp') return { status: 404, body: '' }
  if (method !== 'POST') return { status: 405, body: '' } // no server-to-client stream (GET) or sessions (DELETE)
  let message
  try { message = JSON.parse(body) } catch { return { status: 400, body: JSON.stringify(fail(null, -32700, 'Parse error')) } }
  const out = Array.isArray(message) ? fail(null, -32600, 'Batches are not supported') : await answer(message, tools, instructions)
  return out ? { status: 200, body: JSON.stringify(out) } : { status: 202, body: '' }
}

// Throws unless args[key] is a string (or absent when optional); tool input is untrusted.
export function text(args, key, optional = false) {
  const v = args[key]
  if (v === undefined && optional) return undefined
  if (typeof v !== 'string') throw new Error(`"${key}" must be a string.`)
  return v
}
