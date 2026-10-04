import { describe, expect, it } from "vitest";
import {
  DOUBLES_PATH_KEYS,
  HEATMAP_TARGET_GAMES,
  heatmapTargetOptions,
} from "@lib/stats/heatmap-targets";
import { parseTargetKey } from "@lib/stats/target-key";

describe("heatmap-targets", () => {
  it("covers D1..D20 and the bull, all parseable", () => {
    expect(DOUBLES_PATH_KEYS).toHaveLength(21);
    expect(DOUBLES_PATH_KEYS.every((k) => parseTargetKey(k) !== null)).toBe(
      true,
    );
  });

  it("offers a picker for exactly the stored-intent and derived-intent games", () => {
    expect([...HEATMAP_TARGET_GAMES].sort()).toEqual([
      "AROUND_THE_CLOCK",
      "BOBS27",
      "DOUBLES_TRAINING",
      "SHANGHAI",
      "SINGLES_TRAINING",
    ]);
    expect(heatmapTargetOptions("501")).toEqual([]);
    expect(heatmapTargetOptions(undefined)).toEqual([]);
    expect(heatmapTargetOptions("BOBS27")).toHaveLength(22);
  });

  it("offers NUMBER keys and the bull on Singles and ATC, no bull on Shanghai", () => {
    for (const game of ["SINGLES_TRAINING", "AROUND_THE_CLOCK"] as const) {
      const options = heatmapTargetOptions(game);
      expect(options).toHaveLength(22);
      expect(options[1]).toEqual({ value: "NUMBER:1", label: "1" });
      expect(options[21]).toEqual({ value: "BULL:25", label: "Bull" });
    }
    const shanghai = heatmapTargetOptions("SHANGHAI");
    expect(shanghai).toHaveLength(21);
    expect(shanghai.some((o) => o.value === "BULL:25")).toBe(false);
  });
});
