"""Pydantic V2 request/response contracts; OpenAPI should be generated from these."""
from __future__ import annotations
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

Module = Literal['surgivision','dosetwin','fistulaguard']

class ApiError(StrictModel):
    code: str
    message: str
    action: str | None = None

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

class SignalArtifact(StrictModel):
    kind: Literal['signal'] = 'signal'
    asset_key: str
    sample_rate_hz: float = Field(gt=0)
    channel_units: dict[str,str]
    duration_sec: float = Field(gt=0)

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

class ModelRecord(StrictModel):
    id: str
    module: Module
    name: str
    operation_ids: list[str]
    upstream_url: str
    readiness: Literal['ready','unverified','missing-checkpoint','missing-runtime','missing-dataset']
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
    operation_id: Literal['openkbp.case_summary']
    # Future scientific operations get discriminated, separately validated schemas.

class RunRecord(StrictModel):
    id: str
    case_id: str
    operation_id: str
    status: Literal['queued','running','completed','failed','cancelled']
    source_kind: Literal['benchmark','research','synthetic-test']
    results: dict | None
    provenance: dict
    failure_code: str | None = None

class Health(StrictModel):
    status: Literal['ok'] = 'ok'
    reference_harness: bool = True
    public_deployment_ready: bool = False
