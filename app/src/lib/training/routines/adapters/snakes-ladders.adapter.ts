import { SnakesLaddersEngine } from "@modules/training/exercises/snakes-ladders.engine.module";
import { summariseSnakesLadders } from "@modules/training/routines/routine-summary.module";
import { dartExerciseAdapter } from "./dart-exercise.adapter";

export const snakesLaddersAdapter = dartExerciseAdapter({
  key: "DOUBLES_SNAKES_LADDERS",
  headerLabel: "Doubles Snakes & Ladders",
  title: "Doubles Snakes & Ladders",
  panel: "doubles-snakes-ladders",
  rulesetKey: "DOUBLES_SNAKES_LADDERS_V1",
  slot: "snakesLaddersEngine",
  engineClass: SnakesLaddersEngine,
  summarise: (engine) => summariseSnakesLadders(engine.state()),
});
