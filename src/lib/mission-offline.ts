import { useEffect, useState } from "react"
import { api, type StudentViewerEvidence } from "./api"
import { drainQueue, indexedDbStore, memoryStore, queuedSubmits, type KeyValueStore, type QueuedSubmit } from "./offline-queue"

let store: KeyValueStore | null = null
export function offlineStore(): KeyValueStore {
  // IndexedDB can be unavailable (private windows, tests); fall back to memory for this tab.
  store ??= typeof indexedDB === "undefined" ? memoryStore() : indexedDbStore()
  return store
}

// Replay: save the queued answers against the attempt's current revision, then submit with the
// original Idempotency-Key so a replay can never create a second submission.
async function replay(item: QueuedSubmit) {
  const current = await api.studentAttempt(item.attemptId)
  if (current.state !== "started") return
  const answers = Object.entries(item.answers ?? {}).map(([block_id, response]) => ({ block_id, response }))
  const saved = await api.saveStudentAttempt(item.attemptId, current.revision, answers, (item.viewerEvidence ?? current.viewer_evidence) as StudentViewerEvidence | null)
  await api.submitStudentAttempt(item.attemptId, saved.revision, item.idempotencyKey)
}

export async function replayQueuedSubmits() {
  return drainQueue(offlineStore(), replay)
}

export function useOfflineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine)
  const [queued, setQueued] = useState(0)
  useEffect(() => {
    let live = true
    const refresh = async () => { try { const count = (await queuedSubmits(offlineStore())).length; if (live) setQueued(count) } catch { /* storage unavailable */ } }
    const flush = async () => { if (navigator.onLine) { try { await replayQueuedSubmits() } catch { /* retried later */ } } await refresh() }
    const goOnline = () => { setOnline(true); void flush() }
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    void flush()
    const timer = window.setInterval(() => void flush(), 15000)
    return () => { live = false; window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); window.clearInterval(timer) }
  }, [])
  return { online, queued }
}
