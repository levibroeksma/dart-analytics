import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import { summariseDoublePattern } from "@modules/training/routines/routine-summary.module";
import type { DoublePatternConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const doublePatternAdapter: StepAdapter = {
  key: "DOUBLE_PATTERN",
  headerLabel: "doubles",
  panel: "double-pattern",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("DOUBLE_PATTERN_V1");
    const created = factory?.create(
      result.configuration as DoublePatternConfigData,
    );
    ctx.doublePatternEngine =
      created instanceof DoublePatternEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.doublePatternEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.doublePatternEngine) return null;
    return summariseDoublePattern(ctx.doublePatternEngine.state());
  },
  close(ctx) {
    ctx.doublePatternEngine = null;
  },
};
