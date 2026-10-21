import { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import { summariseSwitching } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const switchingAdapter = dartExerciseAdapter({
  key: "SWITCHING",
  headerLabel: "switching",
  title: "Switching",
  panel: "switching",
  rulesetKey: "SWITCHING_V1",
  slot: "switchingEngine",
  engineClass: SwitchingEngine,
  summarise: (engine) => summariseSwitching(engine.state(), engine.facts()),
});
