import { WON_TARGET } from "@modules/game/prisoner-policy";
import type {
  PrisonerResultRow,
  PrisonerResultsSnapshot,
  PrisonerSeatResult,
} from "@lib/types";
import type { PrisonerSeatState, PrisonerState } from "@modules/types";

/** The banner text of a target, e.g. `Outer 7`; `Done` once 20 is completed. */
export function prisonerTargetText(target: number): string {
  return target >= WON_TARGET ? "Done" : `Outer ${target}`;
}

/** Projects one folded seat to its stored result row. */
export function prisonerSeatResult(
  seat: PrisonerSeatState,
): PrisonerSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.target,
    held: seat.held,
    captured: seat.captured,
    imprisoned: seat.imprisoned,
    out: seat.out,
  };
}

/** Projects the folded final state to the stored results snapshot; `winningSideKey` and `wonBy` are null when no side won. */
export function prisonerResultsSnapshot(
  finalState: PrisonerState,
): PrisonerResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: finalState.winningSideKey,
    wonBy: finalState.wonBy,
    outOrder: [...finalState.outOrder],
    seats: finalState.seats.map(prisonerSeatResult),
  };
}

/** How the game was won; blank when nobody won or there are no results yet. */
export function prisonerWonByLabel(
  snapshot: PrisonerResultsSnapshot | null,
): string {
  if (!snapshot?.winningSideKey) return "";
  if (snapshot.wonBy === "COMPLETED_20") return "Completed 20";
  if (snapshot.wonBy === "LAST_IN") return "Last seat in";
  return "";
}

/** One display row per seat for the results modal; empty before the results exist. */
export function prisonerResultRows(
  snapshot: PrisonerResultsSnapshot | null,
  seats: readonly {
    participantRef: string;
    sideKey: string;
    displayName: string;
  }[],
): PrisonerResultRow[] {
  if (!snapshot) return [];
  return snapshot.seats.map((result) => ({
    name:
      seats.find((s) => s.participantRef === result.participantRef)
        ?.displayName ?? result.participantRef,
    target: prisonerTargetText(result.target),
    held: result.held,
    captured: result.captured,
    imprisoned: result.imprisoned,
    out: result.out,
    winner:
      snapshot.winningSideKey !== null &&
      result.sideKey === snapshot.winningSideKey,
  }));
}
