import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import { summariseDoublesLock } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const doublesLockAdapter = dartExerciseAdapter({
  key: "DOUBLES_LOCK",
  headerLabel: "Doubles Lock",
  title: "Doubles Lock",
  panel: "doubles-lock",
  rulesetKey: "DOUBLES_LOCK_V1",
  slot: "doublesLockEngine",
  engineClass: DoublesLockEngine,
  summarise: (engine) => summariseDoublesLock(engine.state()),
});
