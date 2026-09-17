import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { DartExerciseEngineFactory } from "./interfaces";

/**
 * Type-erased view of a `DartExerciseEngineFactory` used at the registry
 * boundary, mirroring `engine.registry.ts`. `unknown` fills the erased
 * parameters so a concrete factory upcasts with no unsafe cast.
 */
type AnyDartExerciseEngineFactory = DartExerciseEngineFactory<unknown, unknown>;

const REGISTRY = new Map<
  ExerciseRulesetVersionKey,
  AnyDartExerciseEngineFactory
>();

export function registerDartExerciseEngineFactory(
  factory: AnyDartExerciseEngineFactory,
): void {
  if (REGISTRY.has(factory.exerciseRulesetVersionKey)) {
    throw new Error(
      `Dart exercise engine factory already registered for ${factory.exerciseRulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.exerciseRulesetVersionKey, factory);
}

export function getDartExerciseEngineFactory(
  key: ExerciseRulesetVersionKey,
): AnyDartExerciseEngineFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetDartExerciseEngineRegistry(): void {
  REGISTRY.clear();
}
