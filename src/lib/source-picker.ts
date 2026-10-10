import type { CaseRecord } from "./api";

export type SurgicalFrameOption = {
  id: string;
  label: string;
  split: string;
  video: string;
  frame: string;
};

export type LimitedMatches<T> = {
  items: T[];
  total: number;
};

export function normalizeSourceQuery(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchSurgicalFrames(
  options: SurgicalFrameOption[],
  query: string,
  selectedId: string,
  limit = 12,
): LimitedMatches<SurgicalFrameOption> {
  const normalized = normalizeSourceQuery(query);
  if (!normalized) {
    const selectedIndex = options.findIndex((option) => option.id === selectedId);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
    const nearby = selected
      ? options.filter((option) => option.id !== selected.id && option.split === selected.split && option.video === selected.video)
      : options;
    return {
      items: [ ...(selected ? [selected] : []), ...nearby ].slice(0, limit),
      total: options.length,
    };
  }
  const terms = normalized.split(/\s+/);
  const matches = options.filter((option) => {
    const searchable = normalizeSourceQuery(`${option.label} ${option.id} ${option.split} ${option.video} ${option.frame}`);
    return terms.every((term) => searchable.includes(term));
  });
  return { items: matches.slice(0, limit), total: matches.length };
}

export function searchSignalRecords<T extends { id: string }>(
  options: T[],
  query: string,
  selectedId: string,
  label: (option: T) => string = (option) => option.id,
  limit = 12,
): LimitedMatches<T> {
  const normalized = normalizeSourceQuery(query);
  const matches = normalized
    ? options.filter((option) => {
      const searchable = normalizeSourceQuery(`${option.id} ${label(option)}`);
      return normalized.split(" ").every((term) => searchable.includes(term));
    })
    : options;
  const sorted = [
    ...matches.filter((option) => option.id === selectedId),
    ...matches.filter((option) => option.id !== selectedId),
  ];
  return { items: sorted.slice(0, limit), total: matches.length };
}

export function searchResearchCases(
  cases: CaseRecord[],
  query: string,
  selectedId: string,
  limit = 12,
): LimitedMatches<CaseRecord> {
  const eligible = cases.filter((item) => item.status === "ready");
  const normalized = normalizeSourceQuery(query);
  const matches = normalized
    ? eligible.filter((item) => {
      const searchable = normalizeSourceQuery([
        item.label, item.id, item.module, item.dataset_id, item.source_case_id, item.reference_kind,
      ].join(" "));
      return normalized.split(" ").every((term) => searchable.includes(term));
    })
    : eligible;
  const sorted = [
    ...matches.filter((item) => item.id === selectedId),
    ...matches.filter((item) => item.id !== selectedId),
  ];
  return { items: sorted.slice(0, limit), total: matches.length };
}
