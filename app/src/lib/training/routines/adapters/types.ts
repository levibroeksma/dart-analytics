/**
 * Which `StepAdapter` a resolved step maps to. The seeded exercise
 * kinds are fixed strings; a GAME step's key is templated on its pinned
 * game ruleset version, since each routine-eligible game gets its own
 * adapter (`ROUTINE_GAME_STEPS`, `services/routines/game-step.ts`).
 */
export type StepAdapterKey =
  | "WARM_UP"
  | "SWITCHING"
  | "DOUBLE_PATTERN"
  | "TARGET_SCORING"
  | "SWITCHING_TARGET_SCORING"
  | `GAME:${string}`;

/** The play page's own `x-if` switch — one template block per panel. */
export type StepPanel =
  | "warm-up"
  | "switching"
  | "double-pattern"
  | "target-scoring"
  | "switching-target-scoring"
  | "tuod"
  | "score-training"
  | "one-twenty-one";
