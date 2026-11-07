import { describe, expect, it } from "vitest";
import { GENERAL_TIPS, KEY_TIPS } from "@lib/training/tips/tips";
import {
  TIP_MAX_CHARS,
  pickTip,
  tipDisplayMs,
  tipFamily,
  tipsFor,
} from "@lib/training/tips/tip-pick";

function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("tipFamily", () => {
  it.each([
    ["AROUND_THE_CLOCK_V2", "AROUND_THE_CLOCK"],
    ["AROUND_THE_CLOCK_V9", "AROUND_THE_CLOCK"],
    ["121_V2", "121"],
    ["GAME:TUOD_V1", "TUOD"],
    ["WARM_UP", "WARM_UP"],
    [null, ""],
    [undefined, ""],
  ])("%s → %s", (key, family) => expect(tipFamily(key)).toBe(family));
});

describe("tipsFor", () => {
  it("returns the family tips for a versioned key", () =>
    expect(tipsFor("SCORE_TRAINING_V1")).toBe(KEY_TIPS.SCORE_TRAINING));
  it("returns no tips for an unknown key", () =>
    expect(tipsFor("NOPE_V1")).toEqual([]));
});

describe("tip copy", () => {
  const all = [...GENERAL_TIPS, ...Object.values(KEY_TIPS).flat()];
  it("has at least 8 general tips", () =>
    expect(GENERAL_TIPS.length).toBeGreaterThanOrEqual(8));
  it("covers every family", () => {
    for (const k of [
      "AROUND_THE_CLOCK",
      "121",
      "SCORE_TRAINING",
      "TUOD",
      "QUICK_SUBTRACT",
      "WARM_UP",
      "SWITCHING",
      "SWITCHING_CHAIN",
      "DOUBLE_PATTERN",
      "TARGET_SCORING",
      "SCORE_THRESHOLD",
      "BULLSEYE_CHECKOUT",
      "BULL_UP",
      "CHECKOUT_SEQUENCE",
      "RANDOM_CHECKOUT",
      "HIT_COUNT",
      "SWITCHBLADE",
      "DOUBLES_LOCK",
      "HALVE_IT",
      "DOUBLES_SNAKES_LADDERS",
    ])
      expect(KEY_TIPS[k]?.length ?? 0, k).toBeGreaterThanOrEqual(3);
  });
  it.each(all)("%s fits the copy rules", (tip) => {
    expect(tip.length).toBeLessThanOrEqual(TIP_MAX_CHARS);
    expect(tip).toMatch(/\.$/);
    expect(tip).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("has no duplicates", () => expect(new Set(all).size).toBe(all.length));
});

describe("pickTip", () => {
  it("takes a key tip when the first draw is below 2/3", () =>
    expect(KEY_TIPS.TUOD).toContain(pickTip("TUOD_V1", null, seq(0.66, 0))));
  it("takes a general tip when the first draw is 2/3 or more", () =>
    expect(GENERAL_TIPS).toContain(pickTip("TUOD_V1", null, seq(0.67, 0))));
  it("falls back to general tips for an unknown key", () =>
    expect(GENERAL_TIPS).toContain(pickTip("NOPE_V1", null, seq(0, 0))));
  it("never repeats the previous tip", () => {
    let prev: string | null = null;
    for (let i = 0; i < 500; i++) {
      const t = pickTip("121_V2", prev);
      expect(t).not.toBe(prev);
      prev = t;
    }
  });
  it("returns the only tip of a single-tip pool", () =>
    expect(pickTip(null, "x", seq(0.9, 0), ["x"])).toBe("x"));
});

describe("tipDisplayMs", () => {
  it.each([
    [0, 6500],
    [50, 7000],
    [120, 11200],
    [400, 13500],
  ])("%i chars → %i ms", (n, ms) =>
    expect(tipDisplayMs("a".repeat(n))).toBe(ms),
  );
});
