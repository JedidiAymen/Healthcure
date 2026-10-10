import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray'
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes'
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper'
import type { RoiMaskVolume } from '@/lib/api'

export function buildRoiImage(payload: RoiMaskVolume) {
  const [nx, ny, nz] = payload.shape
  if (payload.voxel_indices_c_order.length !== payload.voxel_count || nx * ny * nz !== 128 ** 3) {
    throw new Error('ROI mask dimensions or voxel count do not match the source manifest.')
  }
  const min: [number,number,number] = [nx,ny,nz]
  const max: [number,number,number] = [-1,-1,-1]
  const ijks = payload.voxel_indices_c_order.map(index => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= nx*ny*nz) throw new Error('ROI voxel index is outside the source grid.')
    const x = Math.floor(index/(ny*nz)), y = Math.floor(index/nz)%ny, z = index%nz
    min[0]=Math.min(min[0],x);min[1]=Math.min(min[1],y);min[2]=Math.min(min[2],z)
    max[0]=Math.max(max[0],x);max[1]=Math.max(max[1],y);max[2]=Math.max(max[2],z)
    return [x,y,z] as const
  })
  const start: [number,number,number] = [min[0]-1,min[1]-1,min[2]-1]
  const dims: [number,number,number] = [max[0]-min[0]+3,max[1]-min[1]+3,max[2]-min[2]+3]
  const image = vtkImageData.newInstance()
  image.setDimensions(dims)
  image.setOrigin(start.map((index,axis)=>index*payload.spacing_mm[axis]) as [number,number,number])
  image.setSpacing([...payload.spacing_mm])
  const scalars = new Uint8Array(dims[0]*dims[1]*dims[2])
  for (const [x,y,z] of ijks) scalars[(x-start[0])+((y-start[1])*dims[0])+((z-start[2])*dims[0]*dims[1])]=1
  image.getPointData().setScalars(vtkDataArray.newInstance({name:'Source ROI occupancy',numberOfComponents:1,values:scalars}))
  return {image,sourceVoxelBounds:{min,max},paddedDimensions:dims}
}

export function meshStats(image: ReturnType<typeof buildRoiImage>['image']) {
  const marching=vtkImageMarchingCubes.newInstance()
  marching.setInputData(image)
  marching.setContourValue(.5)
  marching.setComputeNormals(true)
  marching.setMergePoints(true)
  marching.update()
  const output=marching.getOutputData()
  const mesh=vtkMapper.newInstance()
  mesh.setInputConnection(marching.getOutputPort())
  return {marching,mesh,points:output.getNumberOfPoints(),triangles:output.getNumberOfPolys(),bounds:output.getBounds()}
}
