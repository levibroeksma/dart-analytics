import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import { summariseBullUp } from "@modules/training/routines/routine-summary.module";
import type { BullUpConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const bullUpAdapter: StepAdapter = {
  key: "BULL_UP",
  headerLabel: "Bull up practice",
  panel: "bull-up",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("BULL_UP_V1");
    const created = factory?.create(result.configuration as BullUpConfigData);
    ctx.bullUpEngine = created instanceof BullUpEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.bullUpEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.bullUpEngine) return null;
    return summariseBullUp(ctx.bullUpEngine.state());
  },
  close(ctx) {
    ctx.bullUpEngine = null;
  },
};
