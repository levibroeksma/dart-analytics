import type { ScoreThresholdConfigData } from "@lib/types";
import { ScoreThresholdV1Config } from "@lib/training/exercises/rulesets/types";
import type { EngineFacts } from "@modules/types";
import type { DartExerciseSpec } from "@modules/interfaces";
import { foldVisitPoints } from "@modules/game/visit-points-kernel.module";
import { NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { ScoreThresholdState } from "./types";

/**
 * Folds the whole fact log into Score Threshold state through the Visit
 * points kernel — a pure function of `facts`/`config`/`expired`. A closed
 * three-dart visit earns one beat when its board total reaches the
 * threshold; a visit open at expiry stays unjudged.
 */
function fold(
  facts: EngineFacts,
  config: ScoreThresholdConfigData,
  expired: boolean,
): ScoreThresholdState {
  const seat = foldVisitPoints(facts.turns, {
    dartsPerVisit: 3,
    points: (total) => (total >= config.threshold ? 1 : 0),
  });
  return {
    threshold: config.threshold,
    beats: seat.points,
    visits: seat.visits,
    lastVisitTotal: seat.lastVisitTotal,
    currentVisitTotal: seat.openTotal,
    dartsInVisit: seat.dartsInVisit,
    dartsThrown: seat.dartsThrown,
    status: expired ? "COMPLETE" : "IN_PROGRESS",
  };
}

const scoreThresholdSpec: DartExerciseSpec<
  ScoreThresholdConfigData,
  ScoreThresholdState
> = {
  exerciseRulesetVersionKey: "SCORE_THRESHOLD_V1",
  parse: (config) => ScoreThresholdV1Config.parse(config),
  fold,
  intent: () => NO_INTENT,
  isVisitOpen: (_turn, state) => state.dartsInVisit > 0,
};

export const foldScoreThresholdState = scoreThresholdSpec.fold;

/**
 * Score Threshold ("65 or More"): three darts, free aim, a visit beats when
 * its board total reaches the threshold
 * (`docs/game-rules/training/exercises/score-threshold.md`), on the Visit
 * points kernel and the exercise shell. One `TurnFact` is one three-dart
 * visit; darts carry no intent. Clockless: completion arrives only through
 * `expireTimer()` (D264).
 */
export class ScoreThresholdEngine extends dartExerciseEngineClass(
  scoreThresholdSpec,
) {}

export const scoreThresholdEngineFactory = registerDartExercise(
  scoreThresholdSpec,
  ScoreThresholdEngine,
).factory;
