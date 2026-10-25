import type {
  Seated,
  SeatFact,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
  ShanghaiV3Snapshot,
} from "@lib/types";
import { numbersPath, targetAt } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceToEnd,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  halveOnBlank,
  pathTarget,
  recordVisitZone,
  shanghaiWin,
} from "./track-policies";
import { raceWinner, scoreCompareWinner } from "./match-outcome.module";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  ShanghaiSeatState,
  ShanghaiState,
  ShanghaiTrackExt,
  TrackSeat,
  TurnFact,
} from "./types";
import { endedRefusal } from "./turn-log.module";

export { zoneBucketOf } from "./track-policies";

const PATH = numbersPath();

type ShanghaiEngineConfig =
  | Seated<ShanghaiSnapshot>
  | Seated<ShanghaiV2Snapshot>
  | Seated<ShanghaiV3Snapshot>;

type ShanghaiDifficulty = ShanghaiV2Snapshot["difficulty"];

type ShanghaiSettings = {
  difficulty: ShanghaiDifficulty;
  rangeStart: number;
  rangeEnd: number;
  instantWin: boolean;
};

/**
 * Reads the settings off any ruleset version's config. A key a version's
 * schema lacks falls back to the full board with instant win and Normal
 * difficulty, so a V1 or V2 engine folds exactly as it always did.
 */
function settingsOf(config: ShanghaiEngineConfig): ShanghaiSettings {
  return {
    difficulty: "difficulty" in config ? config.difficulty : "NORMAL",
    rangeStart: "rangeStart" in config ? config.rangeStart : 1,
    rangeEnd: "rangeEnd" in config ? config.rangeEnd : 20,
    instantWin: "instantWin" in config ? config.instantWin : true,
  };
}

function initialSeatState(
  seat: SeatFact,
  settings: ShanghaiSettings,
): ShanghaiSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalScore: 0,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
    rangeStart: settings.rangeStart,
    rangeEnd: settings.rangeEnd,
    instantWin: settings.instantWin,
  };
}

/** Shanghai starting state: every configured seat at round 1, zero score, no darts thrown. */
export function initialShanghaiState(
  config: ShanghaiEngineConfig,
): ShanghaiState {
  const settings = settingsOf(config);
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map((seat) => initialSeatState(seat, settings)),
  };
}

/** The number a seat is throwing at: its range start plus its round index. */
export function activeNumberOf(seat: ShanghaiSeatState): number {
  return seat.rangeStart + seat.targetIndex;
}

/** The seat's 1-based round within its range. */
export function roundOf(seat: ShanghaiSeatState): number {
  return seat.targetIndex + 1;
}

/** How many rounds the seat's range holds. */
export function roundCountOf(seat: ShanghaiSeatState): number {
  return seat.rangeEnd - seat.rangeStart + 1;
}

/** The seat's active target: its active number on the 1..20 path, never BULL. */
export function activeTargetOf(seat: ShanghaiSeatState): BoardTarget {
  return targetAt(PATH, activeNumberOf(seat) - 1);
}

const SESSION_ENDED = endedRefusal("session has ended");

const MATCH_ENDED = endedRefusal("match has ended");

/**
 * Shanghai as Track policies over the settings' round range: any ring on the
 * round's number scores its board value, three-dart visits. On close a Hard
 * blank visit halves the score, a single/double/treble finishes the seat as a
 * Shanghai when instant win is on, otherwise the seat advances, finishing
 * after the range's last round.
 */
function shanghaiRules(
  settings: ShanghaiSettings,
): TrackRules<ShanghaiTrackExt> {
  const path = PATH.slice(settings.rangeStart - 1, settings.rangeEnd);
  const advance = advanceToEnd<ShanghaiTrackExt>(path.length - 1);
  const halve: (
    seat: TrackSeat<ShanghaiTrackExt>,
  ) => TrackSeat<ShanghaiTrackExt> =
    settings.difficulty === "HARD" ? halveOnBlank : (seat) => seat;
  const judge: (
    seat: TrackSeat<ShanghaiTrackExt>,
  ) => TrackSeat<ShanghaiTrackExt> = settings.instantWin
    ? shanghaiWin
    : (seat) => seat;
  return {
    doneMessage: SESSION_ENDED,
    target: pathTarget(path),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: recordVisitZone,
    visitOpen: closeAfter(3),
    onVisitClose: (seat) => {
      const judged = judge(halve(seat));
      const moved = judged.status === "IN_PROGRESS" ? advance(judged) : judged;
      return { ...moved, ext: { ...moved.ext, zones: [] } };
    },
  };
}

/** Lifts a Shanghai seat into the kernel's shape: `totalScore` as the score, the zone list and Shanghai flag as the extra. */
function toTrackSeat(state: ShanghaiSeatState): TrackSeat<ShanghaiTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: state.totalScore,
    dartsThisVisit: state.dartsThisVisit.length,
    hitsThisVisit: state.dartsThisVisit.filter((zone) => zone !== null).length,
    status: state.status === "IN_PROGRESS" ? "IN_PROGRESS" : "DONE",
    ext: {
      zones: state.dartsThisVisit,
      shanghai: state.status === "SHANGHAI",
      rangeStart: state.rangeStart,
      rangeEnd: state.rangeEnd,
      instantWin: state.instantWin,
    },
  };
}

/** Projects a kernel seat back to Shanghai's seat state; a `DONE` seat is `SHANGHAI` or `COMPLETE` by its flag. */
function toShanghaiSeat(seat: TrackSeat<ShanghaiTrackExt>): ShanghaiSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    totalScore: seat.score,
    dartsThisVisit: seat.ext.zones,
    status: seatStatus(seat),
    rangeStart: seat.ext.rangeStart,
    rangeEnd: seat.ext.rangeEnd,
    instantWin: seat.ext.instantWin,
  };
}

/** A kernel seat's Shanghai status: the Shanghai flag first, then done or not. */
function seatStatus(
  seat: TrackSeat<ShanghaiTrackExt>,
): ShanghaiSeatState["status"] {
  if (seat.ext.shanghai) return "SHANGHAI";
  return seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE";
}

/**
 * Pure reducer, via the Track kernel: folds one dart observation onto one
 * seat's `ShanghaiSeatState`. `difficulty` defaults to `"NORMAL"`. Under
 * `"HARD"`, a visit with zero target hits halves `totalScore` (round half
 * up); a visit with a hit is never penalized. A single/double/treble visit
 * is a Shanghai; otherwise the range's last round closing completes the seat.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
  difficulty: ShanghaiDifficulty = "NORMAL",
): ShanghaiSeatState {
  return toShanghaiSeat(
    applyTrackDart(
      toTrackSeat(state),
      observation,
      shanghaiRules({
        difficulty,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd,
        instantWin: state.instantWin,
      }),
    ),
  );
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Composes `raceWinner` and `scoreCompareWinner`:
 * a Shanghai short-circuits the whole match the instant either seat hits
 * one, whatever the other seat's own round is — this is score-compare's own
 * race-shaped exception. Absent that, the match resolves only once both
 * seats reach `COMPLETE` (the whole range, no Shanghai), by total score.
 */
export function foldShanghaiState(
  facts: EngineFacts,
  config: ShanghaiEngineConfig,
): ShanghaiState {
  const settings = settingsOf(config);
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({
      zones: [],
      shanghai: false,
      rangeStart: settings.rangeStart,
      rangeEnd: settings.rangeEnd,
      instantWin: settings.instantWin,
    }),
    shanghaiRules(settings),
  ).map(toShanghaiSeat);

  const raceResult =
    seats.length === 1
      ? null
      : raceWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            finished: seat.status === "SHANGHAI",
          })),
        );
  const allTerminal = seats.every((seat) => seat.status !== "IN_PROGRESS");
  const compareResult =
    seats.length > 1 && allTerminal && raceResult === null
      ? scoreCompareWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            completed: true,
            metric: seat.totalScore,
          })),
          "HIGHEST",
        )
      : null;

  const status: ShanghaiState["status"] =
    seats.length === 1
      ? seats[0].status
      : raceResult !== null
        ? "SHANGHAI"
        : !allTerminal
          ? "IN_PROGRESS"
          : compareResult !== null
            ? "COMPLETE"
            : "TIE";

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status,
    winningSideKey: raceResult ?? compareResult,
    seats,
  };
}

const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/** The match-ended message first — a Shanghai ends the match while another seat still reads `IN_PROGRESS` — then the seat's own. */
function shanghaiRefusal(state: ShanghaiState): string | null {
  if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
  return activeSeatState(state).status === "IN_PROGRESS" ? null : SESSION_ENDED;
}

/**
 * Whether `observation` would end the WHOLE match: it completes a Shanghai,
 * or closes the active seat's last round while every other seat has ended.
 * False once the match has already ended.
 */
function wouldCompleteMatch(
  state: ShanghaiState,
  observation: DartObservation,
): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const seat = activeSeatState(state);
  if (seat.status !== "IN_PROGRESS" || seat.dartsThisVisit.length < 2)
    return false;
  const after = applyShanghaiDart(seat, observation);
  if (after.status === "SHANGHAI") return true;
  return (
    after.status === "COMPLETE" &&
    otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status !== "IN_PROGRESS",
    )
  );
}

/** A seat's running score in `state`; 0 for a participant not seated. */
function scoreOf(state: ShanghaiState, participantRef: string): number {
  return (
    state.seats.find((seat) => seat.participantRef === participantRef)
      ?.totalScore ?? 0
  );
}

/** Three-dart visits: a turn takes darts until it holds three. */
function isShanghaiVisitOpen(turn: TurnFact): boolean {
  return turn.darts.length < 3;
}

/**
 * Shanghai's rules for the dart engine shell, V1 and V2. A closed visit
 * persists its counted total — the change it made to the seat's score — so
 * a Hard halving is a negative visit total and a seat's turn totals sum to
 * its score.
 */
const shanghaiSpec: DartGameSpec<ShanghaiEngineConfig, ShanghaiState> = {
  rulesetVersionKey: "SHANGHAI_V1",
  rulesetVersionKeys: ["SHANGHAI_V2"],
  stageOwnership: "PER_SEAT",
  fold: foldShanghaiState,
  refusal: shanghaiRefusal,
  intent: () => NO_INTENT,
  isVisitOpen: isShanghaiVisitOpen,
  wouldComplete: wouldCompleteMatch,
  closedVisitTotal: (opened, closed, participantRef) =>
    scoreOf(closed, participantRef) - scoreOf(opened, participantRef),
};

/**
 * Shanghai (Pattern 18), built by the dart engine shell: one round per number
 * of the configured range (1..20 by default), three darts each at that
 * round's own number, per seat. A single/double/treble
 * Shanghai on any seat's visit ends the whole match immediately —
 * score-compare's own race-shaped exception. Otherwise every seat plays the
 * whole range, then the higher total score wins.
 */
export class ShanghaiEngine extends dartGameEngineClass(shanghaiSpec) {}

function factoryFor(key: "SHANGHAI_V1" | "SHANGHAI_V2") {
  return dartGameEngineFactory(shanghaiSpec, ShanghaiEngine, key);
}

export const shanghaiEngineFactory = factoryFor("SHANGHAI_V1");

export const shanghaiV2EngineFactory = factoryFor("SHANGHAI_V2");

registerEngineFactory(shanghaiEngineFactory);
registerEngineFactory(shanghaiV2EngineFactory);
