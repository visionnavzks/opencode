import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type {
  BackendAdapter,
  BackendConnectionConfig,
  BackendEvent,
  BackendMessage,
  BackendSession,
} from "../provider/types"

export class OpenCodeAdapter implements BackendAdapter {
  readonly id = "opencode"
  readonly name = "OpenCode"

  private client: OpencodeClient | null = null
  private config: BackendConnectionConfig | null = null
  private eventAbort: AbortController | null = null
  private eventListeners = new Set<(event: BackendEvent) => void>()

  async connect(config: BackendConnectionConfig): Promise<void> {
    this.config = config
    const headers: Record<string, string> = { ...config.headers }
    if (config.password) {
      headers["Authorization"] = `Basic ${btoa(`${config.username ?? "opencode"}:${config.password}`)}`
    }
    this.client = createOpencodeClient({
      baseUrl: config.url,
      headers,
    })
    // Verify connection by hitting health endpoint
    const healthResult = await this.health()
    if (!healthResult.healthy) throw new Error("Cannot connect to OpenCode server")
    this.startEventStream()
  }

  async disconnect(): Promise<void> {
    this.eventAbort?.abort()
    this.eventAbort = null
    this.client = null
    this.config = null
  }

  isConnected(): boolean {
    return this.client !== null
  }

  async health(): Promise<{ healthy: boolean; version?: string }> {
    if (!this.client) return { healthy: false }
    const result = await this.client.global.health()
    return { healthy: !result.error, version: result.data?.version }
  }

  async listSessions(): Promise<BackendSession[]> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.session.list()
    if (result.error) throw new Error("Failed to list sessions")
    return (result.data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      title: (s.title as string) ?? undefined,
      createdAt: s.time ? new Date((s.time as Record<string, string>).created).getTime() : Date.now(),
      updatedAt: s.time && (s.time as Record<string, string>).updated
        ? new Date((s.time as Record<string, string>).updated).getTime()
        : undefined,
      parentId: (s.parentID as string) ?? undefined,
    }))
  }

  async getSession(id: string): Promise<BackendSession | undefined> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.session.get({ sessionID: id })
    if (result.error) return undefined
    const s = result.data as Record<string, unknown>
    if (!s) return undefined
    return {
      id: s.id as string,
      title: (s.title as string) ?? undefined,
      createdAt: s.time ? new Date((s.time as Record<string, string>).created).getTime() : Date.now(),
    }
  }

  async createSession(opts?: { title?: string; model?: string }): Promise<BackendSession> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.session.create({
      title: opts?.title,
    })
    if (result.error) throw new Error("Failed to create session")
    const s = result.data as Record<string, unknown>
    return {
      id: s.id as string,
      title: (s.title as string) ?? undefined,
      createdAt: s.time ? new Date((s.time as Record<string, string>).created).getTime() : Date.now(),
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.delete({ sessionID: id })
  }

  async getMessages(sessionId: string): Promise<BackendMessage[]> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.session.messages({ sessionID: sessionId })
    if (result.error) throw new Error("Failed to get messages")
    return (result.data ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as string,
      sessionId,
      role: m.role as "user" | "assistant" | "system" | "tool",
      content: typeof m.content === "string" ? m.content : "",
      createdAt: m.time ? new Date((m.time as Record<string, string>).created).getTime() : Date.now(),
      metadata: (m.metadata as Record<string, unknown>) ?? undefined,
    }))
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.prompt({
      sessionID: sessionId,
      parts: [{ type: "text", text: content }],
    })
  }

  async cancelMessage(sessionId: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.abort({ sessionID: sessionId })
  }

  subscribeToEvents(handler: (event: BackendEvent) => void): () => void {
    this.eventListeners.add(handler)
    return () => this.eventListeners.delete(handler)
  }

  private startEventStream() {
    this.eventAbort?.abort()
    this.eventAbort = new AbortController()
    // SSE event streaming connects to the /event endpoint
    // Events are dispatched to all registered listeners
    if (!this.config) return
    const url = `${this.config.url}/event`
    const headers: Record<string, string> = {}
    if (this.config.password) {
      headers["Authorization"] = `Basic ${btoa(`${this.config.username ?? "opencode"}:${this.config.password}`)}`
    }
    const eventSource = new EventSource(url)
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      for (const listener of this.eventListeners) {
        listener({ type: data.type, payload: data })
      }
    }
    this.eventAbort.signal.addEventListener("abort", () => eventSource.close())
  }
}
