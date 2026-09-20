export type RoutineGameStepHook = {
  rulesetVersionKey: string;
  /** Writes the step's minutes into the ruleset's own timed-mode keys. */
  applyStepDuration(config: Record<string, unknown>, minutes: number): void;
  /** Inclusive minute bounds the ruleset's timed mode accepts. */
  minuteBounds: { min: number; max: number };
};
