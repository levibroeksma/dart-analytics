import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import { summariseSwitching } from "@modules/training/routines/routine-summary.module";
import type { SwitchingConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const switchingAdapter: StepAdapter = {
  key: "SWITCHING",
  headerLabel: "switching",
  panel: "switching",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SWITCHING_V1");
    const created = factory?.create(
      result.configuration as SwitchingConfigData,
    );
    ctx.switchingEngine = created instanceof SwitchingEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.switchingEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.switchingEngine) return null;
    return summariseSwitching(
      ctx.switchingEngine.state(),
      ctx.switchingEngine.facts(),
    );
  },
  close(ctx) {
    ctx.switchingEngine = null;
  },
};
