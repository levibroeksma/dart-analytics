import { HalveItEngine } from "@modules/training/exercises/halve-it.engine.module";
import { summariseHalveIt } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const halveItAdapter = dartExerciseAdapter({
  key: "HALVE_IT",
  headerLabel: "Halve-It",
  title: "Halve-It",
  panel: "halve-it",
  rulesetKey: "HALVE_IT_V1",
  slot: "halveItEngine",
  engineClass: HalveItEngine,
  summarise: (engine) => summariseHalveIt(engine.state()),
});
