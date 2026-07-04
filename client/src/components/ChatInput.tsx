import { useState, type FormEvent, type KeyboardEvent } from 'react'

type Props = {
  disabled: boolean
  onSend: (message: string) => void
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')

  const submit = () => {
    if (disabled || !value.trim()) return
    onSend(value)
    setValue('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-gray-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-gray-950"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="问点什么..."
        rows={1}
        disabled={disabled}
        className="max-h-32 flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2 text-base leading-6 text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
        aria-label="发送"
      >
        <SendIcon />
      </button>
    </form>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
      <path d="M4 12l16-7-5 16-4-7-7-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
