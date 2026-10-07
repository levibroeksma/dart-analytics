import { describe, expect, it } from "vitest";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseTargetScoring,
  summariseSwitchingTargetScoring,
  summariseScoreThreshold,
  summariseBullseyeCheckout,
  summariseBullUp,
  summariseCheckoutSequence,
  summariseRandomCheckout,
} from "@modules/training/routines/routine-summary.module";
import { switchingEngineFactory } from "@modules/training/exercises/switching.engine.module";
import { doublePatternEngineFactory } from "@modules/training/exercises/double-pattern.engine.module";
import { targetScoringEngineFactory } from "@modules/training/exercises/target-scoring.engine.module";
import { switchingTargetScoringEngineFactory } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { scoreThresholdEngineFactory } from "@modules/training/exercises/score-threshold.engine.module";
import { bullseyeCheckoutEngineFactory } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { bullUpEngineFactory } from "@modules/training/exercises/bull-up.engine.module";
import { checkoutSequenceEngineFactory } from "@modules/training/exercises/checkout-sequence.engine.module";
import { randomCheckoutEngineFactory } from "@modules/training/exercises/random-checkout.engine.module";
import type { DartObservation } from "@modules/types";

/**
 * `routine-summary.module.test.ts` proves every `summarise*` against
 * hand-built state fixtures and is held unedited (phase 6b Task 2 brief):
 * `stepMetrics` now sits underneath those functions, and this file is what
 * proves the delegation end to end — a real engine driven by real darts,
 * through `stepMetrics`, through `summarise*`, to the exact display rows.
 * Complements, never replaces, the frozen fixture-based suite.
 */

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

describe("summarise* over a real engine run", () => {
  it("summariseSwitching reads points, darts and hit rate off a played run", () => {
    const engine = switchingEngineFactory.create({
      targets: [20, 19, 18],
      scoring: { single: 1, double: 2, treble: 3 },
    });
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(19, "SINGLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(20, "DOUBLE"));

    expect(summariseSwitching(engine.state(), engine.facts())).toEqual({
      stepKey: "SWITCHING",
      label: "Switching",
      rows: [
        { label: "Points", value: "6" },
        { label: "Darts", value: "4" },
        { label: "Hit rate", value: "75.00%" },
      ],
    });
  });

  it("summariseDoublePattern reads hits and darts off a played run", () => {
    const engine = doublePatternEngineFactory.create({
      patterns: [
        [20, 10, 5],
        [16, 8, 4],
      ],
    });
    engine.record(dart(20, "DOUBLE"));
    engine.record(dart(10, "SINGLE"));
    engine.record(dart(5, "DOUBLE"));
    engine.record(dart(16, "DOUBLE"));
    engine.record(dart(8, "SINGLE"));
    engine.record(dart(4, "DOUBLE"));

    expect(summariseDoublePattern(engine.state())).toEqual({
      stepKey: "DOUBLE_PATTERN",
      label: "Doubles",
      rows: [
        { label: "Doubles hit", value: "4" },
        { label: "Darts", value: "6" },
        { label: "Hit rate", value: "66.67%" },
      ],
    });
  });

  it("summariseTargetScoring reads the best chain, per-target bests, darts and hit rate off a played run", () => {
    const engine = targetScoringEngineFactory.create({
      targets: [20, 19, 18, 25],
    });
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(20, "SINGLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(19, "TREBLE"));
    engine.record(dart(1, "SINGLE"));

    expect(summariseTargetScoring(engine.state())).toEqual({
      stepKey: "TARGET_SCORING",
      label: "Target Scoring",
      rows: [
        { label: "Best chain", value: "4" },
        { label: "Best on 20", value: "4" },
        { label: "Best on 19", value: "3" },
        { label: "Best on 18", value: "0" },
        { label: "Best on Bull", value: "0" },
        { label: "Darts", value: "5" },
        { label: "Hit rate", value: "60.00%" },
      ],
    });
  });

  it("summariseSwitchingTargetScoring reads the best chain, sequences, darts and hit rate off a played run", () => {
    const engine = switchingTargetScoringEngineFactory.create({
      targets: [20, 19, 18],
    });
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(19, "TREBLE"));
    engine.record(dart(18, "TREBLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(20, "TREBLE"));

    expect(summariseSwitchingTargetScoring(engine.state())).toEqual({
      stepKey: "SWITCHING_TARGET_SCORING",
      label: "Switching Target Scoring",
      rows: [
        { label: "Best chain", value: "9" },
        { label: "Sequences", value: "1" },
        { label: "Darts", value: "5" },
        { label: "Hit rate", value: "80.00%" },
      ],
    });
  });

  it("summariseScoreThreshold reads beats, visits, beat rate and darts off a played run", () => {
    const engine = scoreThresholdEngineFactory.create({ threshold: 65 });
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(10, "SINGLE"));

    expect(summariseScoreThreshold(engine.state())).toEqual({
      stepKey: "SCORE_THRESHOLD",
      label: "65 or More",
      rows: [
        { label: "Beats", value: "1" },
        { label: "Visits", value: "2" },
        { label: "Beat rate", value: "50.00%" },
        { label: "Darts", value: "7" },
      ],
    });
  });

  it("summariseBullseyeCheckout reads checkouts, visits, checkout rate and darts off a played run", () => {
    const engine = bullseyeCheckoutEngineFactory.create({ startScore: 81 });
    engine.record(dart(19, "SINGLE"));
    engine.record(dart(12, "SINGLE"));
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(5, "SINGLE"));
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(5, "SINGLE"));

    expect(summariseBullseyeCheckout(engine.state())).toEqual({
      stepKey: "BULLSEYE_CHECKOUT",
      label: "Bullseye Checkouts",
      rows: [
        { label: "Checkouts", value: "1" },
        { label: "Visits", value: "2" },
        { label: "Checkout rate", value: "50.00%" },
        { label: "Darts", value: "7" },
      ],
    });
  });

  it("summariseBullUp reads throws, bullseyes, bulls and both rates off a played run", () => {
    const engine = bullUpEngineFactory.create({});
    engine.record(dart(25, "INNER_BULL"));
    engine.record(dart(25, "OUTER_BULL"));
    engine.record(dart(5, "SINGLE"));

    expect(summariseBullUp(engine.state())).toEqual({
      stepKey: "BULL_UP",
      label: "Bull Up Practice",
      rows: [
        { label: "Throws", value: "3" },
        { label: "Bullseyes", value: "1" },
        { label: "Bulls", value: "2" },
        { label: "Bullseye rate", value: "33.33%" },
        { label: "Bull rate", value: "66.67%" },
      ],
    });
  });

  it("summariseCheckoutSequence reads points, checkouts, attempts, rate and darts off a played run", () => {
    const engine = checkoutSequenceEngineFactory.create({
      firstOutshot: 61,
      lastOutshot: 100,
      dartLimit: 6,
    });
    [
      dart(15, "TREBLE"),
      dart(8, "DOUBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
    ].forEach((d) => engine.record(d));

    expect(summariseCheckoutSequence(engine.state())).toEqual({
      stepKey: "CHECKOUT_SEQUENCE",
      label: "Catch 40",
      rows: [
        { label: "Points", value: "3" },
        { label: "Checkouts", value: "1" },
        { label: "Attempts", value: "2" },
        { label: "Checkout rate", value: "50.00%" },
        { label: "Darts", value: "7" },
      ],
    });
  });

  it("summariseCheckoutSequence shows no rate before an attempt resolves", () => {
    const engine = checkoutSequenceEngineFactory.create({
      firstOutshot: 61,
      lastOutshot: 100,
      dartLimit: 6,
    });

    expect(summariseCheckoutSequence(engine.state()).rows[3]).toEqual({
      label: "Checkout rate",
      value: "—",
    });
  });

  it("summariseRandomCheckout reads checkouts, attempts, rate and darts off a played run", () => {
    const engine = randomCheckoutEngineFactory.create({
      minStart: 40,
      maxStart: 170,
      drawSeed: 774,
    });
    [
      dart(20, "DOUBLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "SINGLE"),
    ].forEach((d) => engine.record(d));

    expect(summariseRandomCheckout(engine.state())).toEqual({
      stepKey: "RANDOM_CHECKOUT",
      label: "Random Checkout",
      rows: [
        { label: "Checkouts", value: "1" },
        { label: "Attempts", value: "2" },
        { label: "Checkout rate", value: "50.00%" },
        { label: "Darts", value: "5" },
      ],
    });
  });

  it("summariseRandomCheckout shows no rate before an attempt resolves", () => {
    const engine = randomCheckoutEngineFactory.create({
      minStart: 40,
      maxStart: 170,
      drawSeed: 774,
    });

    expect(summariseRandomCheckout(engine.state()).rows[2]).toEqual({
      label: "Checkout rate",
      value: "—",
    });
  });
});
