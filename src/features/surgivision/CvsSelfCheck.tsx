import { useEffect, useState } from "react"
import { CheckCircle2, CircleAlert, LockKeyhole, Users } from "lucide-react"
import { api, type CvsSelfCheckResult } from "@/lib/api"
import { CVS_CRITERIA, describeAnnotatorMean, isCompleteJudgement, type Judgement } from "@/lib/cvs-self-check"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = { attemptId: string; blockId: string; locked: boolean; onCommitted: (blockId: string) => void }

// The learner commits a judgement first; only then does the server return the annotator values.
export function CvsSelfCheck({ attemptId, blockId, locked, onCommitted }: Props) {
  const [judgements, setJudgements] = useState<(Judgement | null)[]>([null, null, null])
  const [result, setResult] = useState<CvsSelfCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let live = true
    api.cvsSelfCheck(attemptId, blockId).then(value => {
      if (!live || !value) return
      setResult(value)
      onCommitted(blockId)
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : "The self-check could not be loaded") })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [attemptId, blockId, onCommitted])

  const commit = async () => {
    if (!isCompleteJudgement(judgements)) return
    setBusy(true); setError("")
    try {
      setResult(await api.commitCvsSelfCheck(attemptId, blockId, judgements))
      onCommitted(blockId)
    } catch (e) { setError(e instanceof Error ? e.message : "Your judgement could not be saved") }
    finally { setBusy(false) }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading your self-check...</p>
  if (result) return (
    <div className="grid gap-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><LockKeyhole data-icon="inline-start" />Your judgement is committed</Badge><span className="text-sm text-muted-foreground">{result.matches} of 3 match the annotator majority</span></div>
      <ul className="grid gap-2">
        {result.criteria.map(item => (
          <li key={item.criterion_id} className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{item.label}</b>{item.matches_majority ? <Badge variant="outline"><CheckCircle2 data-icon="inline-start" />Matches majority</Badge> : <Badge variant="outline"><CircleAlert data-icon="inline-start" />Differs from majority</Badge>}</div>
            <p className="mt-1 text-sm">You said: {item.judgement ? "achieved" : "not achieved"}.</p>
            <p className="text-sm text-muted-foreground"><Users className="mr-1 inline size-4 align-text-bottom" aria-hidden />{describeAnnotatorMean(item.annotator_mean)}. Mean {item.annotator_mean.toFixed(2)}.</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{result.source}</p>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">{result.limitations.map(note => <li key={note}>{note}</li>)}</ul>
    </div>
  )
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Judge each criterion on this frame. Annotator values appear only after you commit, and you cannot change your answer afterwards.</p>
      {CVS_CRITERIA.map((criterion, index) => (
        <fieldset key={criterion.id} className="grid gap-2 rounded-lg border p-3" disabled={locked || busy}>
          <legend className="px-1 text-sm font-medium">{criterion.label}</legend>
          <div className="flex flex-wrap gap-2">
            {([1, 0] as const).map(value => (
              <Button key={value} type="button" size="sm" variant={judgements[index] === value ? "default" : "outline"} aria-pressed={judgements[index] === value}
                onClick={() => setJudgements(current => current.map((item, position) => position === index ? value : item))}>
                {value ? "Achieved" : "Not achieved"}
              </Button>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <Alert variant="destructive"><CircleAlert /><AlertTitle>Self-check not saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div><Button type="button" disabled={locked || busy || !isCompleteJudgement(judgements)} onClick={() => void commit()}>{busy ? "Committing..." : "Commit my judgement"}</Button></div>
    </div>
  )
}

// Compact read-only view of a committed self-check for educator review.
export function CvsSelfCheckSummary({ result }: { result: CvsSelfCheckResult }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="eyebrow">CVS self-check · {result.matches} of 3 match the annotator majority</div>
      <ul className="mt-2 grid gap-1 text-sm">
        {result.criteria.map(item => <li key={item.criterion_id}><b>{item.label}:</b> learner said {item.judgement ? "achieved" : "not achieved"}; {describeAnnotatorMean(item.annotator_mean).toLowerCase()}.</li>)}
      </ul>
    </div>
  )
}
