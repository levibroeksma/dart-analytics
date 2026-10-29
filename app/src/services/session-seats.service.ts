import type { SeatFact } from "@lib/types";
import type { ParticipantInputData } from "@routes/types";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
import type { SeatPlan } from "./types";

const MIN_SEATS = 1;
const MAX_SEATS = 4;
const PLAYER_PARTICIPANT_TYPE_ID = 1;
const DARTBOT_PARTICIPANT_TYPE_ID = 3;

/**
 * The most seats a session may request, keyed by ruleset version. A ruleset
 * with no entry defaults to 1 — the same "reject any 2nd seat" behavior
 * every non-501 ruleset had before this map existed. 501 alone keeps room
 * for a future 2v2 (D-something, X01 guest-player design); the other ten
 * are wired for exactly one opponent (1v1) and never more, per
 * `2026-08-22-single-opponent-seat-remaining-engines-design.md`.
 */
const SEAT_CAPS: Record<string, number> = {
  "501_V1": 4,
  "501_V2": 4,
  BOBS27_V1: 2,
  BOBS27_V2: 2,
  TACTICS_V2: 2,
  CRICKET_V2: 2,
  "121_V1": 2,
  AROUND_THE_CLOCK_V1: 2,
  AROUND_THE_CLOCK_V2: 2,
  AROUND_THE_CLOCK_V3: 2,
  TUOD_V1: 2,
  SHANGHAI_V1: 2,
  SHANGHAI_V2: 2,
  SHANGHAI_V3: 2,
  BASEBALL_V1: 2,
  KILLER_V1: 2,
  SCORE_TRAINING_V1: 2,
  SINGLES_V1: 2,
  SINGLES_V3: 2,
  DOUBLES_TRAINING_V1: 2,
};

/**
 * The fewest seats a session may request, keyed by ruleset version. A ruleset
 * with no entry defaults to 1. An omitted seat list counts as one seat.
 */
const SEAT_FLOORS: Record<string, number> = { KILLER_V1: 2 };

function floorMessage(rulesetVersionKey: string, floor: number): string {
  return `${rulesetVersionKey} needs at least ${floor} seats.`;
}

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
 * session persisting a participant nothing can throw for. A ruleset's floor
 * in `SEAT_FLOORS` refuses a list, or an omitted list, with too few seats.
 */
export function rejectSeatRequest(
  participants: ParticipantInputData[] | undefined,
  rulesetVersionKey: string,
): string | null {
  const floor = SEAT_FLOORS[rulesetVersionKey] ?? MIN_SEATS;
  if (participants === undefined) {
    return floor > MIN_SEATS ? floorMessage(rulesetVersionKey, floor) : null;
  }

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

  if (participants.length < floor) {
    return floorMessage(rulesetVersionKey, floor);
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
    if (seat.participantTypeId === DARTBOT_PARTICIPANT_TYPE_ID) {
      if (!seat.dartbot) {
        throw new Error("DARTBOT seat is missing its dartbot payload");
      }
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
