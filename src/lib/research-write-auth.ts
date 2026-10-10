// General research writes need an educator or admin token; DoseTwin reviews use
// a separately designated reviewer token. Browsing stays open, so protected
// actions can prompt once and retry without storing credentials in the UI.
export type ResearchSignInPurpose = 'research_write' | 'dose_review'
export type ResearchSignInPrompt = (purpose: ResearchSignInPurpose) => Promise<boolean>

let prompt: ResearchSignInPrompt | null = null

export function setResearchSignInPrompt(next: ResearchSignInPrompt | null) {
  prompt = next
}

const researchWritePaths = [/^\/api\/v1\/comparisons(\?|$)/, /^\/api\/v1\/runs(\?|$)/, /^\/api\/v1\/reports(\/|\?|$)/, /^\/api\/v1\/models\/[^/]+\/validate$/, /^\/api\/v1\/cases\/[^/]+\/dose-artifacts(\?|$)/, /^\/api\/v1\/research-reviews$/]

export function isResearchWritePath(path: string) {
  return researchWritePaths.some(pattern => pattern.test(path))
}

export async function withResearchSignIn(path: string, send: () => Promise<Response>): Promise<Response> {
  const response = await send()
  const isDoseReview = /^\/api\/v1\/(cases\/[^/]+\/dose-artifacts\/[^/]+\/voxel|research-reviews(?:\/|\?|$))/.test(path)
  const purpose = isDoseReview ? 'dose_review' : 'research_write'
  if (!prompt || (purpose === 'research_write' && response.status !== 401) || (purpose === 'dose_review' && ![401, 403].includes(response.status)) || !isResearchWritePath(path) && !isDoseReview) return response
  const detail = await response.clone().json().catch(() => null)
  if (response.status === 401 && detail?.detail?.code !== 'AUTH_REQUIRED') return response
  if (response.status === 403 && detail?.detail?.code !== 'ROLE_REQUIRED') return response
  return (await prompt(purpose)) ? send() : response
}
