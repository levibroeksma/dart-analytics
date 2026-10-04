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

  it("offers a picker for exactly the stored-intent games", () => {
    expect([...HEATMAP_TARGET_GAMES].sort()).toEqual([
      "BOBS27",
      "DOUBLES_TRAINING",
    ]);
    expect(heatmapTargetOptions("SINGLES_TRAINING" as never)).toEqual([]);
    expect(heatmapTargetOptions(undefined)).toEqual([]);
    expect(heatmapTargetOptions("BOBS27")).toHaveLength(22);
  });
});
