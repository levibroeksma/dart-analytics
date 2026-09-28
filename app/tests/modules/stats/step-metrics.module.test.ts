import { describe, expect, it } from "vitest";
import {
  mergeStepMetrics,
  stepMetrics,
  STEP_METRIC_SPECS,
} from "@modules/stats/step-metrics.module";
import { switchingEngineFactory } from "@modules/training/exercises/switching.engine.module";
import { doublePatternEngineFactory } from "@modules/training/exercises/double-pattern.engine.module";
import { targetScoringEngineFactory } from "@modules/training/exercises/target-scoring.engine.module";
import { switchingTargetScoringEngineFactory } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { scoreThresholdEngineFactory } from "@modules/training/exercises/score-threshold.engine.module";
import { bullseyeCheckoutEngineFactory } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { bullUpEngineFactory } from "@modules/training/exercises/bull-up.engine.module";
import type {
  DartExerciseKind,
  DartObservation,
  EngineFacts,
} from "@modules/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

/**
 * One kind's scripted engine run: real engine, real darts, so `stepMetrics`
 * is proved against the same numbers the engine itself derives — never a
 * hand-built state fixture standing in for one.
 */
type Fixture = {
  kind: DartExerciseKind;
  state: unknown;
  facts: EngineFacts;
  expected: Record<string, number>;
};

function fixtures(): Fixture[] {
  const switching = switchingEngineFactory.create({
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  });
  switching.record(dart(20, "TREBLE"));
  switching.record(dart(19, "SINGLE"));
  switching.record(dart(5, "SINGLE"));
  switching.record(dart(20, "DOUBLE"));

  const doublePattern = doublePatternEngineFactory.create({
    patterns: [
      [20, 10, 5],
      [16, 8, 4],
    ],
  });
  doublePattern.record(dart(20, "DOUBLE"));
  doublePattern.record(dart(10, "SINGLE"));
  doublePattern.record(dart(5, "DOUBLE"));
  doublePattern.record(dart(16, "DOUBLE"));
  doublePattern.record(dart(8, "SINGLE"));
  doublePattern.record(dart(4, "DOUBLE"));

  const targetScoring = targetScoringEngineFactory.create({
    targets: [20, 19, 18, 25],
  });
  targetScoring.record(dart(20, "TREBLE"));
  targetScoring.record(dart(20, "SINGLE"));
  targetScoring.record(dart(5, "SINGLE"));
  targetScoring.record(dart(19, "TREBLE"));
  targetScoring.record(dart(1, "SINGLE"));

  const switchingTargetScoring = switchingTargetScoringEngineFactory.create({
    targets: [20, 19, 18],
  });
  switchingTargetScoring.record(dart(20, "TREBLE"));
  switchingTargetScoring.record(dart(19, "TREBLE"));
  switchingTargetScoring.record(dart(18, "TREBLE"));
  switchingTargetScoring.record(dart(5, "SINGLE"));
  switchingTargetScoring.record(dart(20, "TREBLE"));

  const scoreThreshold = scoreThresholdEngineFactory.create({
    threshold: 65,
  });
  scoreThreshold.record(dart(20, "TREBLE"));
  scoreThreshold.record(dart(20, "TREBLE"));
  scoreThreshold.record(dart(20, "TREBLE"));
  scoreThreshold.record(dart(5, "SINGLE"));
  scoreThreshold.record(dart(5, "SINGLE"));
  scoreThreshold.record(dart(5, "SINGLE"));
  scoreThreshold.record(dart(10, "SINGLE"));

  const bullseyeCheckout = bullseyeCheckoutEngineFactory.create({
    startScore: 81,
  });
  bullseyeCheckout.record(dart(19, "SINGLE"));
  bullseyeCheckout.record(dart(12, "SINGLE"));
  bullseyeCheckout.record(dart(25, "INNER_BULL"));
  bullseyeCheckout.record(dart(20, "TREBLE"));
  bullseyeCheckout.record(dart(5, "SINGLE"));
  bullseyeCheckout.record(dart(25, "INNER_BULL"));
  bullseyeCheckout.record(dart(5, "SINGLE"));

  const bullUp = bullUpEngineFactory.create({});
  bullUp.record(dart(25, "INNER_BULL"));
  bullUp.record(dart(25, "OUTER_BULL"));
  bullUp.record(dart(5, "SINGLE"));

  return [
    {
      kind: "SWITCHING",
      state: switching.state(),
      facts: switching.facts(),
      expected: { points: 6, darts: 4, hits: 3 },
    },
    {
      kind: "DOUBLE_PATTERN",
      state: doublePattern.state(),
      facts: doublePattern.facts(),
      expected: { hits: 4, darts: 6 },
    },
    {
      kind: "TARGET_SCORING",
      state: targetScoring.state(),
      facts: targetScoring.facts(),
      expected: { bestChain: 4, darts: 5, hits: 3 },
    },
    {
      kind: "SWITCHING_TARGET_SCORING",
      state: switchingTargetScoring.state(),
      facts: switchingTargetScoring.facts(),
      expected: { bestChain: 9, sequences: 1, darts: 5, hits: 4 },
    },
    {
      kind: "SCORE_THRESHOLD",
      state: scoreThreshold.state(),
      facts: scoreThreshold.facts(),
      expected: { beats: 1, visits: 2, darts: 7 },
    },
    {
      kind: "BULLSEYE_CHECKOUT",
      state: bullseyeCheckout.state(),
      facts: bullseyeCheckout.facts(),
      expected: { checkouts: 1, visits: 2, darts: 7 },
    },
    {
      kind: "BULL_UP",
      state: bullUp.state(),
      facts: bullUp.facts(),
      expected: { throws: 3, bullseyes: 1, bulls: 2 },
    },
  ];
}

describe("stepMetrics", () => {
  it.each(fixtures())(
    "reads $kind's metrics off its own engine state",
    ({ kind, state, facts, expected }) => {
      expect(stepMetrics(kind, state, facts)).toEqual(expected);
    },
  );

  it("counts Switching's hits from the darts' own intended/hit pair, not the engine's scoring config", () => {
    const engine = switchingEngineFactory.create({
      targets: [20],
      scoring: { single: 0, double: 0, treble: 0 },
    });
    engine.record(dart(20, "SINGLE"));
    engine.record(dart(5, "SINGLE"));

    expect(stepMetrics("SWITCHING", engine.state(), engine.facts())).toEqual({
      points: 0,
      darts: 2,
      hits: 1,
    });
  });

  it("throws when a state is missing a field its kind's metrics need", () => {
    expect(() =>
      stepMetrics("BULL_UP", { throws: 1 }, { stages: [], turns: [] }),
    ).toThrow();
  });

  it("returns exactly the spec's keys for every kind (a new kind with no extractor fails here)", () => {
    const byKind = new Map(fixtures().map((f) => [f.kind, f]));

    for (const kind of Object.keys(STEP_METRIC_SPECS) as DartExerciseKind[]) {
      const fixture = byKind.get(kind);
      expect(fixture, `no fixture for kind ${kind}`).toBeDefined();
      const result = stepMetrics(kind, fixture!.state, fixture!.facts);
      expect(Object.keys(result).sort()).toEqual(
        Object.keys(STEP_METRIC_SPECS[kind].metrics).sort(),
      );
    }
  });
});

describe("mergeStepMetrics", () => {
  it("sums 'sum' keys and takes the max of 'max' keys", () => {
    const spec = STEP_METRIC_SPECS.SWITCHING_TARGET_SCORING;

    const merged = mergeStepMetrics(
      spec,
      { bestChain: 9, sequences: 1, darts: 5, hits: 4 },
      { bestChain: 12, sequences: 3, darts: 8, hits: 6 },
    );

    expect(merged).toEqual({
      bestChain: 12,
      sequences: 4,
      darts: 13,
      hits: 10,
    });
  });
});
