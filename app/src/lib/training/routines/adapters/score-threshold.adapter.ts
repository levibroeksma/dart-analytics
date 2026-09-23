import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { ScoreThresholdEngine } from "@modules/training/exercises/score-threshold.engine.module";
import { summariseScoreThreshold } from "@modules/training/routines/routine-summary.module";
import type { ScoreThresholdConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const scoreThresholdAdapter: StepAdapter = {
  key: "SCORE_THRESHOLD",
  headerLabel: "65 or more",
  panel: "score-threshold",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SCORE_THRESHOLD_V1");
    const created = factory?.create(
      result.configuration as ScoreThresholdConfigData,
    );
    ctx.scoreThresholdEngine =
      created instanceof ScoreThresholdEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.scoreThresholdEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.scoreThresholdEngine) return null;
    return summariseScoreThreshold(ctx.scoreThresholdEngine.state());
  },
  close(ctx) {
    ctx.scoreThresholdEngine = null;
  },
};
