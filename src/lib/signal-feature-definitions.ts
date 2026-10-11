// How each FiSaV descriptive feature is computed. Mirrors apps/api/app/fisav.py features(); N is the
// number of samples in the selected window, x the raw source values (physical unit unspecified).
export type SignalFeatureDefinition = { label: string; formula: string; note: string }

export const SIGNAL_FEATURE_DEFINITIONS: SignalFeatureDefinition[] = [
  { label: "Mean", formula: "sum(x) / N", note: "Average source value; includes any sensor offset." },
  { label: "Median", formula: "middle value of the sorted samples", note: "Less sensitive to spikes than the mean." },
  { label: "Standard deviation", formula: "sqrt( sum((x - mean)^2) / N )", note: "Population form (divides by N); spread around the mean." },
  { label: "RMS", formula: "sqrt( sum(x^2) / N )", note: "Not detrended, so a constant offset raises it." },
  { label: "Peak-to-peak", formula: "max(x) - min(x)", note: "One spike can dominate it." },
  { label: "Exact zero fraction", formula: "count(x == 0) / N", note: "High values can indicate dropouts." },
  { label: "Adjacent repeats", formula: "count(x[i+1] == x[i]) / (N - 1)", note: "High values can indicate clipping or a stuck sensor." },
]
