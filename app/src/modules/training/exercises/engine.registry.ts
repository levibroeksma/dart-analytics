import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { ExerciseEngineFactory } from "./interfaces";

/**
 * Type-erased view of an `ExerciseEngineFactory` used at the registry
 * boundary, mirroring `modules/game/engine.registry.ts`. `unknown` fills the
 * erased parameters so a concrete factory upcasts with no unsafe cast.
 */
type AnyExerciseEngineFactory = ExerciseEngineFactory<unknown, unknown>;

const REGISTRY = new Map<ExerciseRulesetVersionKey, AnyExerciseEngineFactory>();

export function registerExerciseEngineFactory(
  factory: AnyExerciseEngineFactory,
): void {
  if (REGISTRY.has(factory.exerciseRulesetVersionKey)) {
    throw new Error(
      `Exercise engine factory already registered for ${factory.exerciseRulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.exerciseRulesetVersionKey, factory);
}

export function getExerciseEngineFactory(
  key: ExerciseRulesetVersionKey,
): AnyExerciseEngineFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetExerciseEngineRegistry(): void {
  REGISTRY.clear();
}
