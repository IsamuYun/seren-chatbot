import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  anythingLlmBaseUrl: required('ANYTHINGLLM_BASE_URL').replace(/\/+$/, ''),
  anythingLlmApiKey: required('ANYTHINGLLM_API_KEY'),
  anythingLlmWorkspaceSlug: required('ANYTHINGLLM_WORKSPACE_SLUG'),
}
