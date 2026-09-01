import type { SeatFact } from "@lib/types";
import type { ParticipantInputData } from "@routes/types";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
import type { SeatPlan } from "./types";

const MIN_SEATS = 1;
const MAX_SEATS = 4;
const PLAYER_PARTICIPANT_TYPE_ID = 1;

/**
 * The most seats a session may request, keyed by ruleset version. A ruleset
 * with no entry defaults to 1 — the same "reject any 2nd seat" behavior
 * every non-501 ruleset had before this map existed. 501 alone keeps room
 * for a future 2v2 (D-something, X01 guest-player design); the other eight
 * are wired for exactly one opponent (1v1) and never more, per
 * `2026-08-22-single-opponent-seat-remaining-engines-design.md`.
 */
const SEAT_CAPS: Record<string, number> = {
  "501_V1": 4,
  BOBS27_V1: 2,
  "121_V1": 2,
  AROUND_THE_CLOCK_V1: 2,
  TUOD_V1: 2,
  SHANGHAI_V1: 2,
  SCORE_TRAINING_V1: 2,
  SINGLES_V1: 2,
  DOUBLES_TRAINING_V1: 2,
};

/**
 * Why a requested seat list cannot be created, or null when it can. The
 * session is never created on a rejection — participants, snapshot and
 * session share one transaction, so there is no half-built session with
 * orphan participants.
 *
 * Duplicate guest display names are deliberately allowed: two people called
 * Jan is a real Friday night, seats are identified by ref rather than name,
 * and the scoreboard disambiguates visually rather than by refusing valid
 * input.
 *
 * Two seats on one side is the guard that stops 2v2 preparation from
 * silently half-working: `sideKey` and per-side folding exist, the pairing
 * does not. A ruleset's own cap in `SEAT_CAPS` is the guard that stops a
 * session persisting a participant nothing can throw for.
 */
export function rejectSeatRequest(
  participants: ParticipantInputData[] | undefined,
  rulesetVersionKey: string,
): string | null {
  if (participants === undefined) return null;

  if (participants.length < MIN_SEATS || participants.length > MAX_SEATS) {
    return `A session needs between ${MIN_SEATS} and ${MAX_SEATS} seats.`;
  }

  const players = participants.filter(
    (participant) => participant.participantTypeKey === "PLAYER",
  );
  if (players.length !== 1) {
    return "A session needs exactly one PLAYER seat, the session owner.";
  }

  const unnamedGuest = participants.some(
    (participant) =>
      participant.participantTypeKey === "GUEST" &&
      (participant.displayName ?? "").trim().length === 0,
  );
  if (unnamedGuest) {
    return "Every guest needs a name.";
  }

  const unsupportedDartbot = participants.some(
    (participant) =>
      participant.participantTypeKey === "DARTBOT" &&
      !supportsDartbot(rulesetVersionKey as never),
  );
  if (unsupportedDartbot) {
    return `${rulesetVersionKey} does not support a DartBot opponent yet.`;
  }

  const sides = new Set(participants.map((participant) => participant.sideKey));
  if (sides.size !== participants.length) {
    return "Only one seat per side is supported; 2v2 is not implemented yet.";
  }

  const cap = SEAT_CAPS[rulesetVersionKey] ?? 1;
  if (participants.length > cap) {
    return `${rulesetVersionKey} supports at most ${cap} seat${cap === 1 ? "" : "s"}.`;
  }

  return null;
}

/**
 * Projects the seat plan about to be written into the seat list that goes
 * into the configuration snapshot, so replay needs nothing outside the
 * runtime layer. Seat entries stay camelCase inside the otherwise snake_case
 * configuration document: `config-codec.ts`'s key mapper is shallow, so a
 * snake_case seat array would survive `toSnapshot()` unconverted and silently
 * mismatch the client's `SeatFact`.
 */
export function composeSeatFacts(plan: readonly SeatPlan[]): SeatFact[] {
  return plan.map((seat) => {
    if (seat.dartbot) {
      return {
        participantRef: seat.participantId,
        displayName: seat.displayName,
        sideKey: seat.sideKey,
        participantTypeKey: "DARTBOT",
        dartbot: seat.dartbot,
      };
    }
    return {
      participantRef: seat.participantId,
      displayName: seat.displayName,
      sideKey: seat.sideKey,
      participantTypeKey:
        seat.participantTypeId === PLAYER_PARTICIPANT_TYPE_ID
          ? "PLAYER"
          : "GUEST",
    };
  });
}
