import { render } from "solid-js/web"
import { createSignal, Show } from "solid-js"
import { App } from "./app"
import { BackendProvider } from "./provider/context"
import type { BackendAdapter } from "./provider/types"
import { OpenCodeAdapter } from "./adapters/opencode"
import { ClaudeCodeAdapter } from "./adapters/claude-code"
import "./index.css"

const ADAPTERS: Record<string, () => BackendAdapter> = {
  opencode: () => new OpenCodeAdapter(),
  "claude-code": () => new ClaudeCodeAdapter(),
}

function Entry() {
  const [adapter, setAdapter] = createSignal<BackendAdapter | null>(null)
  const [error, setError] = createSignal("")
  const [connecting, setConnecting] = createSignal(false)

  const [selectedBackend, setSelectedBackend] = createSignal("opencode")
  const [serverUrl, setServerUrl] = createSignal("http://localhost:4096")

  const connect = async () => {
    setError("")
    setConnecting(true)
    const backend = ADAPTERS[selectedBackend()]()
    try {
      await backend.connect({ url: serverUrl() })
      setAdapter(backend)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Show
      when={adapter()}
      fallback={
        <div class="h-dvh w-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-6 p-6">
          <div class="flex flex-col items-center gap-2">
            <h1 class="text-2xl font-bold">AI Coding Assistant</h1>
            <p class="text-gray-400 text-sm">Connect to your preferred AI coding backend</p>
          </div>

          <div class="flex flex-col gap-4 w-full max-w-sm">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-gray-300">Backend</label>
              <select
                class="bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700"
                value={selectedBackend()}
                onChange={(e) => {
                  setSelectedBackend(e.currentTarget.value)
                  if (e.currentTarget.value === "opencode") setServerUrl("http://localhost:4096")
                  else if (e.currentTarget.value === "claude-code") setServerUrl("http://localhost:3000")
                }}
              >
                <option value="opencode">OpenCode</option>
                <option value="claude-code">Claude Code</option>
              </select>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm text-gray-300">Server URL</label>
              <input
                type="text"
                class="bg-gray-800 rounded-lg px-3 py-2 text-white border border-gray-700"
                value={serverUrl()}
                onInput={(e) => setServerUrl(e.currentTarget.value)}
                placeholder="http://localhost:4096"
              />
            </div>

            <Show when={error()}>
              <p class="text-red-400 text-sm">{error()}</p>
            </Show>

            <button
              type="button"
              class="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-white font-medium disabled:opacity-50"
              onClick={connect}
              disabled={connecting()}
            >
              {connecting() ? "Connecting..." : "Connect"}
            </button>
          </div>

          <div class="text-xs text-gray-500 max-w-sm text-center">
            <p>Start your backend first:</p>
            <p class="mt-1 font-mono text-gray-400">
              {selectedBackend() === "opencode" ? "opencode --server" : "claude --http --port 3000"}
            </p>
          </div>
        </div>
      }
    >
      {(backend) => (
        <BackendProvider adapter={backend()}>
          <App />
        </BackendProvider>
      )}
    </Show>
  )
}

const root = document.getElementById("root")
if (root) {
  render(() => <Entry />, root)
}
