import { useEffect, useRef } from 'react'
import { useAskStream } from './hooks/useAskStream'
import { ChatBubble } from './components/ChatBubble'
import { ChatInput } from './components/ChatInput'

function App() {
  const { messages, isStreaming, ask } = useAskStream()
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastUserMessageRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const handleSend = (message: string) => {
    lastUserMessageRef.current = message
    ask(message)
  }

  const lastMessage = messages[messages.length - 1]

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 px-4 py-3 text-center dark:border-gray-800">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Seren</h1>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-gray-400">问点什么吧</p>
        )}
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            isStreaming={isStreaming && message.id === lastMessage?.id}
            onRetry={() => ask(lastUserMessageRef.current)}
          />
        ))}
        <div ref={bottomRef} />
      </main>

      <ChatInput disabled={isStreaming} onSend={handleSend} />
    </div>
  )
}

export default App
