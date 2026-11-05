import type { SwitchingConfigData } from "@lib/types";
import { SwitchingV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartFact, DartObservation, EngineFacts } from "@modules/types";
import type { DartExerciseSpec } from "@modules/interfaces";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { SwitchingState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_V1" as const;

/**
 * Every `DartZoneKey` a single ring can produce, mirroring
 * `singles-training.engine.module.ts`'s own local copy — kept local rather
 * than shared, matching how every other `GameEngine` module already
 * declares its own copy of this set.
 */
const SINGLE_ZONE_KEYS = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

/**
 * What every Switching dart is aimed at: the target number's treble
 * (09-Training/01-Routines.md §17 writes the sequence as `T20 → T19 → T18`,
 * and the seeded scoring pays the treble most). Every ring on the target
 * still scores, so the zone is intent only — `pointsFor` reads the ring
 * that was hit, never this. It is stamped because `darts` requires an
 * intended zone whenever an intended target is set
 * (`chk_dart_target_consistency`), so a null zone made the step's batch
 * unuploadable.
 */
const INTENDED_ZONE_KEY = "TREBLE" as const;

/**
 * Points for one dart already known to have been thrown at `intendedTarget`
 * — a dart that landed on a different number than the visit's own current
 * target always scores 0 ("outside", 09-Training/01-Routines.md §14/§17).
 */
function pointsFor(
  intendedTarget: number,
  scoring: SwitchingConfigData["scoring"],
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): number {
  if (hitTargetNumber !== intendedTarget) return 0;
  if (SINGLE_ZONE_KEYS.has(hitZoneKey)) return scoring.single;
  if (hitZoneKey === "DOUBLE") return scoring.double;
  if (hitZoneKey === "TREBLE") return scoring.treble;
  return 0;
}

type SwitchingProgress = {
  targetIndex: number;
  totalPoints: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: SwitchingProgress = {
  targetIndex: 0,
  totalPoints: 0,
  dartsThrown: 0,
};

/**
 * Pure reducer: folds one dart fact onto the running Switching progress.
 * Exported for direct unit testing independent of the engine class.
 */
export function applySwitchingDart(
  config: SwitchingConfigData,
  progress: SwitchingProgress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): SwitchingProgress {
  const intendedTarget = config.targets[progress.targetIndex];
  const points = pointsFor(
    intendedTarget,
    config.scoring,
    dart.hitTargetNumber,
    dart.hitZoneKey,
  );
  return {
    targetIndex: (progress.targetIndex + 1) % config.targets.length,
    totalPoints: progress.totalPoints + points,
    dartsThrown: progress.dartsThrown + 1,
  };
}

/**
 * Folds the whole fact log into Switching state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSinglesTrainingState`. `turns`
 * is flattened in write order: `openOrCreateTurn`'s reuse rule guarantees
 * darts are appended in the same order they were recorded, so replaying
 * turn-by-turn, dart-by-dart reproduces the exact target cycle position.
 */
export function foldSwitchingState(
  facts: EngineFacts,
  config: SwitchingConfigData,
  complete: boolean,
): SwitchingState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applySwitchingDart(config, acc, dart),
      INITIAL_PROGRESS,
    );

  return {
    currentTargetNumber: config.targets[progress.targetIndex],
    targetIndex: progress.targetIndex,
    totalPoints: progress.totalPoints,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * One visit is one full pass through `config.targets`, so a visit stays
 * open until the next dart is back on the first target.
 */
const switchingSpec: DartExerciseSpec<SwitchingConfigData, SwitchingState> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => SwitchingV1Config.parse(config),
  fold: foldSwitchingState,
  intent: (state) => ({
    intendedTargetNumber: state.currentTargetNumber,
    intendedZoneKey: INTENDED_ZONE_KEY,
  }),
  isVisitOpen: (_turn, state) => state.targetIndex !== 0,
};

/**
 * Switching: cycles a fixed target list dart by dart, scoring each dart by
 * the ring it hit relative to its own visit's current target
 * (09-Training/01-Routines.md §17, design spec 2026-09-11 §5.2). One visit —
 * one `TurnFact` — is one full pass through `config.targets`. On the
 * exercise shell: completion arrives only through `expireTimer()` (D264).
 */
export class SwitchingEngine extends dartExerciseEngineClass(switchingSpec) {}

export const switchingEngineFactory = registerDartExercise(
  switchingSpec,
  SwitchingEngine,
).factory;
