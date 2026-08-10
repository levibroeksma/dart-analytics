import { supportsMode } from "@lib/game/rulesets/capabilities";
import type { ModePair, RulesetVersionKey } from "@lib/types";

const QUICK_SCORE: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
};

/**
 * The capture/input mode pair a setup page's `createSession` call should
 * send, given the player's chosen mode from the `settings` store.
 *
 * Both `five-oh-one-setup.data.ts` and `score-training-setup.data.ts` start
 * a `501_V1`/`SCORE_TRAINING_V1` session; both rulesets declare exactly the
 * same two pairs in `capabilities.ts` — quick score and visual board — so
 * `QUICK_SCORE` is always one of `RULESET_CAPABILITIES[rulesetVersionKey]`
 * for every caller this helper currently has. A future caller for a ruleset
 * that does not declare `QUICK_SCORE` (e.g. `SINGLES_V1`) would need its own
 * fallback; this helper does not attempt to guess one.
 *
 * `settings` may be missing fields, or missing outright, when the `settings`
 * store has not finished loading, has no saved row for the player, or is
 * absent in a test double — `createSession` (`services/session.service.ts`)
 * rejects an undeclared pair via `supportsMode` before any write, and would
 * reject `undefined` outright, so this never forwards either.
 */
export function resolveSessionModePair(
  rulesetVersionKey: RulesetVersionKey,
  settings: Partial<ModePair> | null | undefined,
): ModePair {
  const captureModeKey = settings?.captureModeKey ?? QUICK_SCORE.captureModeKey;
  const inputModeKey = settings?.inputModeKey ?? QUICK_SCORE.inputModeKey;

  if (supportsMode(rulesetVersionKey, captureModeKey, inputModeKey)) {
    return { captureModeKey, inputModeKey };
  }

  return QUICK_SCORE;
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
