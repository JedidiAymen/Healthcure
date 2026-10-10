import { describe, expect, it } from "vitest";
import type { CaseRecord } from "./api";
import {
  normalizeSourceQuery,
  searchResearchCases,
  searchSignalRecords,
  searchSurgicalFrames,
  type SurgicalFrameOption,
} from "./source-picker";

function frame(split: string, video: number, number: number): SurgicalFrameOption {
  return {
    id: `endoscapes:${split}:${video}_${number}`,
    split,
    video: String(video),
    frame: String(number),
    label: `${split} · video ${video} · frame ${number}`,
  };
}

function caseRecord(id: string, module: CaseRecord["module"], status: CaseRecord["status"] = "ready"): CaseRecord {
  return {
    id,
    module,
    dataset_id: module === "surgivision" ? "Endoscapes-BBox201" : module === "fistulaguard" ? "FiSaV" : "openkbp",
    source_case_id: id,
    label: id,
    reference_kind: "research",
    status,
  };
}

describe("source picker search", () => {
  it("normalizes case, accents, and punctuation", () => {
    expect(normalizeSourceQuery("  Éndoscapes / Video-162 ")).toBe("endoscapes video 162");
  });

  it("searches all frames, supports tokenized numeric matches, and caps results", () => {
    const options = Array.from({ length: 1933 }, (_, index) =>
      frame(index < 1700 ? "train" : "test", index === 1700 ? 162 : 100 + Math.floor(index / 50), index === 1700 ? 6575 : 2500 + index * 2),
    );
    expect(searchSurgicalFrames(options, "tr", "", 12).total).toBe(1700);
    expect(searchSurgicalFrames(options, "test 162", "", 12).items[0].id).toBe("endoscapes:test:162_6575");
    expect(searchSurgicalFrames(options, "video 162 frame 6575", "", 12).total).toBe(1);
    expect(searchSurgicalFrames(options, "6575", "", 12).total).toBe(1);
    expect(searchSurgicalFrames(options, "train", "", 12).items).toHaveLength(12);
  });

  it("shows the active frame and same-recording neighbors when the search is empty", () => {
    const options = [frame("test", 162, 6000), frame("test", 162, 6575), frame("test", 162, 7325), frame("test", 163, 5000)];
    const result = searchSurgicalFrames(options, "", options[1].id, 12);
    expect(result.items.map((item) => item.id)).toEqual([options[1].id, options[0].id, options[2].id]);
    expect(result.total).toBe(4);
  });

  it("caps FiSaV recording results while keeping selected identity first", () => {
    const records = Array.from({ length: 59 }, (_, index) => ({ id: `pat${String(index + 1).padStart(3, "0")}` }));
    const result = searchSignalRecords(records, "pat01", "pat011", (item) => item.id, 12);
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe("pat011");
    expect(result.total).toBe(10);
    expect(searchSignalRecords(records, "pat 11", "", (item) => item.id, 12).items[0].id).toBe("pat011");
  });

  it("searches ready source records by case, frame, module, and dataset", () => {
    const cases = [
      ...Array.from({ length: 1992 }, (_, index) => caseRecord(`endoscapes:train:100_${index}`, "surgivision")),
      { ...caseRecord("endoscapes:test:162_6575", "surgivision"), label: "Endoscapes test · video 162 · frame 6575", source_case_id: "video-162:frame-6575" },
      caseRecord("fisav:pat011", "fistulaguard"),
      caseRecord("openkbp:pt_201", "dosetwin"),
      caseRecord("blocked:case", "dosetwin", "blocked"),
    ];
    const frameSearch = searchResearchCases(cases, "video 162 6575", "", 12);
    expect(frameSearch.total).toBe(1);
    expect(frameSearch.items[0].id).toBe("endoscapes:test:162_6575");
    expect(searchResearchCases(cases, "fistula pat011", "", 12).items[0].id).toBe("fisav:pat011");
    expect(searchResearchCases(cases, "pt 201", "", 12).items[0].id).toBe("openkbp:pt_201");
    expect(searchResearchCases(cases, "blocked case", "", 12).total).toBe(0);
    expect(searchResearchCases(cases, "", "openkbp:pt_201", 12).items[0].id).toBe("openkbp:pt_201");
  });
});
