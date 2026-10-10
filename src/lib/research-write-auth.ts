// Research writes need an educator or admin token. Browsing stays open, so a
// write that returns AUTH_REQUIRED opens one sign-in prompt and retries once.
export type ResearchSignInPrompt = () => Promise<boolean>

let prompt: ResearchSignInPrompt | null = null

export function setResearchSignInPrompt(next: ResearchSignInPrompt | null) {
  prompt = next
}

const researchWritePaths = [/^\/api\/v1\/comparisons(\?|$)/, /^\/api\/v1\/runs(\?|$)/, /^\/api\/v1\/reports(\/|\?|$)/, /^\/api\/v1\/models\/[^/]+\/validate$/, /^\/api\/v1\/cases\/[^/]+\/dose-artifacts(\?|$)/]

export function isResearchWritePath(path: string) {
  return researchWritePaths.some(pattern => pattern.test(path))
}

export async function withResearchSignIn(path: string, send: () => Promise<Response>): Promise<Response> {
  const response = await send()
  if (response.status !== 401 || !prompt || !isResearchWritePath(path)) return response
  const detail = await response.clone().json().catch(() => null)
  if (detail?.detail?.code !== 'AUTH_REQUIRED') return response
  return (await prompt()) ? send() : response
}
