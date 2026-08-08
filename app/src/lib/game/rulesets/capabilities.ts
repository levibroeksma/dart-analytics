import type { RulesetVersionKey } from "@lib/types";
import type { ModePair } from "./types";

const QUICK_SCORE: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
};

const DETAILED_DARTS: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
};

const VISUAL_BOARD: ModePair = {
  captureModeKey: "ANALYTICS",
  inputModeKey: "VISUAL_BOARD",
};

/**
 * Which capture/input mode combinations each ruleset version's engine actually
 * implements. This is the code-side source of truth. `createSession`
 * (`services/session.service.ts`) refuses an undeclared pair before any write,
 * `settings.service.ts` refuses an app mode no ruleset can play, and the games
 * page filters its cards on it through `lib/game/rulesets/games-visibility.ts`.
 *
 * `database/seeds/0007_ruleset_version_capabilities.sql` mirrors this table
 * into `ruleset_version_capabilities`, and a parity test proves the two agree.
 * Adding a pair here without adding the seed row leaves the database rejecting
 * sessions the code accepts.
 *
 * Each ruleset's `validateConfig` states the same thing independently, and is
 * deliberately not wired to this constant — one says what the system claims to
 * support, the other what a ruleset implements, and collapsing them would
 * destroy the cross-check. `capability-validator-parity.test.ts` proves they
 * agree in both directions.
 */
export const RULESET_CAPABILITIES: Readonly<
  Record<RulesetVersionKey, readonly ModePair[]>
> = {
  "501_V1": [QUICK_SCORE, VISUAL_BOARD],
  SCORE_TRAINING_V1: [QUICK_SCORE, VISUAL_BOARD],
  TUOD_V1: [QUICK_SCORE],
  SINGLES_V1: [DETAILED_DARTS],
  BOBS27_V1: [DETAILED_DARTS],
  DOUBLES_TRAINING_V1: [DETAILED_DARTS],
};

/** Whether this ruleset version's engine implements the given mode pair. */
export function supportsMode(
  rulesetVersionKey: RulesetVersionKey,
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  const pairs = RULESET_CAPABILITIES[rulesetVersionKey];
  if (!pairs) return false;
  return pairs.some(
    (pair) =>
      pair.captureModeKey === captureModeKey &&
      pair.inputModeKey === inputModeKey,
  );
}

/** Every ruleset version playable under the given mode pair. */
export function capableRulesets(
  captureModeKey: string,
  inputModeKey: string,
): readonly RulesetVersionKey[] {
  return (Object.keys(RULESET_CAPABILITIES) as RulesetVersionKey[]).filter(
    (key) => supportsMode(key, captureModeKey, inputModeKey),
  );
}
