import { describe, expect, it } from "vitest";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/types";

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

function throwFiveDarts(seed: number, level: number) {
  const profile = skillProfileForLevel(level);
  return Array.from({ length: 5 }, (_, dartIndex) =>
    throwDart(T20_TREBLE, profile, createDartRng(seed, dartIndex)),
  );
}

describe("throwDart determinism", () => {
  it("produces a byte-identical dart stream for the same (seed, level, context)", () => {
    expect(throwFiveDarts(42, 8)).toEqual(throwFiveDarts(42, 8));
  });

  it("matches the committed snapshot for seed 42 at level 8", () => {
    expect(throwFiveDarts(42, 8)).toMatchSnapshot();
  });

  it("produces a different stream for a different seed", () => {
    expect(throwFiveDarts(42, 8)).not.toEqual(throwFiveDarts(43, 8));
  });

  it("produces a different stream for a different level", () => {
    expect(throwFiveDarts(42, 8)).not.toEqual(throwFiveDarts(42, 4));
  });
});
