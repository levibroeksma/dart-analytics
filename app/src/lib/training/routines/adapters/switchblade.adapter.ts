import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import { summariseSwitchblade } from "@modules/training/routines/routine-summary.module";
import type { SwitchbladeConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const switchbladeAdapter: StepAdapter = {
  key: "SWITCHBLADE",
  headerLabel: "SwitchBlade",
  title: "SwitchBlade",
  panel: "switchblade",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SWITCHBLADE_V1");
    const created = factory?.create(
      result.configuration as SwitchbladeConfigData,
    );
    ctx.switchbladeEngine =
      created instanceof SwitchbladeEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.switchbladeEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.switchbladeEngine) return null;
    return summariseSwitchblade(ctx.switchbladeEngine.state());
  },
  close(ctx) {
    ctx.switchbladeEngine = null;
  },
};
