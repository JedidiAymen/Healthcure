// Degraded mode for learner missions: drafts survive reloads, and a submit made offline is queued
// and replayed later with its original Idempotency-Key, so the server records it at most once.
// Only draft answers and queued submits are stored; no API responses or signal windows.
export type QueuedSubmit = { attemptId: string; revision: number; idempotencyKey: string; queuedAt: string; answers?: Record<string, string>; viewerEvidence?: unknown }
export type DraftRecord = { attemptId: string; answers: Record<string, string>; savedAt: string }

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

const QUEUE_KEY = "submit-queue"
const draftKey = (attemptId: string) => `draft:${attemptId}`

export function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>()
  return {
    async get<T>(key: string) { return data.get(key) as T | undefined },
    async set(key, value) { data.set(key, structuredClone(value)) },
    async remove(key) { data.delete(key) },
  }
}

export function indexedDbStore(name = "medforge-offline"): KeyValueStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore("kv")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open()
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction("kv", mode).objectStore("kv"))
      request.onsuccess = () => { resolve(request.result as T); db.close() }
      request.onerror = () => { reject(request.error); db.close() }
    })
  }
  return {
    get: <T>(key: string) => run<T | undefined>("readonly", store => store.get(key)),
    set: async (key, value) => { await run("readwrite", store => store.put(value, key)) },
    remove: async key => { await run("readwrite", store => store.delete(key)) },
  }
}

export async function saveDraft(store: KeyValueStore, attemptId: string, answers: Record<string, string>) {
  await store.set(draftKey(attemptId), { attemptId, answers, savedAt: new Date().toISOString() } satisfies DraftRecord)
}

export async function loadDraft(store: KeyValueStore, attemptId: string) {
  return store.get<DraftRecord>(draftKey(attemptId))
}

export async function clearDraft(store: KeyValueStore, attemptId: string) {
  await store.remove(draftKey(attemptId))
}

export async function queuedSubmits(store: KeyValueStore) {
  return (await store.get<QueuedSubmit[]>(QUEUE_KEY)) ?? []
}

export async function enqueueSubmit(store: KeyValueStore, item: Omit<QueuedSubmit, "queuedAt">) {
  const queue = (await queuedSubmits(store)).filter(entry => entry.attemptId !== item.attemptId)
  await store.set(QUEUE_KEY, [...queue, { ...item, queuedAt: new Date().toISOString() }])
}

export function isNetworkError(error: unknown) {
  // A stopped API behind the proxy answers 502, 503 or 504; treat those like a dropped network.
  return error instanceof TypeError
    || (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
    || (error instanceof Error && /API returned 50[234]/.test(error.message))
}

function isAuthenticationError(error: unknown) {
  // A tab reload clears the in-memory session token. Keep queued work until
  // the student signs in again; a 401/403 is not a permanent refusal of the
  // submission itself.
  return error instanceof Error && /API returned 40[13]/.test(error.message)
}

// Replays queued submits in order. Network and authentication failures stop
// replay and keep the queue; a definite submission refusal removes that item.
export async function drainQueue(store: KeyValueStore, send: (item: QueuedSubmit) => Promise<void>) {
  const queue = await queuedSubmits(store)
  const sent: QueuedSubmit[] = [], failed: { item: QueuedSubmit; error: string }[] = []
  let index = 0
  for (; index < queue.length; index++) {
    try { await send(queue[index]); sent.push(queue[index]); await clearDraft(store, queue[index].attemptId) }
    catch (error) {
      if (isNetworkError(error) || isAuthenticationError(error)) break
      failed.push({ item: queue[index], error: error instanceof Error ? error.message : String(error) })
    }
  }
  await store.set(QUEUE_KEY, queue.slice(index))
  return { sent, failed, remaining: queue.length - index }
}
