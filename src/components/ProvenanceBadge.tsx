import { Badge } from "@/components/ui/badge"
import { provenanceCopy, type ProvenanceKind } from "@/lib/provenance"

// Visible provenance on every output: kind, meaning, and what it does not mean.
export function ProvenanceBadge({ kind, detail }: { kind: ProvenanceKind; detail?: string }) {
  const copy = provenanceCopy(kind)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-provenance={kind}>
      <Badge variant={kind === "ARCHIVED_PREDICTION" || kind === "IN_APP_MODEL_INFERENCE" ? "default" : "secondary"} title={`${copy.meaning} ${copy.doesNotMean}`}>
        {copy.label.toUpperCase()}
      </Badge>
      <span className="text-xs text-muted-foreground">{detail ? `${detail}. ` : ""}{copy.doesNotMean}</span>
    </span>
  )
}
