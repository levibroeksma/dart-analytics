import { describe, expect, it } from "vitest";
import { playExerciseKind } from "../../../lib/stats/replay-step-games";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import {
  HitCountEngine,
  foldHitCountState,
  hitCountEngineFactory,
} from "@modules/training/exercises/hit-count.engine.module";
import {
  SwitchbladeEngine,
  foldSwitchbladeState,
  switchbladeEngineFactory,
} from "@modules/training/exercises/switchblade.engine.module";
import {
  DoublesLockEngine,
  doublesLockEngineFactory,
  foldDoublesLockState,
} from "@modules/training/exercises/doubles-lock.engine.module";
import {
  TargetScoringEngine,
  foldTargetScoringState,
  targetScoringEngineFactory,
} from "@modules/training/exercises/target-scoring.engine.module";
import {
  SwitchingChainEngine,
  foldSwitchingChainState,
  switchingChainEngineFactory,
} from "@modules/training/exercises/switching-chain.engine.module";
import type { DartExerciseKind } from "@modules/types";

const CASES = [
  ["HIT_COUNT", HitCountEngine, hitCountEngineFactory, foldHitCountState],
  [
    "SWITCHBLADE",
    SwitchbladeEngine,
    switchbladeEngineFactory,
    foldSwitchbladeState,
  ],
  [
    "DOUBLES_LOCK",
    DoublesLockEngine,
    doublesLockEngineFactory,
    foldDoublesLockState,
  ],
  [
    "TARGET_SCORING",
    TargetScoringEngine,
    targetScoringEngineFactory,
    foldTargetScoringState,
  ],
  [
    "SWITCHING:CHAIN",
    SwitchingChainEngine,
    switchingChainEngineFactory,
    foldSwitchingChainState,
  ],
] as const;

describe("shell-registered exercises", () => {
  it.each(CASES)(
    "%s: the registered factory builds the exported class and the fold matches state()",
    (kind, Engine, factory, fold) => {
      const { header } = playExerciseKind(kind as DartExerciseKind);
      const engine = factory.create(header.configuration as never);
      expect(engine).toBeInstanceOf(Engine);
      expect(
        getDartExerciseEngineFactory(factory.exerciseRulesetVersionKey),
      ).toBe(factory);
      expect(
        fold(engine.facts(), header.configuration as never, false),
      ).toEqual(engine.state());
    },
  );
});
