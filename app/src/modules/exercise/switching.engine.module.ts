import type { SwitchingConfigData } from "@lib/types";
import { SwitchingV1Config } from "@lib/exercise/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { SwitchingState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_V1" as const;
const STAGE = exerciseBlockStage();

/**
 * Every `DartZoneKey` a single ring can produce, mirroring
 * `singles-training.engine.module.ts`'s own local copy — kept local rather
 * than shared, matching how every other `GameEngine` module already
 * declares its own copy of this set.
 */
const SINGLE_ZONE_KEYS = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

/**
 * Points for one dart already known to have been thrown at `intendedTarget`
 * — a dart that landed on a different number than the visit's own current
 * target always scores 0 ("outside", 09-training-routines.md §14/§17).
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
 * Switching: cycles a fixed target list dart by dart, scoring each dart by
 * the ring it hit relative to its own visit's current target
 * (09-training-routines.md §17, design spec 2026-09-11 §5.2). One visit —
 * one `TurnFact` — is one full pass through `config.targets`. The engine
 * owns no clock: completion arrives only through `expireTimer()`, called by
 * the (not yet built) controller driving the step's countdown, exactly like
 * `TuodEngine`/`ScoreTrainingEngine` (D264).
 */
class SwitchingEngine implements DartExerciseEngine<SwitchingState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: SwitchingConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: SwitchingConfigData, prior?: EngineFacts) {
    this.config = SwitchingV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SwitchingState {
    return foldSwitchingState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): SwitchingState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < this.config.targets.length,
    );
    const intendedTarget =
      this.config.targets[
        foldSwitchingState(
          { stages: [{ ...STAGE }], turns: this.turns },
          this.config,
          false,
        ).targetIndex
      ];
    appendObservedDart(turn, observation, {
      intendedTargetNumber: intendedTarget,
      intendedZoneKey: null,
    });
    if (turn.darts.length === this.config.targets.length) {
      turn.completedAt = new Date().toISOString();
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /**
   * Records that the step's countdown has elapsed. The countdown itself
   * lives in the controller, not the engine — mirrors
   * `TuodEngine.expireTimer()` (D264).
   */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): SwitchingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const switchingEngineFactory: DartExerciseEngineFactory<
  SwitchingConfigData,
  SwitchingState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: SwitchingConfigData, prior?: EngineFacts) {
    return new SwitchingEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(switchingEngineFactory);
