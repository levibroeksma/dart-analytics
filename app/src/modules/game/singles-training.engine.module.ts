import type { DartRing, SinglesTarget, SinglesTrainingState } from "./types";

function targetForIndex(targetIndex: number): SinglesTarget {
  return targetIndex < 20
    ? { kind: "NUMBER", number: targetIndex + 1 }
    : { kind: "BULL" };
}

function pointsFor(target: SinglesTarget, ring: DartRing): number {
  if (ring === "MISS") return 0;
  if (target.kind === "NUMBER") {
    return ring === "SINGLE" ? 1 : ring === "DOUBLE" ? 2 : 3;
  }
  return ring === "SINGLE" ? 1 : ring === "DOUBLE" ? 2 : 0;
}

export function initialSinglesTrainingState(
  startingPoints: number,
): SinglesTrainingState {
  return {
    targetIndex: 0,
    totalPoints: startingPoints,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

export function applyDart(
  state: SinglesTrainingState,
  ring: DartRing,
): SinglesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetForIndex(state.targetIndex);
  const totalPoints = state.totalPoints + pointsFor(target, ring);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }

  if (target.kind === "BULL") {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
}
