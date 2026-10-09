import { describe, expect, it } from 'vitest'
import type { SignalFeatures, SignalWindowComparison } from './api'
import { buildSignalComparisonReport } from './signal-evidence'

const featureWindow=(start:number):SignalFeatures=>({
  case_id:'fisav:pat001',channel:'raw PZT2',source_sha256:'a'.repeat(64),source_sample_rate_hz:10000,
  start_sec:start,duration_sec:0.4999,sample_count:5000,finite_sample_count:5000,nonfinite_sample_count:0,
  timestamp_interval_count:4999,timestamp_interval_deviation_count:0,timestamp_interval_tolerance_fraction:0.001,
  constant_signal:false,unit:'source-value (physical unit unspecified)',mean:0.2,median:0.2,
  standard_deviation:0.1,rms:0.224,peak_to_peak:0.6,zero_fraction:0.1,adjacent_repeat_fraction:0.05,
  method:'Descriptive statistics from measured samples.',
})

const comparison:SignalWindowComparison={
  id:'comparison_123',kind:'fistulaguard.window-feature-comparison',case_id:'fisav:pat001',channel:'raw PZT2',
  source_sha256:'a'.repeat(64),source_doi:'10.17605/OSF.IO/HYPFR',duration_sec:0.5,compatible:true,
  selected_window:featureWindow(0.2345),reference_window:featureWindow(1.2345),
  feature_differences:[
    {name:'mean',selected:0.2,reference:0.1,difference:0.1,unit:'source-value'},
    {name:'zero_fraction',selected:0.1,reference:0.08,difference:0.02,unit:'percentage points'},
  ],
  limitations:['Descriptive only; no diagnostic interpretation.'],created_at:'2026-10-09T15:00:00Z',
}

describe('FiSaV comparison evidence export',()=>{
  it('preserves exact windows, measured source identity, attribution and limitations',()=>{
    const report=buildSignalComparisonReport(comparison)
    expect(report.schema).toBe('medforge.fistulaguard-window-comparison/v1')
    expect(report.case).toEqual({id:'fisav:pat001',dataset_id:'FiSaV',source_case_id:'pat001'})
    expect(report.source).toEqual({repository:'https://osf.io/hypfr/',doi:'10.17605/OSF.IO/HYPFR',license:'CC BY 4.0',sha256:'a'.repeat(64)})
    expect(report.analysis.selected_window).toEqual(comparison.selected_window)
    expect(report.analysis.reference_window).toEqual(comparison.reference_window)
    expect(report.analysis.feature_differences[0]).toEqual(comparison.feature_differences[0])
    expect(report.analysis.feature_differences[1].difference).toBeCloseTo(2,10)
    expect(report.analysis.feature_differences[1].unit).toBe('percentage points')
    expect(report.analysis.limitations).toEqual(comparison.limitations)
  })
})
