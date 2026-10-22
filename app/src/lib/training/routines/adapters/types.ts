/**
 * Which `StepAdapter` a resolved step maps to. The seeded exercise
 * kinds are fixed strings; a GAME step's key is templated on its pinned
 * game ruleset version, since each routine-eligible game gets its own
 * adapter (`ROUTINE_GAME_STEPS`, `services/routines/game-step.ts`).
 * `SWITCHING_CHAIN` is the one exercise key that is not an exercise type
 * key: Switching's Chain config is a second ruleset version of the
 * `SWITCHING` type, so `stepAdapterKey()` resolves it off the step's
 * exercise ruleset version instead.
 */
export type StepAdapterKey =
  | "WARM_UP"
  | "SWITCHING"
  | "SWITCHING_CHAIN"
  | "DOUBLE_PATTERN"
  | "TARGET_SCORING"
  | "SCORE_THRESHOLD"
  | "BULLSEYE_CHECKOUT"
  | "BULL_UP"
  | "CHECKOUT_SEQUENCE"
  | "RANDOM_CHECKOUT"
  | "HIT_COUNT"
  | "SWITCHBLADE"
  | "DOUBLES_LOCK"
  | "HALVE_IT"
  | "DOUBLES_SNAKES_LADDERS"
  | `GAME:${string}`;

/** The play page's own `x-if` switch — one template block per panel. */
export type StepPanel =
  | "warm-up"
  | "switching"
  | "switching-chain"
  | "double-pattern"
  | "target-scoring"
  | "score-threshold"
  | "bullseye-checkout"
  | "bull-up"
  | "checkout-sequence"
  | "random-checkout"
  | "hit-count"
  | "switchblade"
  | "doubles-lock"
  | "halve-it"
  | "doubles-snakes-ladders"
  | "tuod"
  | "score-training"
  | "one-twenty-one"
  | "around-the-clock";
