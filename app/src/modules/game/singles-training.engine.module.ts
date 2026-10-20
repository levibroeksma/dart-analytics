import type {
  Seated,
  SeatFact,
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";
import { numbersPath, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { eliminationWinner, scoreCompareOutcome } from "./match-outcome.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  anyRingEitherBull,
  closeAfter,
  outBelowHits,
  pathTarget,
  pointsTable,
} from "./track-policies";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  PointsTable,
  SinglesTrainingSeatState,
  SinglesTrainingState,
  TrackSeat,
} from "./types";
import { endedRefusal } from "./turn-log.module";

type SinglesEngineConfig =
  | Seated<SinglesSnapshot>
  | Seated<SinglesV2Snapshot>
  | Seated<SinglesV3Snapshot>;

function initialSeatState(seat: SeatFact): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalPoints: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Singles Training starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialSinglesTrainingState(
  config: SinglesEngineConfig,
): SinglesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

function requiredHitsFor(
  difficulty: SinglesEngineConfig["difficulty"],
): number {
  if (difficulty === "HARD") return 1;
  if (difficulty === "EXTREME") return 2;
  return 0;
}

/** `scoringMode` is absent on every V1/V2 config; reads as `"STANDARD"` —
 * the ring-quality point ladder both those versions have always used. */
function scoringModeOf(config: SinglesEngineConfig): "STANDARD" | "ACCURACY" {
  return "scoringMode" in config ? config.scoringMode : "STANDARD";
}

/**
 * The seat's active target: `config.targetOrder`'s entry at `targetIndex`.
 * The one place Singles Training answers "what am I aiming at" — the
 * reducer and every external reader (the derived-aims fold) go through it.
 */
export function activeTargetOf(
  state: SinglesTrainingSeatState,
  config: SinglesEngineConfig,
): BoardTarget {
  return targetAt(numbersPath(config.targetOrder), state.targetIndex);
}

const MATCH_ENDED = endedRefusal("match has ended");
const SESSION_DONE = endedRefusal("session is complete");

/** Accuracy scoring: 1 for the outer single on a NUMBER target or either bull, 0 for every other ring. */
const ACCURACY_POINTS: PointsTable = {
  number: { OUTER_SINGLE: 1 },
  bull: { OUTER_BULL: 1, INNER_BULL: 1 },
};

/** Standard scoring: the configured single/double/treble values; outer bull as a single, inner as a double. */
function standardPoints(config: SinglesEngineConfig): PointsTable {
  const { pointsSingle: s, pointsDouble: d, pointsTreble: t } = config;
  return {
    number: {
      SINGLE: s,
      INNER_SINGLE: s,
      OUTER_SINGLE: s,
      DOUBLE: d,
      TREBLE: t,
    },
    bull: { OUTER_BULL: s, INNER_BULL: d },
  };
}

const TO_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "DONE",
  LOST: "OUT",
} as const;
const FROM_TRACK = {
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "COMPLETE",
  OUT: "LOST",
} as const;

/**
 * Singles Training as Track policies: the configured 21-target path, any
 * ring or either bull is a hit, points from the STANDARD or ACCURACY table,
 * three-dart visits; a visit below the difficulty's mandatory hits is out,
 * before clearing BULL is checked.
 */
function singlesRules(config: SinglesEngineConfig): TrackRules<null> {
  const path = numbersPath(config.targetOrder);
  const judge = outBelowHits<null>(requiredHitsFor(config.difficulty));
  const advance = advanceToEnd<null>(path.length - 1);
  return {
    doneMessage: SESSION_DONE,
    target: pathTarget(path),
    hit: anyRingEitherBull,
    points: pointsTable(
      scoringModeOf(config) === "ACCURACY"
        ? ACCURACY_POINTS
        : standardPoints(config),
    ),
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = judge(seat);
      return judged.status === "OUT" ? judged : advance(judged);
    },
  };
}

/** Lifts a Singles seat into the kernel's shape: `totalPoints` is the score, no extras. */
function toTrackSeat(state: SinglesTrainingSeatState): TrackSeat<null> {
  const { totalPoints, status, ...progress } = state;
  return {
    ...progress,
    score: totalPoints,
    status: TO_TRACK[status],
    ext: null,
  };
}

/** Projects a kernel seat back to Singles Training's seat state. */
function toSinglesSeat(seat: TrackSeat<null>): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    totalPoints: seat.score,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    status: FROM_TRACK[seat.status],
  };
}

/**
 * Pure reducer, via the Track kernel: folds one dart observation onto one seat's
 * `SinglesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applySinglesTrainingDart(
  config: SinglesEngineConfig,
  state: SinglesTrainingSeatState,
  observation: DartObservation,
): SinglesTrainingSeatState {
  return toSinglesSeat(
    applyTrackDart(toTrackSeat(state), observation, singlesRules(config)),
  );
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Under EASY, score-compare (highest
 * training-point total) decides the match exactly as before. Under
 * HARD/EXTREME, the instant any seat fails its mandatory-hit requirement
 * (`status: "LOST"`), the match ends immediately via `eliminationWinner` —
 * the same Bob's-27 pattern — regardless of any other seat's own progress.
 */
export function foldSinglesTrainingState(
  facts: EngineFacts,
  config: SinglesEngineConfig,
): SinglesTrainingState {
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => null,
    singlesRules(config),
  ).map(toSinglesSeat);

  const failedSeats = seats.filter((seat) => seat.status === "LOST");
  const outcome: {
    status: SinglesTrainingState["status"];
    winningSideKey: string | null;
  } =
    seats.length === 1
      ? { status: seats[0].status, winningSideKey: null }
      : failedSeats.length > 0
        ? {
            status: "COMPLETE",
            winningSideKey: eliminationWinner(
              seats.map((seat) => ({
                sideKey: seat.sideKey,
                failed: seat.status === "LOST",
              })),
            ),
          }
        : scoreCompareOutcome(
            seats.map((seat) => ({
              sideKey: seat.sideKey,
              completed: seat.status === "COMPLETE",
              metric: seat.totalPoints,
            })),
            "HIGHEST",
            "IN_PROGRESS",
          );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    seats,
  };
}

/**
 * Both intention columns are always null — Singles treats single, double
 * and treble on the current segment as equally valid, so no ring is "the"
 * intended one, and a target number with a null zone is rejected by
 * `chk_dart_target_consistency` (migration `0007`). The intended target is
 * recoverable from the visit index. Do not restore either field.
 */
const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Singles Training's rules for the dart engine shell, serving V1–V3: 21
 * targets, three darts each, scored per ring. Refused at the match level
 * first — HARD/EXTREME elimination can end the match while another seat is
 * still `IN_PROGRESS` — then at the seat level.
 */
const singlesSpec: DartGameSpec<SinglesEngineConfig, SinglesTrainingState> = {
  rulesetVersionKey: "SINGLES_V1",
  rulesetVersionKeys: ["SINGLES_V2", "SINGLES_V3"],
  stageOwnership: "PER_SEAT",
  fold: foldSinglesTrainingState,
  refusal: (state) => {
    if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
    return activeSeatState(state).status === "IN_PROGRESS"
      ? null
      : SESSION_DONE;
  },
  intent: () => NO_INTENT,
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: (state, observation, config) => {
    if (state.status !== "IN_PROGRESS") return false;
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS" || seat.dartsThisVisit < 2) return false;
    const after = applySinglesTrainingDart(config, seat, observation);
    if (after.status !== "COMPLETE") return after.status === "LOST";
    return otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    );
  },
};

/**
 * Singles Training engine (Pattern 18), built by the dart engine shell; one
 * class for V1–V3, the key passed per factory. EASY decides by
 * score-compare; HARD/EXTREME can end the match by elimination.
 */
export class SinglesTrainingEngine extends dartGameEngineClass(singlesSpec) {}

export const singlesTrainingEngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
);

registerEngineFactory(singlesTrainingEngineFactory);

export const singlesTrainingV2EngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
  "SINGLES_V2",
);

registerEngineFactory(singlesTrainingV2EngineFactory);

export const singlesTrainingV3EngineFactory = dartGameEngineFactory(
  singlesSpec,
  SinglesTrainingEngine,
  "SINGLES_V3",
);

registerEngineFactory(singlesTrainingV3EngineFactory);
