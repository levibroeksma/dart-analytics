import {
  RULESET_CAPABILITIES,
  supportsMode,
} from "@lib/game/rulesets/capabilities";
import type { ModePair, RulesetVersionKey } from "@lib/types";

/**
 * The capture/input mode pair a setup page's `createSession` call should
 * send, given the player's chosen mode from the `settings` store.
 *
 * The fallback is the ruleset's own first pair declared in
 * `RULESET_CAPABILITIES`, not a hardcoded constant — a ruleset that never
 * declares `RECREATIONAL + QUICK_SCORE` (e.g. `BOBS27_V1`, which declares
 * `RECREATIONAL + DETAILED_DARTS` and `ANALYTICS + VISUAL_BOARD`) still
 * starts a session under a pair it actually supports when `settings` hasn't
 * finished loading, has no saved row for the player, or is absent in a test
 * double.
 *
 * `createSession` (`services/session.service.ts`) rejects an undeclared pair
 * via `supportsMode` before any write, and would reject `undefined` outright,
 * so this never forwards either.
 */
export function resolveSessionModePair(
  rulesetVersionKey: RulesetVersionKey,
  settings: Partial<ModePair> | null | undefined,
): ModePair {
  const fallback = RULESET_CAPABILITIES[rulesetVersionKey][0];
  const captureModeKey = settings?.captureModeKey ?? fallback.captureModeKey;
  const inputModeKey = settings?.inputModeKey ?? fallback.inputModeKey;

  if (supportsMode(rulesetVersionKey, captureModeKey, inputModeKey)) {
    return { captureModeKey, inputModeKey };
  }

  return fallback;
}

/**
 * The store payload that starts a session, assembled once for both setup
 * pages. They differ only in game type, ruleset and config snapshot; every
 * other field is read off the same two objects, so a new session field (the
 * mode pair was the most recent) is added here rather than in two places that
 * must be kept in step by hand.
 */
export function startSessionInput(input: {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  session: { sessionId: string; participants: { ref: string }[] };
  templateRef: string;
  configSnapshot: unknown;
  modePair: ModePair;
}) {
  return {
    gameTypeKey: input.gameTypeKey,
    rulesetVersionKey: input.rulesetVersionKey,
    sessionId: input.session.sessionId,
    participantRef: input.session.participants[0].ref,
    templateRef: input.templateRef,
    configSnapshot: input.configSnapshot,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}
