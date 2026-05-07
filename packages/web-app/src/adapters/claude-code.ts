import type {
  BackendAdapter,
  BackendConnectionConfig,
  BackendEvent,
  BackendMessage,
  BackendSession,
} from "../provider/types"

/**
 * Claude Code Backend Adapter
 *
 * This adapter connects to Claude Code's HTTP API.
 * Claude Code can be started with `claude --http` to expose an HTTP interface.
 *
 * API Reference:
 * - Claude Code uses a WebSocket or HTTP-based interface
 * - Sessions are called "conversations" in Claude Code
 * - Messages follow the standard assistant/user/tool pattern
 *
 * Configuration:
 * - url: The HTTP endpoint (default: http://localhost:3000)
 * - apiKey: Your Anthropic API key (if required)
 *
 * Usage:
 * ```ts
 * import { ClaudeCodeAdapter } from "./adapters/claude-code"
 *
 * const adapter = new ClaudeCodeAdapter()
 * await adapter.connect({ url: "http://localhost:3000" })
 * ```
 */
export class ClaudeCodeAdapter implements BackendAdapter {
  readonly id = "claude-code"
  readonly name = "Claude Code"

  private config: BackendConnectionConfig | null = null
  private connected = false
  private eventListeners = new Set<(event: BackendEvent) => void>()
  private ws: WebSocket | null = null

  async connect(config: BackendConnectionConfig): Promise<void> {
    this.config = config
    const res = await fetch(`${config.url}/api/health`, {
      headers: this.getHeaders(),
    }).catch(() => null)
    if (!res || !res.ok) {
      throw new Error(
        `Cannot connect to Claude Code at ${config.url}. ` +
          `Make sure Claude Code is running with: claude --http --port ${new URL(config.url).port || 3000}`,
      )
    }
    this.connected = true
    this.connectWebSocket()
  }

  async disconnect(): Promise<void> {
    this.ws?.close()
    this.ws = null
    this.connected = false
    this.config = null
  }

  isConnected(): boolean {
    return this.connected
  }

  async health(): Promise<{ healthy: boolean; version?: string }> {
    if (!this.config) return { healthy: false }
    const res = await fetch(`${this.config.url}/api/health`, {
      headers: this.getHeaders(),
    }).catch(() => null)
    if (!res || !res.ok) return { healthy: false }
    const data = await res.json().catch(() => ({}))
    return { healthy: true, version: data.version }
  }

  async listSessions(): Promise<BackendSession[]> {
    if (!this.config) throw new Error("Not connected")
    const res = await fetch(`${this.config.url}/api/conversations`, {
      headers: this.getHeaders(),
    })
    if (!res.ok) throw new Error("Failed to list sessions")
    const data = await res.json()
    return (data.conversations ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      title: (c.title as string) ?? undefined,
      createdAt: c.created_at as number,
      updatedAt: c.updated_at as number | undefined,
    }))
  }

  async getSession(id: string): Promise<BackendSession | undefined> {
    if (!this.config) throw new Error("Not connected")
    const res = await fetch(`${this.config.url}/api/conversations/${id}`, {
      headers: this.getHeaders(),
    })
    if (!res.ok) return undefined
    const c = await res.json()
    return {
      id: c.id,
      title: c.title ?? undefined,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }
  }

  async createSession(opts?: { title?: string; model?: string }): Promise<BackendSession> {
    if (!this.config) throw new Error("Not connected")
    const res = await fetch(`${this.config.url}/api/conversations`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title: opts?.title,
        model: opts?.model ?? "claude-sonnet-4-20250514",
      }),
    })
    if (!res.ok) throw new Error("Failed to create session")
    const c = await res.json()
    return {
      id: c.id,
      title: c.title ?? undefined,
      createdAt: c.created_at ?? Date.now(),
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.config) throw new Error("Not connected")
    await fetch(`${this.config.url}/api/conversations/${id}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })
  }

  async getMessages(sessionId: string): Promise<BackendMessage[]> {
    if (!this.config) throw new Error("Not connected")
    const res = await fetch(`${this.config.url}/api/conversations/${sessionId}/messages`, {
      headers: this.getHeaders(),
    })
    if (!res.ok) throw new Error("Failed to get messages")
    const data = await res.json()
    return (data.messages ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      sessionId,
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      createdAt: m.created_at as number,
    }))
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    if (!this.config) throw new Error("Not connected")
    const res = await fetch(`${this.config.url}/api/conversations/${sessionId}/messages`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "user",
        content,
      }),
    })
    if (!res.ok) throw new Error("Failed to send message")
  }

  async cancelMessage(sessionId: string): Promise<void> {
    if (!this.config) throw new Error("Not connected")
    await fetch(`${this.config.url}/api/conversations/${sessionId}/cancel`, {
      method: "POST",
      headers: this.getHeaders(),
    })
  }

  subscribeToEvents(handler: (event: BackendEvent) => void): () => void {
    this.eventListeners.add(handler)
    return () => this.eventListeners.delete(handler)
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.config?.apiKey) {
      headers["x-api-key"] = this.config.apiKey
    }
    if (this.config?.headers) {
      Object.assign(headers, this.config.headers)
    }
    return headers
  }

  private connectWebSocket() {
    if (!this.config) return
    const wsUrl = this.config.url.replace(/^http/, "ws") + "/api/ws"
    this.ws = new WebSocket(wsUrl)
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      for (const listener of this.eventListeners) {
        listener({ type: data.type, payload: data })
      }
    }
    this.ws.onclose = () => {
      if (this.connected) {
        setTimeout(() => this.connectWebSocket(), 2000)
      }
    }
  }
}
