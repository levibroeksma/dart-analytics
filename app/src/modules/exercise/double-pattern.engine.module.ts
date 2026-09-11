import type { DoublePatternConfigData } from "@lib/types";
import { DoublePatternV1Config } from "@lib/exercise/rulesets/types";
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
import type { DoublePatternState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "DOUBLE_PATTERN_V1" as const;
const STAGE = exerciseBlockStage();

type PatternPosition = { patternIndex: number; targetWithinPattern: number };

/**
 * Where `dartsThrown` (0-indexed count of darts already thrown, i.e. the
 * position of the *next* dart) falls in the flattened, repeating sequence
 * of `patterns`. `patterns` is non-empty and every pattern has at least one
 * element (`DoublePatternV1Config`), so `cycleLength` is always positive and
 * the loop always finds a position.
 */
function positionFor(
  patterns: readonly number[][],
  dartsThrown: number,
): PatternPosition {
  const cycleLength = patterns.reduce((sum, p) => sum + p.length, 0);
  let offset = dartsThrown % cycleLength;
  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
    const length = patterns[patternIndex].length;
    if (offset < length) return { patternIndex, targetWithinPattern: offset };
    offset -= length;
  }
  throw new Error("unreachable");
}

type DoublePatternProgress = {
  dartsThrown: number;
  totalPoints: number;
};

const INITIAL_PROGRESS: DoublePatternProgress = {
  dartsThrown: 0,
  totalPoints: 0,
};

/**
 * Pure reducer: folds one dart fact onto the running Double Pattern
 * progress. Exported for direct unit testing independent of the engine
 * class.
 */
export function applyDoublePatternDart(
  config: DoublePatternConfigData,
  progress: DoublePatternProgress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): DoublePatternProgress {
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );
  const intendedDouble = config.patterns[patternIndex][targetWithinPattern];
  const hit =
    dart.hitTargetNumber === intendedDouble && dart.hitZoneKey === "DOUBLE";
  return {
    dartsThrown: progress.dartsThrown + 1,
    totalPoints: progress.totalPoints + (hit ? 1 : 0),
  };
}

/**
 * Folds the whole fact log into Double Pattern state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSwitchingState`.
 */
export function foldDoublePatternState(
  facts: EngineFacts,
  config: DoublePatternConfigData,
  complete: boolean,
): DoublePatternState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applyDoublePatternDart(config, acc, dart),
      INITIAL_PROGRESS,
    );
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );

  return {
    patternIndex,
    targetWithinPattern,
    currentDoubleNumber: config.patterns[patternIndex][targetWithinPattern],
    totalPoints: progress.totalPoints,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Double Pattern: cycles a fixed list of double-number patterns, one visit
 * per pattern — each visit throws as many darts as its own pattern has
 * entries (09-training-routines.md §17, design spec 2026-09-11 §5.3). Every
 * hit double scores 1 point; nothing else scores. The engine owns no clock:
 * completion arrives only through `expireTimer()` (D264), exactly like
 * `SwitchingEngine`.
 */
export class DoublePatternEngine implements DartExerciseEngine<DoublePatternState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: DoublePatternConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: DoublePatternConfigData, prior?: EngineFacts) {
    this.config = DoublePatternV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private dartsThrownSoFar(): number {
    return this.turns.reduce((sum, turn) => sum + turn.darts.length, 0);
  }

  private deriveState(): DoublePatternState {
    return foldDoublePatternState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): DoublePatternState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const { patternIndex, targetWithinPattern } = positionFor(
      this.config.patterns,
      this.dartsThrownSoFar(),
    );
    const patternLength = this.config.patterns[patternIndex].length;
    const intendedDouble =
      this.config.patterns[patternIndex][targetWithinPattern];

    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < patternLength,
    );
    appendObservedDart(turn, observation, {
      intendedTargetNumber: intendedDouble,
      intendedZoneKey: "DOUBLE",
    });
    if (turn.darts.length === patternLength) {
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
   * Records that the step's countdown has elapsed — mirrors
   * `TuodEngine.expireTimer()` (D264).
   */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): DoublePatternState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const doublePatternEngineFactory: DartExerciseEngineFactory<
  DoublePatternConfigData,
  DoublePatternState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: DoublePatternConfigData, prior?: EngineFacts) {
    return new DoublePatternEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(doublePatternEngineFactory);
