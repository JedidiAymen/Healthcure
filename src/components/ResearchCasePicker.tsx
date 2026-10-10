import { useMemo, useState } from "react";
import type { CaseRecord } from "@/lib/api";
import { searchResearchCases } from "@/lib/source-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

type ResearchCasePickerProps = {
  id: string;
  label: string;
  cases: CaseRecord[];
  value: string;
  onValueChange: (caseId: string) => void;
  loading?: boolean;
  error?: string;
  placeholder?: string;
};

export function ResearchCasePicker({
  id,
  label,
  cases,
  value,
  onValueChange,
  loading = false,
  error = "",
  placeholder = "Choose an installed source case",
}: ResearchCasePickerProps) {
  const [query, setQuery] = useState("");
  const eligible = useMemo(() => cases.filter((item) => item.status === "ready"), [cases]);
  const selected = cases.find((item) => item.id === value) ?? null;
  const matches = useMemo(() => searchResearchCases(eligible, query, value, 12), [eligible, query, value]);
  const helper = loading
    ? "Loading checksum-verified source cases…"
    : error
      ? `Source registry unavailable: ${error}`
      : eligible.length
        ? `${eligible.length.toLocaleString()} installed cases are ready for a draft. Publication rights are checked separately.`
        : "No eligible installed source cases are available.";

  return (
    <Field className="grid min-w-0 gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {eligible.length <= 20 ? (
        <Select items={eligible.map((item) => ({ label: `${item.label} · ${item.dataset_id} · ${item.reference_kind}`, value: item.id }))} value={eligible.some((item) => item.id === value) ? value : null} onValueChange={(next) => { if (next) onValueChange(next); }} disabled={loading || eligible.length === 0}>
          <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {eligible.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.dataset_id} · {item.reference_kind}</SelectItem>)}
              {!eligible.length && <SelectItem value="no-installed-source" disabled>{loading ? "Loading source cases…" : "No eligible source cases available"}</SelectItem>}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Combobox
          items={matches.items}
          filter={null}
          value={selected}
          inputValue={query || selected?.label || ""}
          onInputValueChange={setQuery}
          onValueChange={(item) => { if (item) { setQuery(""); onValueChange(item.id); } }}
          itemToStringLabel={(item) => item.label}
          itemToStringValue={(item) => item.id}
          isItemEqualToValue={(item, selectedItem) => item.id === selectedItem.id}
          autoHighlight
        >
          <ComboboxInput id={id} className="w-full" aria-label={`${label}; search by case, dataset, specialty, source, split, video, or frame`} placeholder="Search case, dataset, source, specialty, split, or frame" showClear />
          <ComboboxContent>
            {query.trim() && <ComboboxEmpty>No eligible installed source cases match that search.</ComboboxEmpty>}
            {!query.trim() && !matches.items.length && <ComboboxEmpty>{loading ? "Loading checksum-verified cases…" : "No eligible installed source cases."}</ComboboxEmpty>}
            <ComboboxList>{(item) => <ComboboxItem key={item.id} value={item} className="items-start"><span className="grid min-w-0 gap-0.5"><span className="font-medium">{item.label}</span><span className="truncate text-[11px] text-muted-foreground">{item.module} · {item.dataset_id} · {item.source_case_id} · {item.reference_kind}</span></span></ComboboxItem>}</ComboboxList>
            <div className="border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground" role="status" aria-live="polite">{loading ? "Loading installed source cases…" : query.trim() ? `Showing ${matches.items.length} of ${matches.total.toLocaleString()} eligible matches — refine your search` : `Showing ${matches.items.length} of ${matches.total.toLocaleString()} eligible installed cases · type to search`}</div>
          </ComboboxContent>
        </Combobox>
      )}
      <small className="text-xs leading-5 text-muted-foreground">{helper}</small>
      {selected && selected.status !== "ready" && <small role="status" className="text-xs leading-5 text-warning">This saved draft references a source that is no longer ready. Review source status before saving or publishing.</small>}
    </Field>
  );
}
