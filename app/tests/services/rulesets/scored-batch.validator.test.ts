import { describe, it, expect } from "vitest";
import { validateScoredBatch } from "@services/rulesets/scored-batch.validator";
import type { DartFactInput } from "@routes/types";
import type { ScoredBatchOptions } from "@services/types";

const config = {
  duration_type: "ROUNDS",
  duration_value: 2,
  max_darts_per_turn: 3,
};

function dartlessBatch(totalScores: number[]) {
  return {
    stages: [
      {
        clientKey: "s1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: totalScores.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          kept: false,
          completedAt: null,
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

const QUICK = { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" };
const VISUAL = { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" };

function run(
  modes: { captureModeKey: string; inputModeKey: string },
  totals: number[],
  existing: Record<string, number>,
  options: ScoredBatchOptions,
) {
  return validateScoredBatch(
    {
      config,
      batch: dartlessBatch(totals),
      existingTurnCounts: existing,
      ...modes,
    },
    options,
  );
}

const limitedVisits: ScoredBatchOptions = {
  maxTurnScore: 100,
  limitNoun: "visits",
  limitOnVisualBoard: true,
};
const quickOnlyAttempts: ScoredBatchOptions = {
  maxTurnScore: 100,
  limitNoun: "attempts",
  limitOnVisualBoard: false,
};

describe("validateScoredBatch", () => {
  it("rejects a mode pair that is neither quick-score nor visual-board", () => {
    const result = run(
      { captureModeKey: "ANALYTICS", inputModeKey: "DETAILED_DARTS" },
      [10],
      {},
      limitedVisits,
    );
    expect(result).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["unsupported mode pair ANALYTICS + DETAILED_DARTS"],
    });
  });

  it.each([
    ["quick-score", QUICK],
    ["visual-board", VISUAL],
  ])("bounds a turn by maxTurnScore on the %s path", (_label, modes) => {
    expect(run(modes, [100], {}, limitedVisits)).toEqual({ valid: true });
    expect(run(modes, [101], {}, limitedVisits)).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["turn t1 totalScore must be between 0 and 100"],
    });
  });

  it.each([
    ["visits", limitedVisits],
    ["attempts", quickOnlyAttempts],
  ])("names the ROUNDS cap in %s on the quick-score path", (noun, options) => {
    expect(run(QUICK, [10], { p1: 1 }, options)).toEqual({ valid: true });
    expect(run(QUICK, [10], { p1: 2 }, options)).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`session is limited to 2 ${noun}`],
    });
  });

  it("applies the ROUNDS cap on the visual-board path when limitOnVisualBoard", () => {
    expect(run(VISUAL, [10], { p1: 2 }, limitedVisits)).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["session is limited to 2 visits"],
    });
  });

  it("skips the ROUNDS cap on the visual-board path when not limitOnVisualBoard", () => {
    expect(run(VISUAL, [10], { p1: 2 }, quickOnlyAttempts)).toEqual({
      valid: true,
    });
  });

  it("reports an over-max turn before the ROUNDS cap", () => {
    expect(run(QUICK, [101], { p1: 2 }, limitedVisits)).toEqual({
      valid: false,
      code: "VALIDATION_FAILED",
      issues: ["turn t1 totalScore must be between 0 and 100"],
    });
  });
});
