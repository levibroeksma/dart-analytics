import type { ScoreThresholdConfigData } from "@lib/types";
import { ScoreThresholdV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
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
import type { ScoreThresholdState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SCORE_THRESHOLD_V1" as const;
const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;

type Progress = {
  beats: number;
  visits: number;
  lastVisitTotal: number | null;
  currentVisitTotal: number;
  dartsInVisit: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: Progress = {
  beats: 0,
  visits: 0,
  lastVisitTotal: null,
  currentVisitTotal: 0,
  dartsInVisit: 0,
  dartsThrown: 0,
};

/**
 * Folds one visit onto the running progress. A visit of three darts is
 * judged against the threshold; a shorter one is the visit still open —
 * at timer expiry it stays unjudged.
 */
function applyVisit(
  threshold: number,
  progress: Progress,
  turn: TurnFact,
): Progress {
  const total = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
  const dartsThrown = progress.dartsThrown + turn.darts.length;
  if (turn.darts.length < DARTS_PER_VISIT) {
    return {
      ...progress,
      currentVisitTotal: total,
      dartsInVisit: turn.darts.length,
      dartsThrown,
    };
  }
  return {
    beats: progress.beats + (total >= threshold ? 1 : 0),
    visits: progress.visits + 1,
    lastVisitTotal: total,
    currentVisitTotal: 0,
    dartsInVisit: 0,
    dartsThrown,
  };
}

/**
 * Folds the whole fact log into Score Threshold state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSwitchingTargetScoringState`.
 * A dart's `score` is its board score, so the visit total needs no rules
 * of its own.
 */
export function foldScoreThresholdState(
  facts: EngineFacts,
  config: ScoreThresholdConfigData,
  complete: boolean,
): ScoreThresholdState {
  const progress = facts.turns.reduce(
    (acc, turn) => applyVisit(config.threshold, acc, turn),
    INITIAL_PROGRESS,
  );

  return {
    threshold: config.threshold,
    ...progress,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Score Threshold ("65 or More"): three darts, free aim, a visit beats when
 * its board total reaches the threshold
 * (`docs/game-rules/training/exercises/score-threshold.md`). One `TurnFact`
 * is one three-dart visit; darts carry no intent. Clockless: completion
 * arrives only through `expireTimer()` (D264).
 */
export class ScoreThresholdEngine implements DartExerciseEngine<ScoreThresholdState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: ScoreThresholdConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: ScoreThresholdConfigData, prior?: EngineFacts) {
    this.config = ScoreThresholdV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): ScoreThresholdState {
    return foldScoreThresholdState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): ScoreThresholdState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < DARTS_PER_VISIT,
    );
    appendObservedDart(turn, observation);
    if (turn.darts.length === DARTS_PER_VISIT) {
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

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): ScoreThresholdState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const scoreThresholdEngineFactory: DartExerciseEngineFactory<
  ScoreThresholdConfigData,
  ScoreThresholdState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: ScoreThresholdConfigData, prior?: EngineFacts) {
    return new ScoreThresholdEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(scoreThresholdEngineFactory);
