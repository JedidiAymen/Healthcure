import type { SignalWindowComparison } from './api'

export function buildSignalComparisonReport(item:SignalWindowComparison){
  return {
    schema:'medforge.fistulaguard-window-comparison/v1',
    title:`FiSaV measured-window comparison · ${item.case_id}`,
    created_at_utc:item.created_at,
    case:{id:item.case_id,dataset_id:'FiSaV',source_case_id:item.case_id.split(':').at(-1)},
    source:{repository:'https://osf.io/hypfr/',doi:item.source_doi,license:'CC BY 4.0',sha256:item.source_sha256},
    analysis:{id:item.id,kind:item.kind,channel:item.channel,sample_rate_hz:item.selected_window.source_sample_rate_hz,
      duration_sec:item.duration_sec,selected_window:item.selected_window,reference_window:item.reference_window,
      feature_differences:item.feature_differences.map(feature=>feature.name.endsWith('_fraction')
        ? {...feature,difference:(feature.selected-feature.reference)*100,unit:'percentage points'}
        : feature),limitations:item.limitations},
  }
}
