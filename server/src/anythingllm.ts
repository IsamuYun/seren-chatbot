import { config } from './config.js'

export function streamChat(message: string): Promise<Response> {
  const url = `${config.anythingLlmBaseUrl}/api/v1/workspace/${config.anythingLlmWorkspaceSlug}/stream-chat`

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.anythingLlmApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, mode: 'chat' }),
  })
}
