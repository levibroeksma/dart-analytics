import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { SwitchingChainEngine } from "@modules/training/exercises/switching-chain.engine.module";
import { summariseSwitchingChain } from "@modules/training/routines/routine-summary.module";
import type { SwitchingChainConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const switchingChainAdapter: StepAdapter = {
  key: "SWITCHING_CHAIN",
  headerLabel: "switching chain",
  title: "Switching Chain",
  panel: "switching-chain",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("SWITCHING_CHAIN_V1");
    const created = factory?.create(
      result.configuration as SwitchingChainConfigData,
    );
    ctx.switchingChainEngine =
      created instanceof SwitchingChainEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.switchingChainEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.switchingChainEngine) return null;
    return summariseSwitchingChain(ctx.switchingChainEngine.state());
  },
  close(ctx) {
    ctx.switchingChainEngine = null;
  },
};
