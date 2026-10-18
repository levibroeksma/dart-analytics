import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { summariseHitCount } from "@modules/training/routines/routine-summary.module";
import type { HitCountConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const hitCountAdapter: StepAdapter = {
  key: "HIT_COUNT",
  headerLabel: "Hit Count",
  title: "Hit Count",
  panel: "hit-count",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("HIT_COUNT_V1");
    const created = factory?.create(result.configuration as HitCountConfigData);
    ctx.hitCountEngine = created instanceof HitCountEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.hitCountEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.hitCountEngine) return null;
    return summariseHitCount(ctx.hitCountEngine.state());
  },
  close(ctx) {
    ctx.hitCountEngine = null;
  },
};
