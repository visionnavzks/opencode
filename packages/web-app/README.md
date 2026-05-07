# Web App - Generic AI Coding Assistant Frontend

通用 AI 编程助手 Web 前端 / A universal web frontend for AI coding assistants

## Overview / 概述

This is a standalone web frontend that can connect to different AI coding assistant backends through a pluggable adapter system. Currently supports:

这是一个独立的 Web 前端，可以通过可插拔的适配器系统连接到不同的 AI 编程助手后端。目前支持：

- **OpenCode** - Connect to an OpenCode server
- **Claude Code** - Connect to Claude Code's HTTP interface
- **Custom** - Implement the `BackendAdapter` interface for any backend

## Quick Start / 快速开始

### Prerequisites / 前置条件

Make sure you have [Bun](https://bun.sh) installed.

### Development / 开发

```bash
# From the repository root
cd packages/web-app

# Install dependencies (from repo root)
cd ../.. && bun install && cd packages/web-app

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:3100`.

### Build / 构建

```bash
bun run build
```

### Connecting to a Backend / 连接到后端

#### OpenCode

```bash
# Start opencode server first
opencode --server

# Then open http://localhost:3100 and select "OpenCode" backend
```

#### Claude Code

```bash
# Start Claude Code in HTTP mode
claude --http --port 3000

# Then open http://localhost:3100 and select "Claude Code" backend
```

## Architecture / 架构

```
packages/web-app/
├── src/
│   ├── provider/           # Backend provider abstraction layer
│   │   ├── types.ts        # BackendAdapter interface definition
│   │   ├── context.tsx     # SolidJS context for dependency injection
│   │   └── index.ts        # Public exports
│   ├── adapters/           # Backend implementations
│   │   ├── opencode.ts     # OpenCode adapter (via @opencode-ai/sdk)
│   │   ├── claude-code.ts  # Claude Code adapter (HTTP API)
│   │   └── index.ts        # Adapter exports
│   ├── app.tsx             # Main application component
│   ├── entry.tsx           # Entry point with backend selection
│   └── index.css           # Global styles
├── index.html              # HTML entry point
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Package configuration
```

## Creating a Custom Adapter / 创建自定义适配器

To connect a new AI coding backend, implement the `BackendAdapter` interface:

要连接新的 AI 编程后端，请实现 `BackendAdapter` 接口：

```typescript
import type { BackendAdapter, BackendConnectionConfig } from "./provider/types"

export class MyCustomAdapter implements BackendAdapter {
  readonly id = "my-backend"
  readonly name = "My AI Backend"

  async connect(config: BackendConnectionConfig) {
    // Initialize connection to your backend
  }

  async disconnect() {
    // Clean up connection
  }

  isConnected() {
    return true
  }

  async health() {
    return { healthy: true, version: "1.0.0" }
  }

  async listSessions() {
    // Return list of sessions/conversations
    return []
  }

  async getSession(id: string) {
    // Return a specific session
    return undefined
  }

  async createSession(opts?) {
    // Create a new session
    return { id: "new-id", createdAt: Date.now() }
  }

  async deleteSession(id: string) {
    // Delete a session
  }

  async getMessages(sessionId: string) {
    // Return messages for a session
    return []
  }

  async sendMessage(sessionId: string, content: string) {
    // Send a message to the AI
  }

  async cancelMessage(sessionId: string) {
    // Cancel an in-progress message
  }

  subscribeToEvents(handler) {
    // Subscribe to real-time events
    return () => {} // unsubscribe function
  }
}
```

Then register it in `entry.tsx`:

```typescript
import { MyCustomAdapter } from "./adapters/my-custom"

const ADAPTERS = {
  opencode: () => new OpenCodeAdapter(),
  "claude-code": () => new ClaudeCodeAdapter(),
  "my-backend": () => new MyCustomAdapter(),
}
```

## Key Design Decisions / 关键设计决策

1. **Adapter Pattern / 适配器模式**: All backend communication goes through the `BackendAdapter` interface, making it easy to add new backends without modifying the UI code.

2. **Framework / 框架**: Built with [SolidJS](https://solidjs.com/) for fine-grained reactivity and excellent performance.

3. **Styling / 样式**: Uses [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.

4. **Type Safety / 类型安全**: Full TypeScript support with strict typing for all adapter interfaces.

## License

MIT
