import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { summariseTargetScoring } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const targetScoringAdapter = dartExerciseAdapter({
  key: "TARGET_SCORING",
  headerLabel: "target scoring",
  title: "Target Scoring",
  panel: "target-scoring",
  rulesetKey: "TARGET_SCORING_V1",
  slot: "targetScoringEngine",
  engineClass: TargetScoringEngine,
  summarise: (engine) => summariseTargetScoring(engine.state()),
});
