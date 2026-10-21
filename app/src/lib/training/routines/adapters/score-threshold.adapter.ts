import { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import { summariseScoreThreshold } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const scoreThresholdAdapter = dartExerciseAdapter({
  key: "SCORE_THRESHOLD",
  headerLabel: "65 or more",
  title: "65 or More",
  panel: "score-threshold",
  rulesetKey: "SCORE_THRESHOLD_V1",
  slot: "scoreThresholdEngine",
  engineClass: ScoreThresholdEngine,
  summarise: (engine) => summariseScoreThreshold(engine.state()),
});
