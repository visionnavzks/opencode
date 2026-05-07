import { createSignal, createResource, For, Show, Suspense } from "solid-js"
import { useBackend } from "./provider/context"
import type { BackendSession, BackendMessage } from "./provider/types"

function SessionList(props: {
  sessions: BackendSession[]
  activeId?: string
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div class="flex flex-col h-full">
      <div class="p-3 border-b border-gray-800">
        <button
          type="button"
          class="w-full bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          onClick={props.onCreate}
        >
          + New Session
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <For each={props.sessions}>
          {(session) => (
            <button
              type="button"
              class={`w-full text-left px-3 py-2 text-sm truncate hover:bg-gray-800 ${
                session.id === props.activeId ? "bg-gray-800 text-white" : "text-gray-400"
              }`}
              onClick={() => props.onSelect(session.id)}
            >
              {session.title || `Session ${session.id.slice(0, 8)}`}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

function MessageView(props: { message: BackendMessage }) {
  return (
    <div
      class={`px-4 py-3 ${
        props.message.role === "user"
          ? "bg-gray-800 rounded-lg ml-12"
          : props.message.role === "assistant"
            ? "mr-12"
            : "text-gray-500 text-sm"
      }`}
    >
      <div class="text-xs text-gray-500 mb-1">
        {props.message.role === "user" ? "You" : props.message.role === "assistant" ? "Assistant" : props.message.role}
      </div>
      <div class="text-sm text-gray-200 whitespace-pre-wrap">{props.message.content}</div>
    </div>
  )
}

function ChatView(props: { sessionId: string }) {
  const backend = useBackend()
  const [input, setInput] = createSignal("")
  const [sending, setSending] = createSignal(false)

  const [messages, messagesActions] = createResource(
    () => props.sessionId,
    (id) => backend.getMessages(id),
  )

  const send = async () => {
    const text = input().trim()
    if (!text || sending()) return
    setSending(true)
    setInput("")
    try {
      await backend.sendMessage(props.sessionId, text)
      messagesActions.refetch()
    } finally {
      setSending(false)
    }
  }

  return (
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <Suspense fallback={<div class="text-gray-500 text-sm">Loading messages...</div>}>
          <For each={messages() ?? []}>{(msg) => <MessageView message={msg} />}</For>
        </Suspense>
      </div>
      <div class="border-t border-gray-800 p-4">
        <div class="flex gap-2">
          <input
            type="text"
            class="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Type a message..."
            disabled={sending()}
          />
          <button
            type="button"
            class="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 text-sm text-white font-medium disabled:opacity-50"
            onClick={send}
            disabled={sending() || !input().trim()}
          >
            {sending() ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const backend = useBackend()
  const [activeSession, setActiveSession] = createSignal<string>()

  const [sessions, sessionsActions] = createResource(() => backend.listSessions())

  const createSession = async () => {
    const session = await backend.createSession()
    sessionsActions.refetch()
    setActiveSession(session.id)
  }

  return (
    <div class="h-dvh w-screen flex bg-gray-950 text-white">
      {/* Sidebar */}
      <div class="w-64 border-r border-gray-800 flex flex-col">
        <div class="p-3 border-b border-gray-800 flex items-center gap-2">
          <span class="text-sm font-semibold">{backend.name}</span>
          <span class="text-xs text-green-400">●</span>
        </div>
        <Suspense fallback={<div class="p-3 text-gray-500 text-sm">Loading...</div>}>
          <SessionList
            sessions={sessions() ?? []}
            activeId={activeSession()}
            onSelect={setActiveSession}
            onCreate={createSession}
          />
        </Suspense>
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col">
        <Show
          when={activeSession()}
          fallback={
            <div class="flex-1 flex items-center justify-center text-gray-500">
              <div class="text-center">
                <p class="text-lg">Welcome to {backend.name}</p>
                <p class="text-sm mt-2">Select or create a session to get started</p>
              </div>
            </div>
          }
        >
          {(id) => <ChatView sessionId={id()} />}
        </Show>
      </div>
    </div>
  )
}
