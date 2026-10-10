import type { ModelRecord } from "./api";

export type ModelReadinessFilter = "all" | "ready" | "gated";
export type ModelModuleFilter = "all" | ModelRecord["module"];

/** Filter only fields supplied by the model registry; never infer readiness. */
export function filterModelCatalog(
  models: readonly ModelRecord[],
  options: {
    module: ModelModuleFilter;
    readiness: ModelReadinessFilter;
    search: string;
  },
): ModelRecord[] {
  const query = options.search.trim().toLocaleLowerCase();
  return models.filter((model) => {
    if (options.module !== "all" && model.module !== options.module) return false;
    if (options.readiness === "ready" && model.readiness !== "ready") return false;
    if (options.readiness === "gated" && model.readiness === "ready") return false;
    if (!query) return true;
    return [model.name, ...model.operation_ids, model.source_license, model.details]
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
}
