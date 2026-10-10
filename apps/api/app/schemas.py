"""Pydantic V2 request/response contracts; OpenAPI should be generated from these."""
from __future__ import annotations
from datetime import datetime
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

Module = Literal['surgivision','dosetwin','fistulaguard']

class ApiError(StrictModel):
    code: str
    message: str
    action: str | None = None

class LocalLoginRequest(StrictModel):
    username: str = Field(min_length=3, max_length=64, pattern=r'^[A-Za-z0-9._-]+$')
    password: str = Field(min_length=1, max_length=256)

class LocalUser(StrictModel):
    id: str
    display_name: str
    role: Literal['student','educator','researcher','admin']

class LocalSession(StrictModel):
    access_token: str
    token_type: Literal['bearer'] = 'bearer'
    expires_at: str
    user: LocalUser

class ModuleStatus(StrictModel):
    id: Module
    capability_state: Literal['ready','requires-setup','unverified']
    detail: str

class Case(StrictModel):
    id: str
    module: Module
    dataset_id: str
    source_case_id: str
    reference_kind: Literal['benchmark','research','synthetic-test']
    status: Literal['ready','blocked']
    label: str

class EducatorEvidenceItem(StrictModel):
    case: Case
    license_label: str
    draft_use: Literal['available'] = 'available'
    publication_review: Literal['required','blocked']
    publication_note: str

class StudentChallengeSummary(StrictModel):
    assignment_id: str
    version_id: str
    lesson_id: str
    title: str
    module: Module
    case_id: str
    case_label: str
    version: int
    due_at: datetime | None = None
    state: Literal['not_started','in_progress','submitted','reviewed']

class StudentPathLesson(StrictModel):
    assignment_id: str
    case_id: str
    title: str
    version: int
    case_label: str
    source_license: str
    due_at: datetime | None = None
    state: Literal['not_started','in_progress','submitted','reviewed']

class StudentLearningPath(StrictModel):
    path_id: str
    title: str
    module: Module
    description: str
    objectives: list[str]
    prerequisites: str
    limitation_notice: str
    assigned_count: int
    in_progress_count: int
    submitted_count: int
    reviewed_count: int
    lessons: list[StudentPathLesson] = Field(default_factory=list)
    source_attribution: list[str] = Field(default_factory=list)

LessonBlockType = Literal['Instruction','Evidence view','Observation','Measurement','Question','Reveal']

class EducatorLessonBlock(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    type: LessonBlockType
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(max_length=12000)

class RubricCriterion(StrictModel):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[A-Za-z0-9._-]+$')
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1200)
    max_points: int = Field(ge=1, le=100)

class EducatorRubricScore(StrictModel):
    criterion_id: str = Field(min_length=1, max_length=80)
    earned_points: int = Field(ge=0, le=100)
    note: str = Field(default='', max_length=1200)

class GradedRubricCriterion(RubricCriterion):
    earned_points: int = Field(ge=0, le=100)
    note: str = ''

class EducatorDraftContent(StrictModel):
    rubric: str = Field(default='', max_length=12000)
    rubric_criteria: list[RubricCriterion] = Field(default_factory=list, max_length=8)
    blocks: list[EducatorLessonBlock] = Field(min_length=1, max_length=40)

    @model_validator(mode='after')
    def validate_rubric(self):
        ids = [criterion.id for criterion in self.rubric_criteria]
        if len(ids) != len(set(ids)):
            raise ValueError('rubric criterion ids must be unique')
        return self

class EducatorDraftCreate(StrictModel):
    title: str = Field(min_length=1, max_length=180)
    case_id: str = Field(min_length=1, max_length=180)
    content: EducatorDraftContent

class EducatorDraftUpdate(EducatorDraftCreate):
    expected_revision: int = Field(ge=1)

class EducatorDraft(StrictModel):
    id: str
    title: str
    case_id: str
    module: Module
    revision: int
    updated_at: str
    content: EducatorDraftContent

class EducatorDraftSummary(StrictModel):
    id: str
    title: str
    case_id: str
    module: Module
    revision: int
    updated_at: str

class EducatorPublishRequest(StrictModel):
    source_terms_confirmed: bool
    source_review_note: str = Field(min_length=10, max_length=1200)

class PublishedLessonVersion(StrictModel):
    version_id: str
    lesson_id: str
    version: int
    title: str
    module: Module
    case_id: str
    case_label: str
    published_at: str
    review_status: Literal['local-unreviewed'] = 'local-unreviewed'

class EducatorCohortCreate(StrictModel):
    name: str = Field(min_length=2, max_length=100)

class EducatorCohort(StrictModel):
    id: str
    name: str
    student_count: int

class EducatorStudent(StrictModel):
    id: str
    display_name: str

class EducatorCohortMembership(StrictModel):
    student_id: str

class EducatorAssignmentCreate(StrictModel):
    lesson_version_id: str = Field(min_length=1, max_length=100)
    cohort_id: str = Field(min_length=1, max_length=100)
    due_at: datetime | None = None

class EducatorAssignment(StrictModel):
    id: str
    lesson_version_id: str
    lesson_title: str
    cohort_id: str
    due_at: datetime | None = None
    student_count: int

class StudentAttemptStart(StrictModel):
    assignment_id: str = Field(min_length=1, max_length=100)

class StudentAttemptSubmit(StrictModel):
    expected_revision: int = Field(ge=0)

StudentAttemptState = Literal['started','submitted','review_required','graded','revealed']

class StudentObservationInput(StrictModel):
    block_id: str = Field(min_length=1, max_length=100)
    response: str = Field(max_length=12000)

class StudentDoseViewerEvidence(StrictModel):
    kind: Literal['dosetwin']
    case_id: str = Field(min_length=1, max_length=180)
    voxel: tuple[int, int, int]
    roi: Literal['Brainstem','SpinalCord','RightParotid','LeftParotid','Esophagus','Larynx','Mandible','PTV56','PTV63','PTV70']
    dose_overlay: bool
    roi_overlay: bool
    dose_opacity: float = Field(ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode='after')
    def validate_voxel(self):
        if any(index < 0 or index > 127 for index in self.voxel):
            raise ValueError('OpenKBP processed grid indices must be between 0 and 127')
        return self

class StudentSurgiViewerEvidence(StrictModel):
    kind: Literal['surgivision']
    case_id: str = Field(min_length=1, max_length=180)
    frame_id: str = Field(min_length=3, max_length=40, pattern=r'^\d+_\d+$')
    selection_x_px: float = Field(ge=0, le=10000, allow_inf_nan=False)
    selection_y_px: float = Field(ge=0, le=10000, allow_inf_nan=False)

class StudentSignalViewerEvidence(StrictModel):
    kind: Literal['fistulaguard']
    case_id: str = Field(min_length=1, max_length=180)
    record_id: str = Field(pattern=r'^pat\d{3}$')
    channel: Literal['ECG','raw PZT1','raw PZT2','raw PZT3','raw PZT4']
    start_sec: float = Field(ge=0, allow_inf_nan=False)
    duration_sec: float = Field(ge=5, le=20, allow_inf_nan=False)

StudentViewerEvidence = Annotated[
    Union[StudentDoseViewerEvidence, StudentSurgiViewerEvidence, StudentSignalViewerEvidence],
    Field(discriminator='kind'),
]

class StudentAttemptDraftUpdate(StrictModel):
    expected_revision: int = Field(ge=0)
    observations: list[StudentObservationInput] = Field(max_length=40)
    viewer_evidence: StudentViewerEvidence | None = None

class StudentAttemptManifest(StrictModel):
    attempt_id: str
    assignment_id: str
    state: StudentAttemptState
    revision: int
    challenge: dict
    observations: list[StudentObservationInput]
    viewer_evidence: StudentViewerEvidence | None = None

class StudentSubmissionReceipt(StrictModel):
    attempt_id: str
    state: Literal['review_required']
    submitted_at: str

class EducatorGradeRequest(StrictModel):
    criterion_scores: list[EducatorRubricScore] = Field(min_length=2, max_length=8)
    feedback: str = Field(min_length=10, max_length=4000)
    reason: str = Field(min_length=10, max_length=1000)

class EducatorAssignedCase(StrictModel):
    module: Module
    case_id: str
    case_label: str

class EducatorAttemptReview(StrictModel):
    attempt_id: str
    student_id: str
    student_name: str
    state: StudentAttemptState
    submitted_at: str | None
    score: float | None
    observations: list[StudentObservationInput]
    rubric_criteria: list[RubricCriterion] = Field(default_factory=list)
    criterion_scores: list[GradedRubricCriterion] = Field(default_factory=list)
    viewer_evidence: StudentViewerEvidence | None = None
    assigned_case: EducatorAssignedCase | None = None

class StudentDebrief(StrictModel):
    attempt_id: str
    score: float
    max_score: float
    feedback: str
    rubric: str
    criterion_scores: list[GradedRubricCriterion] = Field(default_factory=list)
    xp_awarded: int
    reveal_blocks: list[EducatorLessonBlock] = Field(default_factory=list)
    reference_evidence: dict | None = None

class StudentRubricDimension(StrictModel):
    id: str
    title: str
    description: str
    attempts: int
    earned_points: int
    available_points: int
    average_percent: float | None

class StudentRubricHistoryPoint(StrictModel):
    id: str
    attempt_id: str
    dimension_id: str
    dimension_title: str
    lesson_title: str
    reviewed_at: str
    earned_points: int
    available_points: int
    percent: float | None

class StudentNextActivity(StrictModel):
    assignment_id: str
    title: str
    module: Module
    case_label: str
    version: int
    due_at: datetime | None = None
    state: Literal['start','resume','awaiting_review']

class StudentProgress(StrictModel):
    xp: int
    xp_enabled: bool
    achievements_enabled: bool
    graded_attempts: int
    average_score: float | None
    assigned_activities: int = 0
    next_activity: StudentNextActivity | None = None
    rubric_dimensions: list[StudentRubricDimension] = Field(default_factory=list)
    rubric_history: list[StudentRubricHistoryPoint] = Field(default_factory=list)
    achievements: list[dict] = Field(default_factory=list)

class StudentParticipationItem(StrictModel):
    attempt_id: str
    lesson_title: str
    module: Module
    case_label: str
    version: int
    state: Literal['started','submitted','review_required','graded','revealed']
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    score: float | None = None
    max_score: float | None = None

class StudentParticipationRecord(StrictModel):
    schema_version: Literal['medforge.education-participation/v1'] = Field(
        default='medforge.education-participation/v1', serialization_alias='schema'
    )
    record_type: Literal['local-education-participation'] = 'local-education-participation'
    exported_at: datetime
    notice: str
    activities: list[StudentParticipationItem] = Field(default_factory=list)

class StudentLearningPreferencesUpdate(StrictModel):
    xp_enabled: bool

class StudentAchievementPreferencesUpdate(StrictModel):
    achievements_enabled: bool

class VoxelVolumeArtifact(StrictModel):
    kind: Literal['volume'] = 'volume'
    asset_key: str
    shape: tuple[int,int,int]
    spacing_mm: tuple[float,float,float]
    coordinate_frame: Literal['openkbp-processed-voxel-grid'] = 'openkbp-processed-voxel-grid'
    orientation_known: bool = False
    native_dicom_coordinates: bool = False
    dose_unit: Literal['Gy'] = 'Gy'

class SurgicalFrameArtifact(StrictModel):
    kind: Literal['image-sequence'] = 'image-sequence'
    asset_key: str
    frame_count: int = Field(ge=1)
    has_real_video: bool = False

class SurgicalAnnotation(StrictModel):
    id: int
    category_id: int
    category_name: str
    bbox: tuple[float,float,float,float]
    segmentation: list[list[float]] | dict | None = None

class SurgicalFrameRecord(StrictModel):
    id: str
    dataset_id: str
    split: Literal['train','val','test']
    video_id: int
    frame_number: int
    file_name: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    image_sha256: str
    annotation_sha256: str
    annotations: list[SurgicalAnnotation]
    cvs_criteria: tuple[float,...] = ()
    image_path: str = Field(exclude=True)

class SurgicalMediaRecord(StrictModel):
    """Verified video-source inventory. Annotated stills never imply playable footage."""
    media_id: str
    dataset_id: Literal['Endoscapes-BBox201','Endoscapes2023'] = 'Endoscapes-BBox201'
    source_video_id: int = Field(gt=0)
    split: Literal['train','val','test']
    media_kind: Literal['native_video','sampled_sequence','annotated_stills']
    asset_uri: str | None = None
    native_fps: float | None = None
    sampling_fps: float | None = None
    duration_sec: float | None = None
    annotated_frame_count: int = Field(ge=0)
    first_frame_id: str
    last_frame_id: str
    source_url: str
    license_label: str
    allowed_use: str
    source_revision: str
    metadata_validation_status: Literal['validated','unverified']
    sampled_frame_count: int = Field(default=0, ge=0)
    capabilities: list[Literal['browse_annotated_frames','browse_sampled_sequence']]
    limitations: list[str]

class SurgicalSequenceFrame(StrictModel):
    """One source-verified still in an explicitly sampled Endoscapes sequence."""
    id: str
    split: Literal['train','val','test']
    video_id: int = Field(gt=0)
    sequence_position: int = Field(ge=0)
    frame_number: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    image_sha256: str

class SurgicalClipRecord(StrictModel):
    """A locally verified, explicitly licensed continuous surgical video clip."""
    clip_id: str
    dataset_id: Literal['Appendix300']
    procedure_label: str
    media_kind: Literal['native_video']
    duration_sec: float = Field(gt=0)
    asset_uri: str
    source_url: str
    license_label: str
    citation: str
    sha256: str
    limitations: list[str]
    source_annotation: 'SurgicalClipSourceAnnotation | None' = None

class SurgicalClipSourceAnnotation(StrictModel):
    """A source-linked timestamp and grade, never a model-generated output."""
    event_label: str
    timestamp_seconds: float = Field(ge=0)
    final_laparoscopic_grade: str
    grade_scale: Literal['Gomes']
    metadata_file: str
    metadata_bitstream_id: str
    metadata_bytes: int = Field(gt=0)
    metadata_md5: str = Field(pattern=r'^[0-9a-f]{32}$')

class CholecT50VideoRecord(StrictModel):
    """Installed source-sampled CholecT50 clip with matching source labels."""
    video_id: str = Field(pattern=r'^VID\d{2}$')
    dataset_id: Literal['CholecT50 Challenge Validation']
    procedure_label: Literal['Laparoscopic cholecystectomy']
    sampling_fps: float = Field(gt=0)
    sampled_frame_count: int = Field(ge=0)
    annotated_frame_count: int = Field(ge=0)
    first_frame_number: int = Field(ge=0)
    last_frame_number: int = Field(ge=0)
    source_url: str
    license_label: str
    citation: str
    sha256: str
    limitations: list[str]

class CholecT50TripletAnnotation(StrictModel):
    triplet_id: int = Field(ge=0)
    triplet_label: str
    instrument_label: str
    verb_label: str
    target_label: str
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    bbox_xywh_px: tuple[float,float,float,float] | None = None
    source_kind: Literal['expert reference annotation'] = 'expert reference annotation'

class CholecT50FrameRecord(StrictModel):
    frame_id: str
    video_id: str = Field(pattern=r'^VID\d{2}$')
    frame_number: int = Field(ge=0)
    sample_time_sec: float = Field(ge=0, allow_inf_nan=False)
    sampling_fps: float = Field(gt=0, allow_inf_nan=False)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    image_sha256: str
    annotation_sha256: str
    image_url: str
    phase_label: str | None = None
    annotations: list[CholecT50TripletAnnotation]

class CvsCriterionCoverage(StrictModel):
    criterion_id: Literal['two_structures','hepatocystic_triangle','cystic_plate']
    criterion_label: str
    labelled_frames: int = Field(ge=0)
    mean_zero_frames: int = Field(ge=0)
    fractional_mean_frames: int = Field(ge=0)
    mean_one_frames: int = Field(ge=0)

class CvsCoverageSplit(StrictModel):
    split: Literal['train','val','test']
    verified_frames: int = Field(ge=0)
    complete_label_frames: int = Field(ge=0)
    annotation_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    criteria: list[CvsCriterionCoverage]

class CvsCoverage(StrictModel):
    dataset_id: Literal['Endoscapes-BBox201']
    source_url: str
    verified_frames: int = Field(ge=0)
    complete_label_frames: int = Field(ge=0)
    criteria: list[CvsCriterionCoverage]
    splits: list[CvsCoverageSplit]
    interpretation_note: str

class SignalArtifact(StrictModel):
    kind: Literal['signal'] = 'signal'
    asset_key: str
    sample_rate_hz: float = Field(gt=0)
    channel_units: dict[str,str]
    duration_sec: float = Field(gt=0)

class SignalRecord(StrictModel):
    id: str
    dataset_id: str
    source_case_id: str
    case_id: str
    file_name: str
    source_sha256: str
    source_url: str
    sample_rate_hz: float = Field(gt=0)
    duration_sec: float = Field(gt=0)
    channel_units: dict[str,str]
    channels: list[str]
    sample_count: int = Field(gt=0)
    origin: Literal['measured-research-recording'] = 'measured-research-recording'
    limitations: list[str]

class SignalSample(StrictModel):
    time_sec: float
    value: float

class SignalWindow(StrictModel):
    case_id: str
    channel: str
    channel_unit: str
    source_sha256: str
    source_sample_rate_hz: float
    start_sec: float
    duration_sec: float
    original_sample_count: int
    samples: list[SignalSample]
    method: str

class SignalSpectrum(StrictModel):
    case_id: str
    channel: str
    source_sha256: str
    source_sample_rate_hz: float
    start_sec: float
    duration_sec: float
    window_samples: int
    frequencies_hz: list[float]
    power_per_hz: list[float]
    unit: str
    method: str

class SignalSpectrogram(StrictModel):
    case_id: str
    channel: str
    source_sha256: str
    source_sample_rate_hz: float
    start_sec: float
    duration_sec: float
    window_samples: int = Field(gt=0)
    hop_samples: int = Field(gt=0)
    frequencies_hz: list[float] = Field(min_length=1, max_length=128)
    times_sec: list[float] = Field(min_length=1, max_length=160)
    power_per_hz: list[list[float]] = Field(min_length=1, max_length=128)
    unit: str
    method: str

    @model_validator(mode='after')
    def validate_spectrogram_grid(self):
        if len(self.power_per_hz) != len(self.frequencies_hz):
            raise ValueError('spectrogram frequency rows must match the frequency axis')
        if any(len(row) != len(self.times_sec) for row in self.power_per_hz):
            raise ValueError('spectrogram power rows must match the time axis')
        return self

class SignalFeatures(StrictModel):
    case_id: str
    channel: str
    source_sha256: str
    source_sample_rate_hz: float
    start_sec: float
    duration_sec: float
    sample_count: int = Field(gt=0)
    finite_sample_count: int = Field(ge=0)
    nonfinite_sample_count: int = Field(ge=0)
    timestamp_interval_count: int = Field(ge=0)
    timestamp_interval_deviation_count: int = Field(ge=0)
    timestamp_interval_tolerance_fraction: float = Field(gt=0, lt=1)
    constant_signal: bool
    unit: str
    mean: float
    median: float
    standard_deviation: float
    rms: float
    peak_to_peak: float
    zero_fraction: float = Field(ge=0,le=1)
    adjacent_repeat_fraction: float = Field(ge=0,le=1)
    method: str

class SignalWindowComparisonCreate(StrictModel):
    case_id: str = Field(pattern=r'^fisav:pat\d{3}$')
    channel: Literal['ECG','raw PZT1','raw PZT2','raw PZT3','raw PZT4']
    selected_start_sec: float = Field(ge=0)
    reference_start_sec: float = Field(ge=0)
    duration_sec: float = Field(ge=0.5,le=30)

    @model_validator(mode='after')
    def distinct_windows(self):
        if self.selected_start_sec == self.reference_start_sec:
            raise ValueError('Comparison windows must start at different times')
        return self

class SignalFeatureDifference(StrictModel):
    name: Literal['mean','median','standard_deviation','rms','peak_to_peak','zero_fraction','adjacent_repeat_fraction']
    selected: float
    reference: float
    difference: float
    unit: str

class SignalWindowComparison(StrictModel):
    id: str
    kind: Literal['fistulaguard.window-feature-comparison']
    case_id: str
    channel: Literal['ECG','raw PZT1','raw PZT2','raw PZT3','raw PZT4']
    source_sha256: str
    source_doi: Literal['10.17605/OSF.IO/HYPFR'] = '10.17605/OSF.IO/HYPFR'
    duration_sec: float = Field(gt=0)
    compatible: Literal[True]
    selected_window: SignalFeatures
    reference_window: SignalFeatures
    feature_differences: list[SignalFeatureDifference]
    limitations: list[str]
    created_at: str

Artifact = Annotated[
    Union[VoxelVolumeArtifact,SurgicalFrameArtifact,SignalArtifact],
    Field(discriminator='kind')
]

class ViewerManifest(StrictModel):
    case_id: str
    modality: Literal['surgical-video','radiotherapy-volume','vascular-signal']
    artifacts: list[Artifact]
    provenance_label: str
    source_url: str
    limitations: list[str]

class VoxelSlice(StrictModel):
    case_id: str
    source_revision: str
    source_file: str
    source_sha256: str
    axis: int = Field(ge=0, le=2)
    index: int = Field(ge=0, lt=128)
    shape: tuple[int, int]
    values: list[float]
    unit: Literal['benchmark-value','Gy','binary-mask']
    source_kind: Literal['benchmark','research','synthetic-test']
    origin: Literal['benchmark-reference','computed-from-benchmark-array','synthetic-test-fixture']
    coordinate_frame: Literal['openkbp-processed-voxel-grid']

class RoiMaskVolume(StrictModel):
    """Sparse occupancy for a source-backed OpenKBP ROI surface reconstruction."""
    case_id: str
    source_revision: str
    source_file: str
    source_sha256: str
    shape: tuple[int, int, int]
    spacing_mm: tuple[float, float, float]
    voxel_count: int = Field(ge=1)
    # Source CSV flattened in C order: x-major, then y, then z (z changes fastest).
    voxel_indices_c_order: list[int]
    source_kind: Literal['benchmark','research','synthetic-test']
    origin: Literal['computed-from-benchmark-array','computed-from-synthetic-test-fixture']
    coordinate_frame: Literal['openkbp-processed-voxel-grid']
    index_convention: Literal['x-major-y-middle-z-fastest']

class DoseArtifact(StrictModel):
    id: str
    case_id: str
    source_case_id: str
    source_file_name: str
    source_file_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    source_revision: str
    shape: tuple[int, int, int]
    spacing_mm: tuple[float, float, float]
    index_convention: Literal['x-major-y-middle-z-fastest']
    dose_unit: Literal['Gy']
    origin: Literal['archived_model_prediction']
    model_revision: str
    checkpoint_sha256: str | None = Field(default=None, pattern=r'^[0-9a-f]{64}$')
    rights_basis: str
    validation_status: Literal['grid-validated-local-only']
    size_bytes: int = Field(gt=0, le=67108864)
    created_at: str

class DoseArtifactSlice(StrictModel):
    artifact: DoseArtifact
    case_id: str
    axis: int = Field(ge=0, le=2)
    index: int = Field(ge=0, lt=128)
    shape: tuple[int, int]
    reference_gy: list[float]
    prediction_gy: list[float]
    delta_gy: list[float]
    shared_display_max_gy: float = Field(gt=0)
    delta_display_max_gy: float = Field(ge=0)
    unit: Literal['Gy']
    coordinate_frame: Literal['openkbp-processed-voxel-grid']

class DoseArtifactRoiComparison(StrictModel):
    roi: str
    voxel_count: int = Field(ge=1)
    reference_mean_gy: float
    prediction_mean_gy: float
    mean_delta_gy: float
    mean_absolute_delta_gy: float
    maximum_absolute_delta_gy: float
    reference_dvh: list[DvhPoint]
    prediction_dvh: list[DvhPoint]
    reference_metrics: dict
    prediction_metrics: dict

class DoseArtifactComparison(StrictModel):
    artifact: DoseArtifact
    case_id: str
    reference_dose_sha256: str
    roi_comparisons: list[DoseArtifactRoiComparison]
    limitations: list[str]

class DoseTwinComparisonReportCreateRequest(StrictModel):
    case_id: str
    artifact_id: str = Field(pattern=r'^dose_[0-9a-f]{32}$')
    roi: str = Field(pattern=r'^(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)$')
    axis: int = Field(ge=0, le=2)
    index: int = Field(ge=0, lt=128)

class DvhPoint(StrictModel):
    dose_gy: float
    volume_percent: float

class DvhMetrics(StrictModel):
    volume_cc: float | None
    dmean_gy: float | None
    dmax_voxel_gy: float | None
    d95_gy_interpolated: float | None
    d0_1cc_gy_openkbp: float | None
    d99_gy_openkbp: float | None
    d1_gy_openkbp: float | None
    v20gy_percent: float | None
    note: str

class DvhSummary(StrictModel):
    case_id: str
    source_revision: str
    roi: str
    dose_sha256: str
    roi_sha256: str
    voxel_count: int = Field(ge=0)
    mean_dose_gy: float | None
    dose_display_max_gy: float = Field(gt=0)
    spacing_mm: tuple[float,float,float]
    ct_display_range: tuple[float,float]
    ct_display_note: str
    official_metrics: DvhMetrics
    curve: list[DvhPoint]
    method: str
    source_kind: Literal['benchmark','research','synthetic-test']
    origin: Literal['computed-from-benchmark-arrays','computed-from-synthetic-test-fixture']

class ModelRecord(StrictModel):
    id: str
    module: Module
    name: str
    operation_ids: list[str]
    upstream_url: str
    source_revision: str
    source_license: str
    readiness: Literal['ready','unverified','blocked','missing-checkpoint','missing-runtime','missing-dataset']
    details: str

class ModelValidationRequest(StrictModel):
    case_id: str
    operation_id: str

class ModelValidationResponse(StrictModel):
    model_id: str
    executable: bool
    blockers: list[str]

class RunCreateRequest(StrictModel):
    case_id: str
    operation_id: Literal['openkbp.case_summary','cvs.inference']
    attempt: int = Field(default=1, ge=1, le=10)
    # Each operation is routed to its own source-bound adapter and validation path.

class RunRecord(StrictModel):
    id: str
    case_id: str
    operation_id: str
    status: Literal['queued','running','completed','failed','cancelled']
    source_kind: Literal['benchmark','research','synthetic-test']
    results: dict | None
    provenance: dict
    failure_code: str | None = None

class ViewerEvidenceState(StrictModel):
    case_id: str
    voxel: tuple[Annotated[int,Field(ge=0,le=127)],Annotated[int,Field(ge=0,le=127)],Annotated[int,Field(ge=0,le=127)]]
    axis: int = Field(default=2, ge=0, le=2)
    roi: Literal['Brainstem','SpinalCord','RightParotid','LeftParotid','Esophagus','Larynx','Mandible','PTV56','PTV63','PTV70']
    dose_overlay: bool
    roi_overlay: bool
    dose_opacity: float = Field(ge=0,le=1)

class ReportCreateRequest(StrictModel):
    run_id: str
    viewer_state: ViewerEvidenceState | None = None

class SurgicalFrameReportCreateRequest(StrictModel):
    frame_id: str = Field(min_length=1, max_length=256)
    show_annotations: bool
    selected_annotation_id: int | None = Field(default=None, ge=0)

class ReportRecord(StrictModel):
    id: str
    run_id: str | None
    case_id: str
    status: Literal['draft','generated','failed']
    created_at: str
    document: dict

class Health(StrictModel):
    status: Literal['ok'] = 'ok'
    reference_harness: bool = True
    public_deployment_ready: bool = False
