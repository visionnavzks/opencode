/**
 * Generic backend provider interface for AI coding assistants.
 * Implement this interface to connect any AI coding tool backend
 * (opencode, Claude Code, Aider, etc.) to this web frontend.
 */

export interface BackendSession {
  id: string
  title?: string
  createdAt: number
  updatedAt?: number
  parentId?: string
}

export interface BackendMessage {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface BackendMessagePart {
  id: string
  messageId: string
  type: "text" | "tool-invocation" | "tool-result" | "reasoning" | "error"
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  state?: "pending" | "running" | "completed" | "failed"
}

export interface BackendModel {
  id: string
  name: string
  provider: string
}

export interface BackendProvider {
  id: string
  name: string
  models: BackendModel[]
}

export interface BackendEvent {
  type: string
  payload: unknown
}

/**
 * Main backend provider interface.
 * Implement this to connect any AI coding assistant backend.
 */
export interface BackendAdapter {
  /** Unique identifier for this backend */
  readonly id: string
  /** Display name */
  readonly name: string

  // Connection
  connect(config: BackendConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  health(): Promise<{ healthy: boolean; version?: string }>

  // Sessions
  listSessions(): Promise<BackendSession[]>
  getSession(id: string): Promise<BackendSession | undefined>
  createSession(opts?: { title?: string; model?: string }): Promise<BackendSession>
  deleteSession(id: string): Promise<void>

  // Messages
  getMessages(sessionId: string): Promise<BackendMessage[]>
  sendMessage(sessionId: string, content: string, opts?: SendMessageOptions): Promise<void>
  cancelMessage(sessionId: string): Promise<void>

  // Streaming
  subscribeToEvents(handler: (event: BackendEvent) => void): () => void

  // Models & Providers (optional)
  listProviders?(): Promise<BackendProvider[]>
  listModels?(): Promise<BackendModel[]>
  switchModel?(sessionId: string, modelId: string): Promise<void>
}

export interface BackendConnectionConfig {
  url: string
  username?: string
  password?: string
  apiKey?: string
  headers?: Record<string, string>
}

export interface SendMessageOptions {
  model?: string
  images?: Array<{ data: string; mediaType: string }>
}
