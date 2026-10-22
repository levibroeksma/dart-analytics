import { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import { summariseDoublePattern } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const doublePatternAdapter = dartExerciseAdapter({
  key: "DOUBLE_PATTERN",
  headerLabel: "doubles",
  title: "Double Pattern",
  panel: "double-pattern",
  rulesetKey: "DOUBLE_PATTERN_V1",
  slot: "doublePatternEngine",
  engineClass: DoublePatternEngine,
  summarise: (engine) => summariseDoublePattern(engine.state()),
});
