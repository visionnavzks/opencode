import { createContext, useContext, type ParentProps } from "solid-js"
import type { BackendAdapter } from "./types"

const BackendContext = createContext<BackendAdapter>()

export function BackendProvider(props: ParentProps<{ adapter: BackendAdapter }>) {
  return <BackendContext.Provider value={props.adapter}>{props.children}</BackendContext.Provider>
}

export function useBackend(): BackendAdapter {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error("useBackend must be used within BackendProvider")
  return ctx
}
