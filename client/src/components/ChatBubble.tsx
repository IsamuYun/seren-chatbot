import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../hooks/useAskStream'

type Props = {
  message: ChatMessage
  isStreaming: boolean
  onRetry: () => void
}

export function ChatBubble({ message, isStreaming, onRetry }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        {message.error ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">{message.error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 active:bg-red-100 dark:bg-red-950 dark:text-red-300"
            >
              重试
            </button>
          </div>
        ) : message.content ? (
          <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-pre:my-2 max-w-none break-words">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-text-bottom" />
            )}
          </div>
        ) : (
          <TypingDots />
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
    </div>
  )
}
