import { HitCountEngine } from "@modules/training/exercises/hit-count.engine.module";
import { summariseHitCount } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const hitCountAdapter = dartExerciseAdapter({
  key: "HIT_COUNT",
  headerLabel: "Hit Count",
  title: "Hit Count",
  panel: "hit-count",
  rulesetKey: "HIT_COUNT_V1",
  slot: "hitCountEngine",
  engineClass: HitCountEngine,
  summarise: (engine) => summariseHitCount(engine.state()),
});
