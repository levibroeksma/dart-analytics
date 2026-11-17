import { describe, expect, it } from "vitest";
import { trackRowKeys } from "@lib/stats/heatmap-targets";
import { formatTargetKey } from "@lib/stats/target-key";
import { aimPairFor } from "@modules/stats/derived-aims.module";
import type { BoardTarget } from "@modules/types";

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const OUTER_SINGLE_CLOCK = {
  pathDirection: "UP",
  oddsFirst: false,
  segmentRule: "OUTER_SINGLE",
  difficulty: "NORMAL",
  durationType: "UNTIL_DONE",
} as never;

function keysAimedAt(
  game: "SINGLES_TRAINING" | "SHANGHAI" | "AROUND_THE_CLOCK",
  config: never,
  includeBull: boolean,
): string[] {
  const targets: BoardTarget[] = NUMBERS.map((number) => ({
    kind: "NUMBER",
    number,
  }));
  if (includeBull) targets.push({ kind: "BULL" } as BoardTarget);
  return targets.map((target) => {
    const { number, zone } = aimPairFor(game, target, config);
    return formatTargetKey(number, zone);
  });
}

describe("track row keys against the aims the derived folds emit", () => {
  it("holds every Singles Training aim", () => {
    const rows = trackRowKeys("SINGLES_TRAINING");
    for (const key of keysAimedAt("SINGLES_TRAINING", {} as never, true))
      expect(rows.has(key)).toBe(true);
  });

  it("holds every Shanghai aim", () => {
    const rows = trackRowKeys("SHANGHAI");
    for (const key of keysAimedAt("SHANGHAI", {} as never, false))
      expect(rows.has(key)).toBe(true);
  });

  it("holds every Around the Clock V1 aim", () => {
    const rows = trackRowKeys("AROUND_THE_CLOCK");
    for (const key of keysAimedAt("AROUND_THE_CLOCK", {} as never, true))
      expect(rows.has(key)).toBe(true);
  });

  it("holds every Around the Clock V2 outer-single aim", () => {
    const rows = trackRowKeys("AROUND_THE_CLOCK");
    const keys = keysAimedAt("AROUND_THE_CLOCK", OUTER_SINGLE_CLOCK, true);
    expect(keys).toContain("OUTER_SINGLE:7");
    for (const key of keys) expect(rows.has(key)).toBe(true);
  });
});
