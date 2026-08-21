import {
  RULESET_CAPABILITIES,
  supportsMode,
} from "@lib/game/rulesets/capabilities";
import type { ModePair, RulesetVersionKey, SeatFact, Seated } from "@lib/types";

/**
 * The capture/input mode pair a `createSession` call should send, given the
 * player's chosen mode from the `settings` store. Called from both setup
 * pages (starting a new session) and play pages (resuming/continuing one).
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
 * Turns the participants the server minted into the session's seat list. The
 * response array's order IS seat order — the setup screen decides who throws
 * first in leg 1 by the order it sends. V1 gives each seat its own side
 * (`A`, `B`, …); a future 2v2 assigns two seats to one side, which every X01
 * win condition already folds for.
 */
export function seatsFromParticipants(
  participants: {
    ref: string;
    participantTypeKey: string;
    displayName: string;
  }[],
): SeatFact[] {
  return participants.map((participant, index) => ({
    participantRef: participant.ref,
    displayName: participant.displayName,
    sideKey: String.fromCharCode(65 + index),
    participantTypeKey:
      participant.participantTypeKey === "GUEST" ? "GUEST" : "PLAYER",
  }));
}

/**
 * The store payload that starts a session, assembled once for both setup
 * pages. They differ only in game type, ruleset and config snapshot; every
 * other field is read off the same two objects, so a new session field (the
 * mode pair was the most recent) is added here rather than in two places that
 * must be kept in step by hand.
 *
 * Seats are composed INTO the snapshot rather than stored beside it: the
 * snapshot is what the engine is constructed from, and a second copy of the
 * seat list is a second thing that can drift from it.
 */
export function startSessionInput<TConfig extends object>(input: {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  session: {
    sessionId: string;
    participants: {
      ref: string;
      participantTypeKey: string;
      displayName: string;
    }[];
  };
  templateRef: string;
  configSnapshot: TConfig;
  modePair: ModePair;
}) {
  return {
    gameTypeKey: input.gameTypeKey,
    rulesetVersionKey: input.rulesetVersionKey,
    sessionId: input.session.sessionId,
    templateRef: input.templateRef,
    configSnapshot: {
      ...input.configSnapshot,
      seats: seatsFromParticipants(input.session.participants),
    } as Seated<TConfig>,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}

/**
 * Re-seats a config snapshot onto the participants a freshly-created session
 * minted. Play Again keeps the ruleset config but gets new participant rows,
 * so the seats inside the snapshot must be replaced rather than carried over —
 * a stale ref would attribute the new session's turns to a participant that
 * belongs to the finished one.
 */
export function reseatSnapshot<TConfig extends object>(
  configSnapshot: TConfig,
  participants: {
    ref: string;
    participantTypeKey: string;
    displayName: string;
  }[],
): Seated<TConfig> {
  return {
    ...configSnapshot,
    seats: seatsFromParticipants(participants),
  } as Seated<TConfig>;
}
