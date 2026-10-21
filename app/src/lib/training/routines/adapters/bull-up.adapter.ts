import { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import { summariseBullUp } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const bullUpAdapter = dartExerciseAdapter({
  key: "BULL_UP",
  headerLabel: "Bull up practice",
  title: "Bull Up Practice",
  panel: "bull-up",
  rulesetKey: "BULL_UP_V1",
  slot: "bullUpEngine",
  engineClass: BullUpEngine,
  summarise: (engine) => summariseBullUp(engine.state()),
});
