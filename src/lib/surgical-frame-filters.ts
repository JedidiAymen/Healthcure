import type { SurgicalFrameFilters } from "./api"
import { annotatorVotes } from "./cvs-self-check"

const SPLITS = ["train", "val", "test"] as const
const AGREEMENTS = ["unanimous", "disputed"] as const
const CRITERIA = ["two_structures", "hepatocystic_triangle", "cystic_plate"] as const
const PREFIX = "frames_"

export function cvsVoteSummary(cvs: readonly number[]): string {
  if (cvs.length !== 3) return "No CVS label"
  return cvs.map((value, index) => `C${index + 1} ${annotatorVotes(value)}/3`).join(" · ")
}

// Filters live in the URL so a filtered frame list can be shared or reopened.
export function filtersToSearch(filters: SurgicalFrameFilters, base = new URLSearchParams()): URLSearchParams {
  const search = new URLSearchParams(base)
  for (const key of ["split", "category", "agreement", "criterion", "min_value", "max_value"] as const) {
    const value = filters[key]
    if (value === undefined || value === "") search.delete(PREFIX + key)
    else search.set(PREFIX + key, String(value))
  }
  return search
}

export function filtersFromSearch(search: URLSearchParams): SurgicalFrameFilters {
  const filters: SurgicalFrameFilters = {}
  const split = search.get(PREFIX + "split")
  if (SPLITS.includes(split as never)) filters.split = split as SurgicalFrameFilters["split"]
  const category = search.get(PREFIX + "category")
  if (category) filters.category = category.slice(0, 120)
  const agreement = search.get(PREFIX + "agreement")
  if (AGREEMENTS.includes(agreement as never)) filters.agreement = agreement as SurgicalFrameFilters["agreement"]
  const criterion = search.get(PREFIX + "criterion")
  if (CRITERIA.includes(criterion as never)) filters.criterion = criterion as SurgicalFrameFilters["criterion"]
  for (const key of ["min_value", "max_value"] as const) {
    const raw = search.get(PREFIX + key)
    const value = raw === null ? NaN : Number(raw)
    if (filters.criterion && Number.isFinite(value) && value >= 0 && value <= 1) filters[key] = value
  }
  return filters
}
