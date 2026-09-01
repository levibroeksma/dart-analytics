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
 * Maps the participants a session-create call minted or a finished session
 * played with into `SeatFact[]` — the shape the configuration snapshot
 * carries. Private: both `startSessionInput` and `reseatSnapshot` need the
 * identical mapping, and it is no longer the "coerce anything-not-GUEST to
 * PLAYER" function `seatsFromParticipants` used to be (the anti-pattern
 * `08-DartBot.md` names — a bot seat silently held as the human player).
 * Every participant type round-trips as itself.
 */
function toSeatFacts(
  participants: {
    ref: string;
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[],
): SeatFact[] {
  return participants.map((participant, index) => {
    const sideKey = String.fromCharCode(65 + index);
    if (participant.participantTypeKey === "DARTBOT" && participant.dartbot) {
      return {
        participantRef: participant.ref,
        displayName: participant.displayName,
        sideKey,
        participantTypeKey: "DARTBOT",
        dartbot: participant.dartbot,
      };
    }
    return {
      participantRef: participant.ref,
      displayName: participant.displayName,
      sideKey,
      participantTypeKey:
        participant.participantTypeKey === "GUEST" ? "GUEST" : "PLAYER",
    };
  });
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
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName: string;
      dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
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
      seats: toSeatFacts(input.session.participants),
    } as Seated<TConfig>,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}

/**
 * The `participants` a replay's `createSession` must request, derived from the
 * seats the finished session actually played with — the inverse of
 * `seatsFromParticipants`, and the same shape the setup screen sends when a
 * guest is added at start time.
 *
 * Play Again mints a brand-new session, so omitting this field would seat the
 * replay with the single `PLAYER` the server derives by default: a 1v1 match
 * would silently replay solo, and every dart stamped with the engine's second
 * seat would upload as `BATCH_REFERENCE_MISSING`.
 *
 * A solo seat list returns `undefined` — the field's own "omit me" value —
 * so a solo replay sends exactly the request it always did. `displayName` is
 * carried for a GUEST only; the PLAYER's is copied server-side from
 * `players.display_name` and a client-supplied value is ignored.
 */
export function participantsFromSeats(seats: readonly SeatFact[]):
  | {
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName?: string;
      level?: number;
      sideKey: string;
    }[]
  | undefined {
  if (seats.length < 2) return undefined;
  return seats.map((seat) => {
    if (seat.participantTypeKey === "DARTBOT") {
      return {
        participantTypeKey: "DARTBOT" as const,
        level: seat.dartbot.level,
        sideKey: seat.sideKey,
      };
    }
    return {
      participantTypeKey: seat.participantTypeKey,
      ...(seat.participantTypeKey === "GUEST"
        ? { displayName: seat.displayName }
        : {}),
      sideKey: seat.sideKey,
    };
  });
}

/**
 * The `participants` a setup screen's `createSession` must request, given
 * either the guests the player added or the DartBot opponent they chose — the
 * start-time twin of `participantsFromSeats`, which derives the same shape
 * from a finished session's seats. `bot` and `guests` are mutually exclusive
 * — `guest-list.ts`'s `addTypedGuest`/`addBotOpponent` enforce the single
 * opponent-slot rule that makes this true — and a bot, when present, always
 * wins, matching that same single-slot invariant.
 *
 * Neither given returns `undefined` — the field's own "omit me" value — so a
 * solo session sends exactly the request it always did. The owning player is
 * always seat 0 on side `A`; the opponent takes `B`. `displayName` is carried
 * for a guest only, `level` for a bot only — the player's name is copied
 * server-side from `players.display_name`.
 */
export function participantsFromGuests(
  guests: readonly { displayName: string }[],
  bot?: { level: number } | null,
):
  | {
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName?: string;
      level?: number;
      sideKey: string;
    }[]
  | undefined {
  if (guests.length === 0 && !bot) return undefined;
  if (bot) {
    return [
      { participantTypeKey: "PLAYER" as const, sideKey: "A" },
      {
        participantTypeKey: "DARTBOT" as const,
        level: bot.level,
        sideKey: "B",
      },
    ];
  }
  return [
    { participantTypeKey: "PLAYER" as const, sideKey: "A" },
    ...guests.map((guest, index) => ({
      participantTypeKey: "GUEST" as const,
      displayName: guest.displayName,
      sideKey: String.fromCharCode(66 + index),
    })),
  ];
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
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[],
): Seated<TConfig> {
  return {
    ...configSnapshot,
    seats: toSeatFacts(participants),
  } as Seated<TConfig>;
}
