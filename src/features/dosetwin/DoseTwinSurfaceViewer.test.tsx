import { describe, expect, it } from 'vitest'
import type { RoiMaskVolume } from '@/lib/api'
import { buildRoiImage, meshStats } from './roi-surface-geometry'

function sourceIds(points: Array<[number,number,number]>) {
  return points.map(([x,y,z])=>x*128*128+y*128+z)
}

describe('source ROI 3D geometry',()=>{
  it('maps sparse OpenKBP C-order indices to vtk X/Y/Z and preserves anisotropic spacing',()=>{
    const payload={
      case_id:'openkbp:fixture',source_revision:'fixture',source_file:'Brainstem.csv',source_sha256:'a'.repeat(64),
      shape:[128,128,128],spacing_mm:[5.422,5.422,3],voxel_count:2,
      voxel_indices_c_order:sourceIds([[5,9,11],[6,9,11]]),source_kind:'synthetic-test',
      origin:'computed-from-synthetic-test-fixture',coordinate_frame:'openkbp-processed-voxel-grid',
      index_convention:'x-major-y-middle-z-fastest',
    } satisfies RoiMaskVolume
    const {image,sourceVoxelBounds,paddedDimensions}=buildRoiImage(payload)
    expect(sourceVoxelBounds).toEqual({min:[5,9,11],max:[6,9,11]})
    expect(paddedDimensions).toEqual([4,3,3])
    const values=image.getPointData().getScalars()?.getData() as Uint8Array
    expect(values[image.computeOffsetIndex([1,1,1])]).toBe(1)
    expect(values[image.computeOffsetIndex([2,1,1])]).toBe(1)
    expect(values[image.computeOffsetIndex([1,1,2])]).toBe(0)
    expect(image.getSpacing()).toEqual([5.422,5.422,3])
    expect(image.indexToWorld([1,1,1])).toEqual([5*5.422,9*5.422,11*3])
    image.delete()
  })

  it('creates a finite surface with physical bounds at half-voxel edges',()=>{
    const payload={
      case_id:'openkbp:fixture',source_revision:'fixture',source_file:'Brainstem.csv',source_sha256:'b'.repeat(64),
      shape:[128,128,128],spacing_mm:[5.422,5.422,3],voxel_count:2,
      voxel_indices_c_order:sourceIds([[5,9,11],[6,9,11]]),source_kind:'synthetic-test',
      origin:'computed-from-synthetic-test-fixture',coordinate_frame:'openkbp-processed-voxel-grid',
      index_convention:'x-major-y-middle-z-fastest',
    } satisfies RoiMaskVolume
    const built=buildRoiImage(payload)
    const surface=meshStats(built.image)
    expect(surface.points).toBeGreaterThan(0)
    expect(surface.triangles).toBeGreaterThan(0)
    expect(surface.bounds.every(Number.isFinite)).toBe(true)
    expect(surface.bounds[0]).toBeCloseTo((5-.5)*5.422,3)
    expect(surface.bounds[1]).toBeCloseTo((6+.5)*5.422,3)
    expect(surface.bounds[2]).toBeCloseTo((9-.5)*5.422,3)
    expect(surface.bounds[4]).toBeCloseTo((11-.5)*3,3)
    surface.mesh.delete();surface.marching.delete();built.image.delete()
  })

  it('rejects malformed source indices before constructing the mesh',()=>{
    const payload={
      case_id:'openkbp:fixture',source_revision:'fixture',source_file:'Brainstem.csv',source_sha256:'c'.repeat(64),
      shape:[128,128,128],spacing_mm:[1,1,1],voxel_count:1,voxel_indices_c_order:[128**3],
      source_kind:'synthetic-test',origin:'computed-from-synthetic-test-fixture',coordinate_frame:'openkbp-processed-voxel-grid',
      index_convention:'x-major-y-middle-z-fastest',
    } satisfies RoiMaskVolume
    expect(()=>buildRoiImage(payload)).toThrow(/outside the source grid/)
  })
})
