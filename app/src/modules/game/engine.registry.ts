import type { RulesetVersionKey } from "@lib/types";
import { capableRulesets } from "@lib/game/rulesets/capabilities";
import type { GameEngineFactory } from "./interfaces";

/**
 * Type-erased view of a `GameEngineFactory` used at the registry boundary.
 * `unknown` (not `never`) fills the erased type parameters: a concrete
 * `GameEngineFactory<TConfig, TInput, TState>` upcasts into this shape with
 * no unsafe cast, and callers pass real `create()`/`record()` arguments
 * straight through with no cast either — only the returned `state()`/
 * `record()` value needs narrowing at the point of use, once the caller
 * knows the concrete type for the `RulesetVersionKey` it looked up.
 */
type AnyGameEngineFactory = GameEngineFactory<unknown, unknown, unknown>;

const REGISTRY = new Map<RulesetVersionKey, AnyGameEngineFactory>();

export function registerEngineFactory(factory: AnyGameEngineFactory): void {
  if (REGISTRY.has(factory.rulesetVersionKey)) {
    throw new Error(
      `Engine factory already registered for ${factory.rulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.rulesetVersionKey, factory);
}

export function getEngineFactory(
  key: RulesetVersionKey,
): AnyGameEngineFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetEngineRegistry(): void {
  REGISTRY.clear();
}

/**
 * Every registered ruleset version playable under the given mode pair —
 * the intersection of what an engine exists for and what that engine declares
 * it supports. The games page filters its cards on this, so a game whose
 * engine was never registered never appears, even if the capability table
 * declares it.
 */
export function registeredRulesetsFor(
  captureModeKey: string,
  inputModeKey: string,
): readonly RulesetVersionKey[] {
  return capableRulesets(captureModeKey, inputModeKey).filter((key) =>
    REGISTRY.has(key),
  );
}
