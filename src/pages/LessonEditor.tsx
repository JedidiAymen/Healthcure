import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDownRight,
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
import "./lesson-editor.css";
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
      className={`lesson-block${isDragging ? " dragging" : ""}`}
    >
      <CardHeader className="lesson-block-header">
        <div className="block-type">
          <span>{String(index + 1).padStart(2, "0")}</span>
          {block.type}
          <div>
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
              <ArrowDownRight className="arrow-up" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${block.type} down`}
              disabled={index === count - 1}
              onClick={() => onShift(1)}
            >
              <ArrowDownRight />
            </Button>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${block.type}`} onClick={onRemove}>
              <X />
            </Button>
          </div>
        </div>
        <CardTitle className="lesson-block-title">
          <Input
            className="lesson-block-title-input"
            value={block.title}
            aria-label={`${block.type} title`}
            onChange={(e) => onChange("title", e.target.value)}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="lesson-block-content">
        <Textarea
          className="lesson-block-content-input"
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
  const [mobilePane, setMobilePane] = useState<"blocks" | "canvas" | "preview">("canvas");
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
  return (
    <div className="lesson-editor-page" data-mobile-pane={mobilePane}>
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Link className="text-primary hover:underline" to="/educator">Educator studio</Link>
        <span aria-hidden="true">/</span>
        <b className="font-medium text-foreground">Lesson draft</b>
      </div>
      <div className="editor-title">
        <div>
          <div className="eyebrow">Server-owned lesson draft</div>
          <h1>Compose an evidence lesson</h1>
          <p>
            Drafts and rubrics save to your educator account. Publishing creates a versioned student projection with answers kept private.
          </p>
        </div>
        <div className="editor-actions">
          <span className={saved ? "saved-label" : "unsaved-label"}>
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
          className="draft-loading"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="builder-grid educator-builder-grid">
            <div className="builder-main educator-lesson-canvas">
              <Field className="builder-field">
                <FieldLabel htmlFor="lesson-title">Lesson title</FieldLabel>
                <Input
                  id="lesson-title"
                  value={draft.title}
                  onChange={(e) => update({ ...draft, title: e.target.value })}
                />
              </Field>
              <div className="builder-section-head">
                <div>
                  <div className="eyebrow">Lesson sequence</div>
                  <h2>Evidence blocks</h2>
                </div>
                <span>{draft.blocks.length} blocks</span>
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
                  <div className="block-list">
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
              <section className="builder-field rubric-field">
                <FieldLabel>Scored rubric · 100 points total</FieldLabel>
                <div className="flex flex-col gap-3">
                  {draft.rubricCriteria.map((criterion, index) => (
                    <Card size="sm" key={criterion.id}>
                      <CardHeader><CardTitle>Criterion {index + 1} · {criterion.max_points} points</CardTitle></CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                        <Field><FieldLabel htmlFor={`rubric-title-${criterion.id}`}>Name</FieldLabel><Input id={`rubric-title-${criterion.id}`} value={criterion.title} maxLength={120} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, title: event.target.value } : item) })}/></Field>
                        <Field><FieldLabel htmlFor={`rubric-points-${criterion.id}`}>Maximum</FieldLabel><Input id={`rubric-points-${criterion.id}`} type="number" min={1} max={100} value={criterion.max_points} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, max_points: Number(event.target.value) } : item) })}/></Field>
                        <Field className="sm:col-span-2"><FieldLabel htmlFor={`rubric-description-${criterion.id}`}>What to look for</FieldLabel><Textarea id={`rubric-description-${criterion.id}`} value={criterion.description} maxLength={1200} rows={2} onChange={event => update({ ...draft, rubricCriteria: draft.rubricCriteria.map(item => item.id === criterion.id ? { ...item, description: event.target.value } : item) })}/></Field>
                        {draft.rubricCriteria.length > 2 && <Button type="button" variant="outline" size="sm" className="sm:col-span-2 justify-self-start" onClick={() => update({ ...draft, rubricCriteria: draft.rubricCriteria.filter(item => item.id !== criterion.id) })}>Remove criterion</Button>}
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" disabled={draft.rubricCriteria.length >= 8} onClick={() => update({ ...draft, rubricCriteria: [...draft.rubricCriteria, { id: crypto.randomUUID(), title: "New criterion", description: "Describe the observable evidence for this criterion.", max_points: 10 }] })}><Plus size={15}/>Add criterion</Button><span className={draft.rubricCriteria.reduce((sum, item) => sum + (Number(item.max_points) || 0), 0) === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>Maximum points: {draft.rubricCriteria.reduce((sum, item) => sum + (Number(item.max_points) || 0), 0)} / 100</span></div>
                </div>
                <Field>
                  <FieldLabel htmlFor="rubric">Private educator guidance</FieldLabel>
                  <Textarea
                    id="rubric"
                    rows={4}
                    value={draft.rubric}
                    onChange={(e) => update({ ...draft, rubric: e.target.value })}
                    placeholder="Add any private context that helps another educator apply these criteria consistently."
                  />
                </Field>
                <small>
                  The rubric is saved in the educator-only draft record and is
                  never included in student challenge summaries.
                </small>
              </section>
            </div>
            <Card role="complementary" aria-label="Research source and lesson blocks" className="builder-aside educator-block-palette">
              <CardHeader>
                <div className="educator-zone-heading"><Layers3 aria-hidden="true"/><div><CardTitle>Build the lesson</CardTitle><p>Choose a verified source, then add the evidence tasks learners will complete.</p></div></div>
              </CardHeader>
              <CardContent>
                <div className="builder-field">
                  <ResearchCasePicker id="case-select" label="Research source" cases={cases} value={draft.caseId} onValueChange={(caseId) => update({ ...draft, caseId })} loading={casesLoading} error={casesError} />
                  {selectedCase && <div className="lesson-case-summary"><b>{selectedCase.label}</b><span>{selectedCase.module} · {selectedCase.dataset_id} · {selectedCase.source_case_id}</span><span>Evidence origin: {selectedCase.reference_kind}.</span><span>Source terms: {selectedEvidence?.license_label ?? (evidenceError ? evidenceError : "Loading source terms…")}</span><span>{selectedEvidence ? `Draft use: ${selectedEvidence.draft_use}. Publication review: ${selectedEvidence.publication_review}. ${selectedEvidence.publication_note}` : "Publication permissions are not established until source review."}</span><Link to={`/studio/${selectedCase.module}/cases/${encodeURIComponent(selectedCase.id)}`}>Open this source in its scientific viewer</Link></div>}
                </div>
                <div className="educator-palette-divider"><span>Lesson blocks</span><small>Arrange by drag, keyboard, or move controls.</small></div>
                <div className="add-block-list">
                  {blockTypes.map((type) => (
                    <Button type="button" variant="outline" size="sm" className="w-full justify-start" key={type} onClick={() => add(type)}>
                      <Plus data-icon="inline-start" />
                      {type}
                    </Button>
                  ))}
                </div>
                <div className="builder-security">
                  <ShieldCheck size={17} />
                  <b>Student answer protection</b>
                  <p>
                    Publication checks source rights, removes reveal blocks from learner view, and stores the rubric separately.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card role="complementary" aria-label="Learner-safe lesson preview" className="lesson-live-preview">
              <CardHeader>
                <div className="educator-zone-heading"><Eye aria-hidden="true"/><div><CardTitle>Learner preview</CardTitle><p>Private rubric and reveal content stay out of this view.</p></div></div>
              </CardHeader>
              <CardContent className="lesson-live-preview-content">
                <div className="learner-preview-paper">
                  <span className="learner-preview-kicker">Lesson preview</span>
                  <h2>{draft.title.trim() || "Untitled evidence lesson"}</h2>
                  <p className="learner-preview-source">{selectedCase ? `${selectedCase.label} · ${selectedCase.dataset_id}` : "Choose a verified source to continue."}</p>
                  {selectedEvidence && <p className="learner-preview-credit">{selectedEvidence.license_label}</p>}
                  <div className="learner-preview-sequence">
                    {draft.blocks.filter(block => block.type !== "Reveal").length ? draft.blocks.filter(block => block.type !== "Reveal").map((block, index) => <article className="learner-preview-block" key={block.id}><span>{String(index + 1).padStart(2, "0")} · {block.type}</span><h3>{block.title || `${block.type} block`}</h3><p>{block.content || "No learner prompt entered."}</p></article>) : <p className="learner-preview-empty">Add a learner-facing block to preview the lesson.</p>}
                  </div>
                  {draft.blocks.some(block => block.type === "Reveal") && <p className="learner-preview-redacted"><LockKeyhole aria-hidden="true"/> {draft.blocks.filter(block => block.type === "Reveal").length} educator reveal {draft.blocks.filter(block => block.type === "Reveal").length === 1 ? "block is" : "blocks are"} hidden from learners.</p>}
                </div>
                <div className="learner-preview-privacy"><ShieldCheck aria-hidden="true"/><span><b>Rubric stays private</b><small>The server publishes its validated learner projection. The private rubric and reveal blocks stay protected.</small></span></div>
              </CardContent>
            </Card>
          </div>
          <nav className="educator-mobile-nav" aria-label="Lesson builder sections">
            <button type="button" aria-pressed={mobilePane === "blocks"} onClick={() => setMobilePane("blocks")}><Layers3 aria-hidden="true"/>Source & blocks</button>
            <button type="button" aria-pressed={mobilePane === "canvas"} onClick={() => setMobilePane("canvas")}><FileText aria-hidden="true"/>Lesson canvas</button>
            <button type="button" aria-pressed={mobilePane === "preview"} onClick={() => setMobilePane("preview")}><Eye aria-hidden="true"/>Learner preview</button>
          </nav>
        </>
      )}
    </div>
  );
}
