import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchingTargetScoringEngine } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { summariseSwitchingTargetScoring } from "@modules/training/routines/routine-summary.module";
import type { SwitchingTargetScoringConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const switchingTargetScoringAdapter: StepAdapter = {
  key: "SWITCHING_TARGET_SCORING",
  headerLabel: "switching target scoring",
  panel: "switching-target-scoring",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SWITCHING_TARGET_SCORING_V1");
    const created = factory?.create(
      result.configuration as SwitchingTargetScoringConfigData,
    );
    ctx.switchingTargetScoringEngine =
      created instanceof SwitchingTargetScoringEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.switchingTargetScoringEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.switchingTargetScoringEngine) return null;
    return summariseSwitchingTargetScoring(
      ctx.switchingTargetScoringEngine.state(),
    );
  },
  close(ctx) {
    ctx.switchingTargetScoringEngine = null;
  },
};
