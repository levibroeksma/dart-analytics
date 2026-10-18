import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { summariseDoublesLock } from "@modules/training/routines/routine-summary.module";
import type { DoublesLockConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const doublesLockAdapter: StepAdapter = {
  key: "DOUBLES_LOCK",
  headerLabel: "Doubles Lock",
  title: "Doubles Lock",
  panel: "doubles-lock",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("DOUBLES_LOCK_V1");
    const created = factory?.create(
      result.configuration as DoublesLockConfigData,
    );
    ctx.doublesLockEngine =
      created instanceof DoublesLockEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.doublesLockEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.doublesLockEngine) return null;
    return summariseDoublesLock(ctx.doublesLockEngine.state());
  },
  close(ctx) {
    ctx.doublesLockEngine = null;
  },
};
