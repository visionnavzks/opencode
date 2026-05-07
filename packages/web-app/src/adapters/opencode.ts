import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type {
  BackendAdapter,
  BackendConnectionConfig,
  BackendEvent,
  BackendMessage,
  BackendSession,
  BackendProvider as BackendProviderType,
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
    return (result.data ?? []).map((s) => ({
      id: s.id,
      title: s.title ?? undefined,
      createdAt: new Date(s.time.created).getTime(),
      updatedAt: s.time.updated ? new Date(s.time.updated).getTime() : undefined,
      parentId: s.parentID ?? undefined,
    }))
  }

  async getSession(id: string): Promise<BackendSession | undefined> {
    if (!this.client) throw new Error("Not connected")
    const sessions = await this.listSessions()
    return sessions.find((s) => s.id === id)
  }

  async createSession(opts?: { title?: string; model?: string }): Promise<BackendSession> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.session.create({
      body: {
        ...(opts?.model ? { modelID: opts.model } : {}),
      },
    })
    if (result.error) throw new Error("Failed to create session")
    const s = result.data!
    return {
      id: s.id,
      title: s.title ?? undefined,
      createdAt: new Date(s.time.created).getTime(),
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.remove({ path: { id } })
  }

  async getMessages(sessionId: string): Promise<BackendMessage[]> {
    if (!this.client) throw new Error("Not connected")
    const result = await this.client.message.list({ path: { sessionID: sessionId } })
    if (result.error) throw new Error("Failed to get messages")
    return (result.data ?? []).map((m) => ({
      id: m.id,
      sessionId,
      role: m.role as "user" | "assistant" | "system" | "tool",
      content: "",
      createdAt: new Date(m.time.created).getTime(),
      metadata: m.metadata ?? undefined,
    }))
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.chat({
      body: { parts: [{ type: "text", text: content }] },
      path: { id: sessionId },
    })
  }

  async cancelMessage(sessionId: string): Promise<void> {
    if (!this.client) throw new Error("Not connected")
    await this.client.session.abort({ path: { id: sessionId } })
  }

  subscribeToEvents(handler: (event: BackendEvent) => void): () => void {
    this.eventListeners.add(handler)
    return () => this.eventListeners.delete(handler)
  }

  listProviders = undefined
  listModels = undefined
  switchModel = undefined

  private startEventStream() {
    this.eventAbort?.abort()
    this.eventAbort = new AbortController()
    // Event streaming would be implemented here using SSE
  }
}
