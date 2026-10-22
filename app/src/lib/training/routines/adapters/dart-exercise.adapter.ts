import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type {
  DartEngineSlot,
  ExerciseRulesetVersionKey,
  RoutinePlayContext,
} from "@lib/types";
import type { RoutineStepSummary } from "@modules/types";
import type { StepAdapter } from "./interfaces";
import type { StepAdapterKey, StepPanel } from "./types";

type SlotEngine<TSlot extends DartEngineSlot> = NonNullable<
  RoutinePlayContext[TSlot]
>;

/**
 * Builds the `StepAdapter` for one dart exercise: `open` builds its engine
 * from the registry into `slot` and starts the step timer, `facts` and
 * `summarise` read that engine, `close` empties the slot.
 */
export function dartExerciseAdapter<TSlot extends DartEngineSlot>(input: {
  key: StepAdapterKey;
  headerLabel: string;
  title: string;
  panel: StepPanel;
  rulesetKey: ExerciseRulesetVersionKey;
  slot: TSlot;
  engineClass: abstract new (...args: never[]) => SlotEngine<TSlot>;
  summarise: (engine: SlotEngine<TSlot>) => RoutineStepSummary;
}): StepAdapter {
  const engineOf = (ctx: RoutinePlayContext): SlotEngine<TSlot> | null =>
    ctx[input.slot] as SlotEngine<TSlot> | null;
  return {
    key: input.key,
    headerLabel: input.headerLabel,
    title: input.title,
    panel: input.panel,
    open(ctx, result, durationSeconds) {
      const created = getDartExerciseEngineFactory(input.rulesetKey)?.create(
        result.configuration,
      );
      Object.assign(ctx, {
        [input.slot]: created instanceof input.engineClass ? created : null,
      });
      ctx.startStepTimer(durationSeconds);
    },
    facts(ctx) {
      return engineOf(ctx)?.facts() ?? null;
    },
    completesOwnSession: false,
    summarise(ctx) {
      const engine = engineOf(ctx);
      return engine ? input.summarise(engine) : null;
    },
    close(ctx) {
      Object.assign(ctx, { [input.slot]: null });
    },
  };
}
