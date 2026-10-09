import sys
from pathlib import Path
import numpy as np
import pytest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from validate_openkbp_case import read_sparse_csv, dose_statistics, validate_case


def csv_file(root: Path, name: str, values: dict[int, float | None]):
    p=root/name
    p.write_text(',data\n'+''.join(f'{k},{"" if v is None else v}\n' for k,v in values.items()))
    return p


def test_sparse_loader_and_dose_stats(tmp_path):
    shape=(2,2,2)
    csv_file(tmp_path,'dose.csv',{0:10.0,1:20.0,2:30.0,3:40.0})
    csv_file(tmp_path,'ct.csv',{0:500,1:800,2:900})
    csv_file(tmp_path,'possible_dose_mask.csv',{0:None,1:None,2:None,3:None})
    csv_file(tmp_path,'Brainstem.csv',{0:None,2:None,3:None})
    (tmp_path/'voxel_dimensions.csv').write_text('10\n10\n10\n')
    outcome=validate_case(tmp_path,shape)
    assert outcome['available_rois']['Brainstem']['voxels']==3
    assert outcome['available_rois']['Brainstem']['volume_cc']==3.0
    assert outcome['available_rois']['Brainstem']['dmean_gy']==pytest.approx(80/3,abs=1e-5)
    assert outcome['available_rois']['Brainstem']['v20gy_percent']==pytest.approx(66.66667,abs=1e-4)
    assert outcome['available_rois']['Brainstem']['dmax_voxel_gy']==40.0
    assert outcome['coordinate_frame'].startswith('OpenKBP')


def test_sparse_loader_rejects_duplicate_and_out_of_range(tmp_path):
    csv_file(tmp_path,'dup.csv',{1:2})
    (tmp_path/'dup.csv').write_text(',data\n1,2\n1,3\n')
    with pytest.raises(ValueError,match='Duplicate'):
        read_sparse_csv(tmp_path/'dup.csv',(2,2,2))
    (tmp_path/'dup.csv').write_text(',data\n8,2\n')
    with pytest.raises(ValueError,match='out-of-range'):
        read_sparse_csv(tmp_path/'dup.csv',(2,2,2))


def test_empty_roi_and_spacing_sanity():
    arr=np.array([[[10.0,20.0]]])
    roi=np.zeros_like(arr)
    assert dose_statistics(arr,roi,np.array([1,1,1]))['status']=='empty-mask'


def test_missing_data_failure(tmp_path):
    (tmp_path/'voxel_dimensions.csv').write_text('2\n3\n4\n')
    with pytest.raises(FileNotFoundError):
        validate_case(tmp_path, (2,2,2))
