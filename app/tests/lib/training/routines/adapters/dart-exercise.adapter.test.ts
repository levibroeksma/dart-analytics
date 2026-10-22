// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { playExerciseKind } from "../../../stats/replay-step-games";
import { dartExerciseAdapter } from "@lib/training/routines/adapters/dart-exercise.adapter";
import { switchingAdapter } from "@lib/training/routines/adapters/switching.adapter";
import { switchingChainAdapter } from "@lib/training/routines/adapters/switching-chain.adapter";
import { doublePatternAdapter } from "@lib/training/routines/adapters/double-pattern.adapter";
import { targetScoringAdapter } from "@lib/training/routines/adapters/target-scoring.adapter";
import { scoreThresholdAdapter } from "@lib/training/routines/adapters/score-threshold.adapter";
import { bullseyeCheckoutAdapter } from "@lib/training/routines/adapters/bullseye-checkout.adapter";
import { bullUpAdapter } from "@lib/training/routines/adapters/bull-up.adapter";
import { checkoutSequenceAdapter } from "@lib/training/routines/adapters/checkout-sequence.adapter";
import { randomCheckoutAdapter } from "@lib/training/routines/adapters/random-checkout.adapter";
import { hitCountAdapter } from "@lib/training/routines/adapters/hit-count.adapter";
import { switchbladeAdapter } from "@lib/training/routines/adapters/switchblade.adapter";
import { doublesLockAdapter } from "@lib/training/routines/adapters/doubles-lock.adapter";
import { halveItAdapter } from "@lib/training/routines/adapters/halve-it.adapter";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import type { StepAdapter } from "@lib/interfaces";
import type { DartEngineSlot, RoutinePlayContext } from "@lib/types";
import type { DartExerciseKind } from "@modules/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

const CASES: [StepAdapter, DartExerciseKind, DartEngineSlot][] = [
  [switchingAdapter, "SWITCHING:STANDARD", "switchingEngine"],
  [switchingChainAdapter, "SWITCHING:CHAIN", "switchingChainEngine"],
  [doublePatternAdapter, "DOUBLE_PATTERN", "doublePatternEngine"],
  [targetScoringAdapter, "TARGET_SCORING", "targetScoringEngine"],
  [scoreThresholdAdapter, "SCORE_THRESHOLD", "scoreThresholdEngine"],
  [bullseyeCheckoutAdapter, "BULLSEYE_CHECKOUT", "bullseyeCheckoutEngine"],
  [bullUpAdapter, "BULL_UP", "bullUpEngine"],
  [checkoutSequenceAdapter, "CHECKOUT_SEQUENCE", "checkoutSequenceEngine"],
  [randomCheckoutAdapter, "RANDOM_CHECKOUT", "randomCheckoutEngine"],
  [hitCountAdapter, "HIT_COUNT", "hitCountEngine"],
  [switchbladeAdapter, "SWITCHBLADE", "switchbladeEngine"],
  [doublesLockAdapter, "DOUBLES_LOCK", "doublesLockEngine"],
  [halveItAdapter, "HALVE_IT", "halveItEngine"],
];

function makeContext(): RoutinePlayContext {
  return {
    ...Object.fromEntries(CASES.map(([, , slot]) => [slot, null])),
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultFor(kind: DartExerciseKind): StartTrainingStepResponseData {
  const { header } = playExerciseKind(kind);
  return {
    sessionId: "s1",
    exerciseTypeKey: header.exerciseTypeKey,
    configuration: header.configuration,
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("dart exercise adapters", () => {
  it.each(CASES)(
    "%#: open() fills only its own slot with its ruleset's engine and starts the step timer",
    (adapter, kind, slot) => {
      const ctx = makeContext();
      adapter.open(ctx, resultFor(kind), 600);
      const engine = ctx[slot];
      expect(engine?.exerciseRulesetVersionKey).toBe(
        playExerciseKind(kind).header.exerciseRulesetVersionKey,
      );
      for (const [, , other] of CASES)
        if (other !== slot) expect(ctx[other]).toBeNull();
      expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
      expect(adapter.completesOwnSession).toBe(false);
    },
  );

  it.each(CASES)(
    "%#: facts() and summarise() are null before open() and read the engine after",
    (adapter, kind, slot) => {
      const ctx = makeContext();
      expect(adapter.facts(ctx)).toBeNull();
      expect(adapter.summarise(ctx)).toBeNull();
      adapter.open(ctx, resultFor(kind), 600);
      expect(adapter.facts(ctx)).toEqual(ctx[slot]!.facts());
      expect(adapter.summarise(ctx)?.stepKey).toBe(kind);
    },
  );

  it.each(CASES)("%#: close() empties its slot", (adapter, kind, slot) => {
    const ctx = makeContext();
    adapter.open(ctx, resultFor(kind), 600);
    adapter.close(ctx);
    expect(ctx[slot]).toBeNull();
  });

  it("leaves the slot empty when the registry builds an engine of another class", () => {
    const adapter = dartExerciseAdapter({
      key: "DOUBLES_LOCK",
      headerLabel: "x",
      title: "x",
      panel: "doubles-lock",
      rulesetKey: "SWITCHBLADE_V1",
      slot: "doublesLockEngine",
      engineClass: DoublesLockEngine,
      summarise: () => ({ stepKey: "DOUBLES_LOCK", label: "x", rows: [] }),
    });
    const ctx = makeContext();
    adapter.open(ctx, resultFor("SWITCHBLADE"), 600);
    expect(ctx.doublesLockEngine).toBeNull();
  });
});
