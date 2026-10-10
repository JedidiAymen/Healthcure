"""Minimal FHIR R4 export of a DoseTwin research review, tagged educational and test data.

This is an interoperability sketch for future hospital system integration, not a clinical record.
The Patient carries only the pseudonymous benchmark case identifier. Observations hold the frozen
ROI dose summaries, the DiagnosticReport holds the reviewer's research decision and boundary, and
Provenance records who reviewed and which source files were compared.
"""
from __future__ import annotations

import uuid

from .research_review import BOUNDARY, ResearchReview

TAGS = {
    'tag': [{'system': 'urn:medforge:tag', 'code': 'educational-research', 'display': 'Educational and research use only'}],
    'security': [{'system': 'http://terminology.hl7.org/CodeSystem/v3-ActReason', 'code': 'HTEST', 'display': 'test health data'}],
}
UCUM = 'http://unitsofmeasure.org'


def _entry(resource: dict) -> tuple[str, dict]:
    full_url = f'urn:uuid:{uuid.uuid4()}'
    return full_url, {'fullUrl': full_url, 'resource': {**resource, 'meta': TAGS}}


def review_bundle(review: ResearchReview) -> dict:
    evidence, provenance = review.evidence, review.provenance
    patient_url, patient = _entry({
        'resourceType': 'Patient',
        'identifier': [{'system': 'urn:medforge:research-case', 'value': review.case_id}],
    })
    observations = []
    for label, value, source in (
        (f'Mean dose in {evidence.roi} (benchmark reference)', evidence.reference_mean_gy, provenance.reference_dose_sha256),
        (f'Mean dose in {evidence.roi} (archived prediction, not MEDFORGE inference)', evidence.prediction_mean_gy, provenance.prediction_sha256),
        (f'Mean dose difference in {evidence.roi} (prediction minus reference)', evidence.mean_delta_gy, provenance.prediction_sha256),
    ):
        observations.append(_entry({
            'resourceType': 'Observation', 'status': 'preliminary',
            'code': {'text': label}, 'subject': {'reference': patient_url},
            'valueQuantity': {'value': round(value, 6), 'unit': 'Gy', 'system': UCUM, 'code': 'Gy'},
            'method': {'text': provenance.method_version},
            'note': [{'text': f'Source SHA-256 {source}. Processed benchmark voxel grid, not native DICOM.'}],
        }))
    report_url, report = _entry({
        'resourceType': 'DiagnosticReport', 'status': 'preliminary',
        'code': {'text': 'DoseTwin research comparison review (benchmark reference vs archived prediction)'},
        'subject': {'reference': patient_url}, 'issued': review.created_at,
        'performer': [{'display': f'{review.reviewer_name} (research reviewer account)'}],
        'result': [{'reference': url} for url, _ in observations],
        'conclusion': f'{review.decision_label}. {review.rationale} {BOUNDARY}',
    })
    _, record = _entry({
        'resourceType': 'Provenance', 'target': [{'reference': report_url}], 'recorded': review.created_at,
        'agent': [{'who': {'display': review.reviewer_name, 'identifier': {'system': 'urn:medforge:user', 'value': review.reviewer_id}}}],
        'entity': [
            {'role': 'source', 'what': {'display': 'Benchmark reference dose', 'identifier': {'system': 'urn:sha256', 'value': provenance.reference_dose_sha256}}},
            {'role': 'source', 'what': {'display': f'Archived prediction ({provenance.prediction_model_revision}), checkpoint {provenance.prediction_checkpoint_sha256}',
                                        'identifier': {'system': 'urn:sha256', 'value': provenance.prediction_sha256}}},
        ],
    })
    return {
        'resourceType': 'Bundle', 'type': 'collection', 'timestamp': review.created_at, 'meta': TAGS,
        'identifier': {'system': 'urn:medforge:research-review', 'value': review.id},
        'entry': [patient, *[entry for _, entry in observations], report, record],
    }
