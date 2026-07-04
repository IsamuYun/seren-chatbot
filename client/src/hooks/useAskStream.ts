import { useCallback, useRef, useState } from 'react'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: string
}

type StreamChunk = {
  type?: string
  textResponse?: string
  error?: string | null
  close?: boolean
}

function parseSseBuffer(buffer: string, onChunk: (chunk: StreamChunk) => void): string {
  const events = buffer.split('\n\n')
  // Last element may be an incomplete event — keep it in the buffer for next read.
  const remainder = events.pop() ?? ''

  for (const event of events) {
    const dataLine = event.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) continue

    const json = dataLine.slice('data:'.length).trim()
    if (!json) continue

    try {
      onChunk(JSON.parse(json) as StreamChunk)
    } catch {
      // Ignore malformed chunks rather than breaking the whole stream.
    }
  }

  return remainder
}

export function useAskStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const ask = useCallback(async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed || isStreaming) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsStreaming(true)

    const updateAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessage.id ? updater(m) : m)),
      )
    }

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      })

      if (!res.body) {
        throw new Error('Empty response body')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false

      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          buffer += decoder.decode(result.value, { stream: true })
          buffer = parseSseBuffer(buffer, (chunk) => {
            if (chunk.error) {
              updateAssistant((m) => ({ ...m, error: chunk.error ?? undefined }))
              return
            }
            if (chunk.textResponse) {
              updateAssistant((m) => ({ ...m, content: m.content + chunk.textResponse }))
            }
          })
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      updateAssistant((m) => ({
        ...m,
        error: err instanceof Error ? err.message : 'Something went wrong',
      }))
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming])

  return { messages, isStreaming, ask }
}
