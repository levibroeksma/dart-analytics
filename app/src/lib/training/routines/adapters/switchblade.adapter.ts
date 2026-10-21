import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import { summariseSwitchblade } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const switchbladeAdapter = dartExerciseAdapter({
  key: "SWITCHBLADE",
  headerLabel: "SwitchBlade",
  title: "SwitchBlade",
  panel: "switchblade",
  rulesetKey: "SWITCHBLADE_V1",
  slot: "switchbladeEngine",
  engineClass: SwitchbladeEngine,
  summarise: (engine) => summariseSwitchblade(engine.state()),
});
