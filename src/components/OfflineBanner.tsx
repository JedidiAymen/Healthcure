import { CloudOff, RefreshCw } from "lucide-react"
import { useOfflineStatus } from "@/lib/mission-offline"

// Degraded-mode status: shown only when offline or when submissions are waiting to be sent.
export function OfflineBanner() {
  const { online, queued } = useOfflineStatus()
  if (online && queued === 0) return null
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
      {online ? <RefreshCw aria-hidden className="size-4" /> : <CloudOff aria-hidden className="size-4" />}
      <span>{online ? "Back online." : "Offline. Draft answers are saved on this device."} {queued > 0 ? `${queued} submission${queued === 1 ? "" : "s"} waiting to send; they are sent automatically when the connection returns.` : ""}</span>
    </div>
  )
}
