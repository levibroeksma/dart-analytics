import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { summariseTargetScoring } from "@modules/training/routines/routine-summary.module";
import type { TargetScoringConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const targetScoringAdapter: StepAdapter = {
  key: "TARGET_SCORING",
  headerLabel: "target scoring",
  panel: "target-scoring",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("TARGET_SCORING_V1");
    const created = factory?.create(
      result.configuration as TargetScoringConfigData,
    );
    ctx.targetScoringEngine =
      created instanceof TargetScoringEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.targetScoringEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.targetScoringEngine) return null;
    return summariseTargetScoring(ctx.targetScoringEngine.state());
  },
  close(ctx) {
    ctx.targetScoringEngine = null;
  },
};
