import { Router, type Response } from 'express'
import { streamChat } from '../anythingllm.js'

export const askRouter = Router()

function sendSseError(res: Response, message: string) {
  res.write(`data: ${JSON.stringify({ type: 'error', error: message, close: true })}\n\n`)
  res.end()
}

askRouter.post('/', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''

  if (!message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  let upstream: globalThis.Response
  try {
    upstream = await streamChat(message)
  } catch {
    sendSseError(res, 'Could not reach AnythingLLM. Is the container running?')
    return
  }

  if (!upstream.ok || !upstream.body) {
    sendSseError(res, `AnythingLLM returned an error (status ${upstream.status}).`)
    return
  }

  const reader = upstream.body.getReader()
  req.on('close', () => reader.cancel().catch(() => {}))

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } catch {
    sendSseError(res, 'Lost connection to AnythingLLM while streaming the response.')
    return
  }

  res.end()
})
