import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  Check,
  CircleAlert,
  Eye,
  FileText,
  GripVertical,
  Layers3,
  LockKeyhole,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  api,
  type CaseRecord,
  type EducatorLessonBlock,
  type EducatorDraftPreview,
  type PublishedLessonVersion,
  type LessonBlockType,
  type RubricCriterion,
} from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ResearchCasePicker } from "@/components/ResearchCasePicker";
import { EducatorSourcePreview } from "@/components/EducatorSourcePreview";
import { Toggle } from "@/components/ui/toggle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type LessonBlock = EducatorLessonBlock;
type LessonDraft = {
  title: string;
  caseId: string;
  rubric: string;
  rubricCriteria: RubricCriterion[];
  blocks: LessonBlock[];
};
const blockTypes: LessonBlockType[] = [
  "Instruction",
  "Evidence view",
  "Observation",
  "Measurement",
  "Question",
  "Reveal",
  "CVS self-check",
];

function emptyDraft(): LessonDraft {
  return {
    title: "Untitled evidence lesson",
    caseId: "",
    rubric: "",
    rubricCriteria: [
      { id: "evidence", title: "Evidence use", description: "Connect claims to visible source evidence.", max_points: 60 },
      { id: "limitations", title: "Limits and uncertainty", description: "State what the evidence cannot establish.", max_points: 40 },
    ],
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "Instruction",
        title: "Set the task",
        content:
          "What should the learner inspect, and what limitations should they keep in mind?",
      },
    ],
  };
}

function SortableLessonBlock({
  block,
  index,
  count,
  onShift,
  onRemove,
  onChange,
}: {
  block: LessonBlock;
  index: number;
  count: number;
  onShift: (direction: number) => void;
  onRemove: () => void;
  onChange: (field: "title" | "content", value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      size="sm"
      className={`lesson-block grid gap-1.5 transition-shadow ${isDragging ? "ring-2 ring-primary" : ""}`}
    >
      <CardHeader className="gap-1 pb-3">
        <div className="flex items-center gap-2 text-[11px] text-primary">
          <span className="tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          {block.type}
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="drag-handle cursor-grab active:cursor-grabbing"
              aria-label={`Drag ${block.type} block`}
              {...attributes}
              {...listeners}
            >
              <GripVertical />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${block.type} up`}
              disabled={index === 0}
              onClick={() => onShift(-1)}
            >
              <ArrowDown className="rotate-180" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${block.type} down`}
              disabled={index === count - 1}
              onClick={() => onShift(1)}
            >
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${block.type}`} onClick={onRemove}>
              <X />
            </Button>
          </div>
        </div>
        <CardTitle className="w-full">
          <Input
            className="w-full"
            value={block.title}
            aria-label={`${block.type} title`}
            onChange={(e) => onChange("title", e.target.value)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        <Textarea
          className="w-full"
          value={block.content}
          aria-label={`${block.type} content`}
          onChange={(e) => onChange("content", e.target.value)}
          rows={3}
        />
      </CardContent>
    </Card>
  );
}

export function LessonEditorPage() {
  const { lessonId = "new" } = useParams(),
    navigate = useNavigate();
  const [draft, setDraft] = useState<LessonDraft>(emptyDraft),
    [saved, setSaved] = useState(true);
  const [serverDraftId, setServerDraftId] = useState<string | null>(
    lessonId === "new" ? null : lessonId,
  );
  const [revision, setRevision] = useState(0),
    [draftLoading, setDraftLoading] = useState(lessonId !== "new");
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [draftUnavailable, setDraftUnavailable] = useState(false);
  const [preview, setPreview] = useState<EducatorDraftPreview | null>(null);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [published, setPublished] = useState<PublishedLessonVersion | null>(null);
  const [mobilePane, setMobilePane] = useState<"blocks" | "canvas" | "inspector">("canvas");
  const [inspectorTab, setInspectorTab] = useState<"preview" | "rubric">("preview");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editorRegion, setEditorRegion] = useState<"wide" | "tablet" | "mobile">(() => {
    if (typeof window === "undefined") return "wide";
    return window.matchMedia("(max-width: 767px)").matches ? "mobile" : window.matchMedia("(min-width: 1280px)").matches ? "wide" : "tablet";
  });
  const [cases, setCases] = useState<CaseRecord[]>([]),
    [casesLoading, setCasesLoading] = useState(true),
    [casesError, setCasesError] = useState("");
  const [evidence, setEvidence] = useState<
      Awaited<ReturnType<typeof api.educatorEvidence>>
    >([]),
    [evidenceError, setEvidenceError] = useState("");
  useEffect(() => {
    if (lessonId === "new") {
      setDraft(emptyDraft());
      setServerDraftId(null);
      setRevision(0);
      setSaved(true);
      setSaveError("");
      setDraftLoading(false);
      setDraftUnavailable(false);
      return;
    }
    let live = true;
    setDraftLoading(true);
    setDraftUnavailable(false);
    api
      .educatorDraft(lessonId)
      .then((server) => {
        if (live) {
          setDraft({
            title: server.title,
            caseId: server.case_id,
            rubric: server.content.rubric,
            rubricCriteria: server.content.rubric_criteria,
            blocks: server.content.blocks,
          });
          setServerDraftId(server.id);
          setRevision(server.revision);
          setSaved(true);
          setSaveError("");
        }
      })
      .catch((error) => {
        if (live) {
          setDraftUnavailable(true);
          setSaveError(
            error instanceof Error
              ? error.message
              : "Unable to load this server draft",
          );
        }
      })
      .finally(() => {
        if (live) setDraftLoading(false);
      });
    return () => {
      live = false;
    };
  }, [lessonId]);
  useEffect(() => {
    let live = true;
    api
      .cases()
      .then((records) => {
        if (live) {
          setCases(records);
          setCasesError("");
        }
      })
      .catch((error) => {
        if (live)
          setCasesError(
            error instanceof Error
              ? error.message
              : "The local case registry is unavailable",
          );
      })
      .finally(() => {
        if (live) setCasesLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    api
      .educatorEvidence()
      .then((records) => {
        if (live) {
          setEvidence(records);
          setEvidenceError("");
        }
      })
      .catch((error) => {
        if (live)
          setEvidenceError(
            error instanceof Error
              ? error.message
              : "Source rights information is unavailable",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const selectedCase = useMemo(
    () => cases.find((item) => item.id === draft.caseId) ?? null,
    [cases, draft.caseId],
  );
  const selectedEvidence = useMemo(
    () => evidence.find((item) => item.case.id === draft.caseId) ?? null,
    [evidence, draft.caseId],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const update = (next: LessonDraft) => {
    setDraft(next);
    setSaved(false);
    setSaveError("");
  };
  const save = async () => {
    if (!draft.caseId) {
      setSaveError("Choose an installed source case before saving.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        title: draft.title.trim(),
        case_id: draft.caseId,
        content: { rubric: draft.rubric, rubric_criteria: draft.rubricCriteria, blocks: draft.blocks },
      };
      const server = serverDraftId
        ? await api.saveEducatorDraft(serverDraftId, payload, revision)
        : await api.createEducatorDraft(payload);
      setServerDraftId(server.id);
      setRevision(server.revision);
      setSaved(true);
      if (lessonId === "new")
        navigate(`/educator/cases/${server.id}/edit`, { replace: true });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save this server draft",
      );
    } finally {
      setSaving(false);
    }
  };
  const loadPreview = async () => {
    if (!serverDraftId || !saved) return;
    setSaveError("");
    setPreview(null);
    try {
      const result = await api.educatorDraftPreview(serverDraftId);
      setPreview(result);
      setSourceConfirmed(false);
      setReviewNote("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Publication preview could not load");
    }
  };
  const publish = async () => {
    if (!serverDraftId || !preview || !sourceConfirmed || reviewNote.trim().length < 10) return;
    setSaving(true); setSaveError("");
    try {
      const version = await api.publishEducatorDraft(serverDraftId, sourceConfirmed, reviewNote.trim());
      setPublished(version);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Lesson publication was blocked");
    } finally { setSaving(false); }
  };
  const add = (type: LessonBlockType) =>
    update({
      ...draft,
      blocks: [
        ...draft.blocks,
        {
          id: crypto.randomUUID(),
          type,
          title: `${type} block`,
          content:
            type === "Question"
              ? "Write the learner question here."
              : "Describe the source-backed activity for learners.",
        },
      ],
    });
  const shift = (index: number, by: number) => {
    const next = [...draft.blocks],
      at = index + by;
    if (at < 0 || at >= next.length) return;
    [next[index], next[at]] = [next[at], next[index]];
    update({ ...draft, blocks: next });
  };
  const setBlock = (index: number, field: "title" | "content", value: string) =>
    update({
      ...draft,
      blocks: draft.blocks.map((block, i) =>
        i === index ? { ...block, [field]: value } : block,
      ),
    });
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = draft.blocks.findIndex((block) => block.id === active.id),
      to = draft.blocks.findIndex((block) => block.id === over.id);
    if (from >= 0 && to >= 0)
      update({ ...draft, blocks: arrayMove(draft.blocks, from, to) });
  };
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
    const mobile = window.matchMedia("(max-width: 767px)");
    const sync = () => setEditorRegion(wide.matches ? "wide" : mobile.matches ? "mobile" : "tablet");
    wide.addEventListener("change", sync);
    mobile.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      mobile.removeEventListener("change", sync);
    };
  }, []);
  const rubricTotal = draft.rubricCriteria.reduce((sum, item) => sum + (Number(item.max_points) || 0), 0);
  const showMobilePane = (pane: "blocks" | "canvas" | "inspector") => {
    setMobilePane(pane);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const inspector = <Card role="complementary" aria-label="Learner preview and rubric inspector" className="min-w-0 border-border bg-card shadow-none">
    <CardHeader className="pb-2">
      <div className="flex items-start gap-2.5"><Eye aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><div><CardTitle>Lesson inspector</CardTitle><CardDescription className="mt-1">Check the learner view and educator scoring guidance.</CardDescription></div></div>
    </CardHeader>
    <CardContent className="grid gap-3">
      <div role="group" aria-label="Inspector view" className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <Toggle variant="outline" aria-label="Learner preview" className="w-full min-h-9" pressed={inspectorTab === "preview"} onPressedChange={pressed => { if (pressed) setInspectorTab("preview"); }}>Preview</Toggle>
        <Toggle variant="outline" aria-label={`Rubric · ${rubricTotal} of 100 points`} className="w-full min-w-0 min-h-9 px-1 text-xs" pressed={inspectorTab === "rubric"} onPressedChange={pressed => { if (pressed) setInspectorTab("rubric"); }}>Rubric · {rubricTotal}/100</Toggle>
      </div>
      {inspectorTab === "preview" ? <div className="mt-3 grid w-full min-w-0 gap-3">
          <div className="min-h-56 rounded-xl border border-border bg-background p-4">
            <span className="text-[11px] font-semibold text-primary">Learner view</span>
            <h2 className="mb-2 mt-2 text-lg font-semibold leading-snug tracking-tight">{draft.title.trim() || "Untitled evidence lesson"}</h2>
            <p className="mb-1 mt-2 text-xs font-medium leading-relaxed">{selectedCase ? `${selectedCase.label} · ${selectedCase.dataset_id}` : "Choose a verified source to continue."}</p>
            {selectedEvidence && <p className="mb-1 mt-1 text-[11px] leading-relaxed text-muted-foreground">{selectedEvidence.license_label}</p>}
            <div className="mt-4 grid gap-3 border-t border-border pt-3">
              {draft.blocks.filter(block => block.type !== "Reveal").length ? draft.blocks.filter(block => block.type !== "Reveal").map((block, index) => <article className="border-l-2 border-primary pl-2.5" key={block.id}><span className="text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")} · {block.type}</span><h3 className="mb-1 mt-1 text-[13px] font-semibold leading-snug">{block.title || `${block.type} block`}</h3><p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{block.content || "No learner prompt entered."}</p></article>) : <p className="m-0 text-xs leading-relaxed text-muted-foreground">Add a learner-facing block to preview the lesson.</p>}
            </div>
            {draft.blocks.some(block => block.type === "Reveal") && <p className="mb-0 mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary"/> {draft.blocks.filter(block => block.type === "Reveal").length} educator reveal {draft.blocks.filter(block => block.type === "Reveal").length === 1 ? "block is" : "blocks are"} hidden from learners.</p>}
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary"/><span className="grid gap-1"><b className="text-xs font-semibold">Private answers stay hidden</b><small className="text-[11px] leading-relaxed text-muted-foreground">The server publishes its validated learner projection. The rubric and reveal blocks remain protected.</small></span></div>
      </div> : <div className="mt-3 grid w-full min-w-0 gap-3">
          <div className="flex items-center justify-between gap-2"><div><p className="m-0 text-sm font-semibold">Scored criteria</p><p className="m-0 text-xs text-muted-foreground">Set observable evidence for manual review.</p></div><span className={rubricTotal === 100 ? "font-mono text-xs text-muted-foreground" : "font-mono text-xs text-destructive"}>{rubricTotal}/100</span></div>
          <div className="grid gap-3">
            {draft.rubricCriteria.map((criterion, index) => <Card size="sm" key={criterion.id} className="shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm">{criterion.title || `Criterion ${index + 1}`} <span className="font-normal text-muted-foreground">· {criterion.max_points} pts</span></CardTitle></CardHeader><CardContent className="grid gap-3">
              <Field><FieldLabel htmlFor={`rubric-title-${criterion.id}`}>Criterion name</FieldLabel><Input id={`rubric-title-${criterion.id}`} value={criterion.title} maxLength={120} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, title: event.target.value } : item) })}/></Field>
              <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><Field><FieldLabel htmlFor={`rubric-description-${criterion.id}`}>Evidence to look for</FieldLabel><Textarea id={`rubric-description-${criterion.id}`} value={criterion.description} maxLength={1200} rows={3} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, description: event.target.value } : item) })}/></Field><Field><FieldLabel htmlFor={`rubric-points-${criterion.id}`}>Points</FieldLabel><Input id={`rubric-points-${criterion.id}`} type="number" min={1} max={100} value={criterion.max_points} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, max_points: Number(event.target.value) } : item) })}/></Field></div>
              {draft.rubricCriteria.length > 2 && <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => update({ ...draft, rubricCriteria: draft.rubricCriteria.filter(item => item.id !== criterion.id) })}>Remove criterion</Button>}
            </CardContent></Card>)}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={draft.rubricCriteria.length >= 8} onClick={() => update({ ...draft, rubricCriteria: [...draft.rubricCriteria, { id: crypto.randomUUID(), title: "New criterion", description: "Describe the observable evidence for this criterion.", max_points: 10 }] })}><Plus data-icon="inline-start"/>Add criterion</Button>
          </div>
          <Field><FieldLabel htmlFor="rubric">Private educator guidance</FieldLabel><Textarea id="rubric" rows={4} value={draft.rubric} onChange={event => update({ ...draft, rubric: event.target.value })} placeholder="Add private context for consistent manual grading."/></Field>
          <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-primary"/>This rubric is stored in the educator-only draft and excluded from student challenge summaries.</p>
      </div>}
    </CardContent>
  </Card>;
  return (
    <div className="lesson-editor-page relative min-w-0 pb-4 text-foreground">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Link className="text-primary hover:underline" to="/educator">Educator studio</Link>
        <span aria-hidden="true">/</span>
        <b className="font-medium text-foreground">Lesson draft</b>
      </div>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-4 max-[767px]:items-start max-[767px]:flex-col">
        <div className="min-w-0">
          <div className="eyebrow text-xs font-semibold tracking-wide text-primary">Server-owned lesson draft</div>
          <h1 className="mb-1 mt-1 text-[clamp(1.65rem,2.1vw,1.95rem)] font-semibold leading-tight tracking-tight text-foreground max-[1150px]:text-[1.7rem]">Compose an evidence lesson</h1>
          <p className="m-0 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Drafts and rubrics save to your educator account. Publishing creates a versioned student projection with answers kept private.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-start gap-2 min-[768px]:w-auto min-[768px]:justify-end">
          {editorRegion === "tablet" && <Button type="button" variant="outline" onClick={() => setInspectorOpen(true)}><Eye data-icon="inline-start"/>Lesson inspector</Button>}
          <span className={`mr-1 inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground ${saved ? "" : "text-amber-800 dark:text-amber-300"}`}>
            {saved ? <Check size={14} /> : <CircleAlert size={14} />}{" "}
            {saved ? (serverDraftId ? "Saved to educator account" : "Draft not saved yet") : "Unsaved changes"}
          </span>
          <Button variant="outline" onClick={() => void save()} disabled={saving || draftLoading || draftUnavailable || published !== null}>{saving ? "Saving…" : "Save draft"}</Button>
          <Button onClick={() => void loadPreview()} disabled={!serverDraftId || !saved || saving || draftUnavailable || published !== null}>Preview publication</Button>
        </div>
      </div>
      {saveError && (
        <Alert variant="destructive" className="draft-save-error">
          <CircleAlert />
          <AlertTitle>
            {draftUnavailable
              ? "Draft unavailable"
              : "Draft could not be saved"}
          </AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {published && <Alert className="mb-4"><ShieldCheck/><AlertTitle>Lesson version published</AlertTitle><AlertDescription>{published.title} · version {published.version}. This immutable learner version is ready to assign.</AlertDescription><Link to="/educator/assignments" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">Continue to assignments</Link></Alert>}
      {preview && !published && <Card className="mb-4"><CardHeader><div className="eyebrow">Student-safe preview</div><CardTitle>{preview.title}</CardTitle><CardDescription>{preview.case_label} · {preview.source_license} · {preview.reference_kind}</CardDescription></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">This preview includes learner-visible blocks. Reveal blocks and the educator rubric stay private.</p><div className="flex flex-col gap-3">{preview.blocks.map((block, index) => <Card size="sm" key={block.id}><CardHeader><div className="eyebrow">{block.type} · {String(index + 1).padStart(2, "0")}</div><CardTitle>{block.title}</CardTitle><CardDescription>{block.content || "No learner prompt entered."}</CardDescription></CardHeader></Card>)}</div><FieldGroup className="mt-5"><Field orientation="horizontal"><Checkbox id="source-confirmed" checked={sourceConfirmed} onCheckedChange={checked => setSourceConfirmed(checked === true)} disabled={preview.publication_review === "blocked"}/><FieldLabel htmlFor="source-confirmed">I reviewed the source terms and confirm this use follows the displayed license and attribution requirements.</FieldLabel></Field><Field><FieldLabel htmlFor="source-review-note">Source review note</FieldLabel><Textarea id="source-review-note" rows={3} minLength={10} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Record why this source and student use are appropriate."/></Field>{preview.publication_review === "blocked" && <Alert variant="destructive"><LockKeyhole/><AlertTitle>Publication is blocked for this source</AlertTitle><AlertDescription>Independent dataset permission has not been established. This source cannot be published to learners.</AlertDescription></Alert>}<div className="flex gap-2"><Button disabled={saving || preview.publication_review === "blocked" || !sourceConfirmed || reviewNote.trim().length < 10} onClick={() => void publish()}>{saving ? "Publishing…" : "Publish immutable version"}</Button><Button variant="outline" disabled={saving} onClick={() => setPreview(null)}>Close preview</Button></div></FieldGroup></CardContent></Card>}
      {draftLoading ? (
        <div
          role="status"
          aria-label="Loading lesson draft"
          className="grid gap-4"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid items-start gap-4 min-[1280px]:grid-cols-[13rem_minmax(0,1fr)_19rem] max-[1279px]:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)] max-[767px]:block max-[767px]:pb-20">
            <div className={`educator-lesson-canvas min-w-0 [grid-column:2] [grid-row:1] ${mobilePane === "canvas" ? "max-[767px]:block" : "max-[767px]:hidden"}`}>
              <Field className="mb-4 grid gap-2">
                <FieldLabel htmlFor="lesson-title">Lesson title</FieldLabel>
                <Input
                  id="lesson-title"
                  value={draft.title}
                  onChange={(e) => update({ ...draft, title: e.target.value })}
                />
              </Field>
              <div className="mb-2 flex items-end justify-between border-b border-border py-2 max-[767px]:items-center">
                <div>
                  <div className="eyebrow">Lesson sequence</div>
                  <h2 className="m-0 text-base font-semibold">Evidence blocks</h2>
                </div>
                <span className="text-xs text-muted-foreground">{draft.blocks.length} blocks</span>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={dragEnd}
              >
                <SortableContext
                  items={draft.blocks.map((block) => block.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="mt-2 grid gap-2">
                    {draft.blocks.map((block, index) => (
                      <SortableLessonBlock
                        key={block.id}
                        block={block}
                        index={index}
                        count={draft.blocks.length}
                        onShift={(direction) => shift(index, direction)}
                        onRemove={() =>
                          update({
                            ...draft,
                            blocks: draft.blocks.filter((_, i) => i !== index),
                          })
                        }
                        onChange={(field, value) =>
                          setBlock(index, field, value)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <Card role="complementary" aria-label="Research source and lesson blocks" className={`educator-block-palette sticky top-4 [grid-column:1] [grid-row:1] max-[1150px]:[grid-row:1/span_2] max-[767px]:static max-[767px]:[grid-column:auto] max-[767px]:[grid-row:auto] ${mobilePane === "blocks" ? "max-[767px]:block" : "max-[767px]:hidden"}`}>
              <CardHeader>
                <div className="flex items-start gap-2.5"><Layers3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><div><CardTitle>Build the lesson</CardTitle><p className="mb-0 mt-1 text-xs leading-relaxed text-muted-foreground">Choose a verified source, then add the evidence tasks learners will complete.</p></div></div>
              </CardHeader>
              <CardContent>
                <div className="mb-0 grid gap-2">
                  <ResearchCasePicker id="case-select" label="Research source" cases={cases} value={draft.caseId} onValueChange={(caseId) => update({ ...draft, caseId })} loading={casesLoading} error={casesError} />
                  {selectedCase && <div className="lesson-case-summary grid wrap-anywhere gap-1 border-l-2 border-primary bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground"><b>{selectedCase.label}</b><span>{selectedCase.module} · {selectedCase.dataset_id} · {selectedCase.source_case_id}</span><span>Evidence origin: {selectedCase.reference_kind}.</span><span>Source terms: {selectedEvidence?.license_label ?? (evidenceError ? evidenceError : "Loading source terms…")}</span><span>{selectedEvidence ? `Draft use: ${selectedEvidence.draft_use}. Publication review: ${selectedEvidence.publication_review}. ${selectedEvidence.publication_note}` : "Publication permissions are not established until source review."}</span><Link className="font-medium text-primary hover:underline" to={`/studio/${selectedCase.module}/cases/${encodeURIComponent(selectedCase.id)}`}>Open this source in its scientific viewer</Link></div>}
                  <EducatorSourcePreview key={selectedCase?.id ?? "no-source"} source={selectedCase} evidence={selectedEvidence} evidenceError={evidenceError} />
                </div>
                <div className="my-3 grid gap-1 border-t border-border pt-3"><span className="text-sm font-semibold">Lesson blocks</span><small className="text-xs leading-relaxed text-muted-foreground">Arrange by drag, keyboard, or move controls.</small></div>
                <div className="grid gap-2 [&_button]:min-h-10">
                  {blockTypes.filter((type) => type !== "CVS self-check" || selectedCase?.module === "surgivision").map((type) => (
                    <Button type="button" variant="outline" size="sm" className="w-full justify-start" key={type} onClick={() => add(type)}>
                      <Plus data-icon="inline-start" />
                      {type}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-[19px_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border pt-3 [&_svg]:row-span-2 [&_svg]:text-primary [&_b]:text-sm [&_p]:col-start-2 [&_p]:m-0 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-muted-foreground">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <b>Student answer protection</b>
                  <p>
                    Publication checks source rights, removes reveal blocks from learner view, and stores the rubric separately.
                  </p>
                </div>
              </CardContent>
            </Card>
            {editorRegion === "wide" && <aside className="sticky top-4 [grid-column:3] [grid-row:1]">{inspector}</aside>}
          </div>
          {editorRegion === "tablet" && <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}><SheetContent className="overflow-y-auto sm:max-w-[30rem]"><SheetHeader><SheetTitle>Lesson inspector</SheetTitle><SheetDescription>Review the learner projection or edit educator-only scoring criteria.</SheetDescription></SheetHeader><div className="overflow-y-auto px-4 pb-4">{inspector}</div></SheetContent></Sheet>}
          {editorRegion === "mobile" && <div className={mobilePane === "inspector" ? "max-[767px]:block" : "max-[767px]:hidden"}>{inspector}</div>}
          <nav className="educator-mobile-nav fixed inset-x-2.5 bottom-2.5 z-20 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 shadow-lg min-[768px]:hidden" aria-label="Lesson builder sections">
            <button type="button" className="flex min-h-13 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary" aria-pressed={mobilePane === "blocks"} onClick={() => showMobilePane("blocks")}><Layers3 aria-hidden="true" className="size-4"/>Source & blocks</button>
            <button type="button" className="flex min-h-13 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary" aria-pressed={mobilePane === "canvas"} onClick={() => showMobilePane("canvas")}><FileText aria-hidden="true" className="size-4"/>Lesson canvas</button>
            <button type="button" className="flex min-h-13 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary" aria-pressed={mobilePane === "inspector"} onClick={() => showMobilePane("inspector")}><Eye aria-hidden="true" className="size-4"/>Preview & rubric</button>
          </nav>
        </>
      )}
    </div>
  );
}
