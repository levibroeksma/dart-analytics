import { describe, expect, it } from "vitest";
import {
  DOUBLES_PATH_KEYS,
  HEATMAP_TARGET_GAMES,
  heatmapTargetOptions,
  trackRowKeys,
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
      "ACE",
      "AROUND_THE_CLOCK",
      "BASEBALL",
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

  it("gives the row keys of a game's picker without the all-targets option", () => {
    const shanghai = trackRowKeys("SHANGHAI");
    expect(shanghai.size).toBe(20);
    expect(shanghai.has("NUMBER:20")).toBe(true);
    expect(shanghai.has("BULL:25")).toBe(false);
    expect(trackRowKeys("SINGLES_TRAINING").size).toBe(21);
    expect(trackRowKeys("SINGLES_TRAINING").has("BULL:25")).toBe(true);
    expect([...trackRowKeys("BOBS27")]).toEqual([...DOUBLES_PATH_KEYS]);
    expect(trackRowKeys("AROUND_THE_CLOCK").size).toBe(41);
    expect(trackRowKeys("ACE").size).toBe(21);
    expect(trackRowKeys("ACE").has("BULL:25")).toBe(true);
    expect(trackRowKeys("501").size).toBe(0);
    expect(trackRowKeys(undefined).size).toBe(0);
  });

  it("offers Baseball the nine inning numbers and no bull", () => {
    const options = heatmapTargetOptions("BASEBALL");
    expect(options.map((o) => o.value)).toEqual([
      null,
      ...Array.from({ length: 9 }, (_, i) => `NUMBER:${i + 1}`),
    ]);
    expect([...trackRowKeys("BASEBALL")]).toEqual(
      Array.from({ length: 9 }, (_, i) => `NUMBER:${i + 1}`),
    );
  });

  it("offers Ace a picker of all targets, 1 to 20 and the bull", () => {
    const options = heatmapTargetOptions("ACE");
    expect(options).toHaveLength(22);
    expect(options[0]!.label).toBe("All targets");
  });
});
