declare module '@kitware/vtk.js/Filters/General/ImageMarchingCubes' {
  import type vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'
  import type vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData'
  import type { vtkPipelineConnection } from '@kitware/vtk.js/types'
  interface vtkImageMarchingCubes {
    setInputData(image: vtkImageData): void
    setContourValue(value: number): void
    setComputeNormals(value: boolean): void
    setMergePoints(value: boolean): void
    getOutputPort(port?: number): vtkPipelineConnection
    getOutputData(port?: number): vtkPolyData
    update(): void
    delete(): void
  }
  const vtkImageMarchingCubes: { newInstance(): vtkImageMarchingCubes }
  export default vtkImageMarchingCubes
}
