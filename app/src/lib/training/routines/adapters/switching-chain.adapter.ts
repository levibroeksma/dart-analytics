import { SwitchingChainEngine } from "@modules/training/exercises/switching-chain.engine.module";
import { summariseSwitchingChain } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const switchingChainAdapter = dartExerciseAdapter({
  key: "SWITCHING_CHAIN",
  headerLabel: "switching chain",
  title: "Switching Chain",
  panel: "switching-chain",
  rulesetKey: "SWITCHING_CHAIN_V1",
  slot: "switchingChainEngine",
  engineClass: SwitchingChainEngine,
  summarise: (engine) => summariseSwitchingChain(engine.state()),
});
