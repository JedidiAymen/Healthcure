"""Opt-in local binary source endpoint for the Cornerstone3D integration spike.

This route is intentionally excluded from the normal API/OpenAPI surface and only
registers when MEDFORGE_ENABLE_CORNERSTONE_SPIKE=1 is set by the local reviewer.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
import numpy as np


def register_cornerstone_spike(
    app: FastAPI,
    expect_case: Callable[[str], object],
    case_root: Callable[[], Path | None],
    read_cached_volume: Callable[..., np.ndarray],
    source_revision: Callable[[], str],
    sha256: Callable[[Path], str],
) -> None:
    @app.get('/api/v1/cases/{case_id}/viewer/cornerstone-volume', include_in_schema=False)
    def cornerstone_volume(
        case_id: str,
        layer: str = Query('ct', pattern='^(ct|dose|roi)$'),
        roi: str = Query('Brainstem', pattern='^(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)$'),
    ) -> Response:
        case = expect_case(case_id)
        root = case_root()
        if root is None:
            raise HTTPException(status_code=404, detail='No OpenKBP case is installed')
        file_name = {'ct': 'ct.csv', 'dose': 'dose.csv', 'roi': f'{roi}.csv'}[layer]
        path = (root / file_name).resolve()
        if path.parent != root.resolve() or not path.is_file():
            raise HTTPException(status_code=404, detail=f'Required source asset {file_name} is missing')
        try:
            source = read_cached_volume(str(root.resolve()), file_name, path.stat().st_size, path.stat().st_mtime_ns)
            # OpenKBP sparse rows use C-order X/Y/Z with Z changing fastest.
            # Cornerstone/VTK scalar storage changes X fastest, so transpose before
            # flattening while retaining the same displayed X/Y/Z index identity.
            xyz = np.ascontiguousarray(source.transpose(2, 1, 0), dtype='<f4')
            body = xyz.tobytes(order='C')
        except (ValueError, OSError) as exc:
            raise HTTPException(status_code=422, detail=f'Invalid source volume: {exc}') from exc
        spacing_path = root / 'voxel_dimensions.csv'
        try:
            spacing = np.loadtxt(spacing_path, dtype=np.float64).reshape(-1)
        except (OSError, ValueError) as exc:
            raise HTTPException(status_code=422, detail='Voxel spacing is unavailable') from exc
        if spacing.shape != (3,) or not np.all(np.isfinite(spacing)) or not np.all(spacing > 0):
            raise HTTPException(status_code=422, detail='Voxel spacing must contain three positive finite values')
        return Response(
            content=body,
            media_type='application/octet-stream',
            headers={
                'X-Case-Id': case_id,
                'X-Source-Layer': layer,
                'X-Source-File': file_name,
                'X-Source-SHA256': sha256(path),
                'X-Source-Revision': source_revision(),
                'X-Volume-Dimensions': '128,128,128',
                'X-Voxel-Spacing-Mm': ','.join(str(float(v)) for v in spacing),
                'X-Index-Convention': 'OpenKBP processed X/Y/Z; native patient origin and orientation unavailable',
                'Cache-Control': 'no-store',
            },
        )
