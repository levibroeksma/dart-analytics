import type {
  AroundTheClockEngineConfig,
  RulesetVersionKey,
  SeatFact,
} from "@lib/types";
import { clockPath, numbersPath, targetAt } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, otherSeatsComplete } from "./seat-state.module";
import { applyTrackDart, foldTrackSeats } from "./track-kernel.module";
import {
  advanceOnHit,
  anyRingEitherBull,
  closeAfterOrPastEnd,
  doneOnWrap,
  lapOnWrap,
  loseLifeOnBlank,
  noPoints,
  noteVisitHit,
  outerSingleOnly,
  pathTarget,
  stepBackBelowHits,
} from "./track-policies";
import { dartsThrownBy, endedRefusal } from "./turn-log.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { DartGameSpec, TrackRules } from "./interfaces";
import type {
  AroundTheClockRules,
  AroundTheClockSeatState,
  AroundTheClockState,
  AroundTheClockLivesExt,
  BoardTarget,
  DartIntent,
  DartObservation,
  EngineFacts,
  TrackSeat,
  TurnFact,
} from "./types";

const HITS_REQUIRED = { EASY: 0, INTERMEDIATE: 1, HARD: 2, PRO: 3 } as const;

const V1_RULES: AroundTheClockRules = {
  path: numbersPath(),
  segmentRule: "ANY",
  hitsRequired: 0,
  timed: false,
};

/**
 * Resolves a snapshot to its rules. Presence check: a snapshot without
 * `pathDirection` is V1 (mirrors Singles' `scoringModeOf`), so V1 folds
 * exactly as before.
 */
export function rulesOf(
  config: AroundTheClockEngineConfig,
): AroundTheClockRules {
  if (!("pathDirection" in config)) return V1_RULES;
  const rules: AroundTheClockRules = {
    path: numbersPath(clockPath(config.pathDirection, config.oddsFirst)),
    segmentRule: config.segmentRule,
    hitsRequired: HITS_REQUIRED[config.difficulty],
    timed: config.durationType === "MINUTES",
  };
  return "lives" in config ? { ...rules, lives: config.lives } : rules;
}

/** The target at `targetIndex` of an already-resolved rule set's path. */
function targetOnPath(
  rules: AroundTheClockRules,
  targetIndex: number,
): BoardTarget {
  return targetAt(rules.path, targetIndex);
}

/**
 * The seat's active target: `targetIndex` of the path `rulesOf(config)`
 * resolves — V1's fixed 1..20 path, or V2's direction/odds-first order, both
 * ending in BULL. The reducer already carries its own resolved `rules`
 * rather than the raw `config` (resolved once per fold, not per dart), so it
 * reads the target through the same `targetOnPath` this delegates to, one
 * source of truth for the path-index lookup.
 */
export function activeTargetOf(
  state: AroundTheClockSeatState,
  config: AroundTheClockEngineConfig,
): BoardTarget {
  return targetOnPath(rulesOf(config), state.targetIndex);
}

function initialSeatState(
  seat: SeatFact,
  lives?: number,
): AroundTheClockSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    laps: 0,
    ...(lives === undefined ? {} : { lives, visitHit: false }),
    status: "IN_PROGRESS",
  };
}

/** Around the Clock starting state: every configured seat aimed at its path's first target, no darts thrown. */
export function initialAroundTheClockState(
  config: AroundTheClockEngineConfig,
): AroundTheClockState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) =>
      initialSeatState(seat, rulesOf(config).lives),
    ),
  };
}

/** Any ring on a NUMBER target's number, either bull on BULL (`anyRingEitherBull`). */
export function isAroundTheClockHit(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  return anyRingEitherBull(target, observation);
}

/** The hit policy `rules.segmentRule` selects: any ring, or the outer single only; either bull on BULL. */
function hitPolicy(
  rules: AroundTheClockRules,
): (target: BoardTarget, observation: DartObservation) => boolean {
  return rules.segmentRule === "ANY" ? anyRingEitherBull : outerSingleOnly;
}

/** Whether `observation` hits `target` under `rules.segmentRule`. */
export function isClockHit(
  rules: AroundTheClockRules,
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  return hitPolicy(rules)(target, observation);
}

const SESSION_ENDED = endedRefusal("session has ended");

/**
 * Around the Clock as Track policies: the resolved path, the segment rule's
 * hit test, no points, three-dart visits that also close when the seat moves
 * past BULL. Easy advances on each hit mid-visit; a 1/2/3-dart difficulty
 * judges the visit on close and steps back below the bar. Past BULL a timed
 * seat laps and an untimed one is done. With lives, a visit that never hit
 * costs a life and the last life lost puts the seat out.
 */
function clockRules(
  rules: AroundTheClockRules,
): TrackRules<AroundTheClockLivesExt> {
  const lastIndex = rules.path.length - 1;
  const wrap = rules.timed
    ? lapOnWrap<AroundTheClockLivesExt>(lastIndex)
    : doneOnWrap<AroundTheClockLivesExt>(lastIndex);
  const judge = stepBackBelowHits<AroundTheClockLivesExt>(rules.hitsRequired);
  const easy = rules.hitsRequired === 0;
  return {
    doneMessage: SESSION_ENDED,
    target: pathTarget(rules.path),
    hit: hitPolicy(rules),
    points: noPoints,
    onDart: easy
      ? (seat, dart) => advanceOnHit(noteVisitHit(seat, dart), dart)
      : noteVisitHit,
    visitOpen: closeAfterOrPastEnd(3, lastIndex),
    onVisitClose: easy
      ? (seat) => wrap(loseLifeOnBlank(seat))
      : (seat) => wrap(judge(loseLifeOnBlank(seat))),
  };
}

const TRACK_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "DONE",
  OUT: "OUT",
} as const;

const CLOCK_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "COMPLETE",
  OUT: "OUT",
} as const;

/** Lifts a clock seat into the kernel's shape: no score, `laps` and the lives rule as the extra. */
function toTrackSeat(
  state: AroundTheClockSeatState,
): TrackSeat<AroundTheClockLivesExt> {
  const { laps, lives, visitHit, status, ...progress } = state;
  return {
    ...progress,
    score: 0,
    status: TRACK_STATUS[status],
    ext: { laps, lives: lives ?? null, visitHit: visitHit ?? false },
  };
}

/** Projects a kernel seat back to the clock's seat state; `lives` rides along only under the lives rule. */
function toClockSeat(
  seat: TrackSeat<AroundTheClockLivesExt>,
): AroundTheClockSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    dartsThisVisit: seat.dartsThisVisit,
    hitsThisVisit: seat.hitsThisVisit,
    laps: seat.ext.laps,
    ...(seat.ext.lives === null
      ? {}
      : { lives: seat.ext.lives, visitHit: seat.ext.visitHit }),
    status: CLOCK_STATUS[seat.status],
  };
}

/**
 * Pure reducer, via the Track kernel: folds one dart observation onto one seat's
 * `AroundTheClockSeatState` under `rules` (V1's when omitted). Easy: a hit
 * advances the target immediately, mid-visit. 1/2/3-dart difficulty: the
 * visit is judged when it closes on its 3rd dart — enough hits move up one,
 * too few step back one, never below the path's first target. At the path's
 * end (BULL) an untimed seat completes; a timed seat adds a lap and restarts
 * at the first target, and that dart closes the visit. `dartsThisVisit`
 * reads 0 after a dart exactly when that dart closed the visit.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockSeatState,
  observation: DartObservation,
  rules: AroundTheClockRules = V1_RULES,
): AroundTheClockSeatState {
  return toClockSeat(
    applyTrackDart(toTrackSeat(state), observation, clockRules(rules)),
  );
}

/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`.
 *
 * Score-compare, fewest darts wins: both seats always play out their own
 * full circuit — a completed seat is skipped by `activeSeat`'s completion
 * predicate, handing every remaining turn to the other, so a miss's extra
 * visit never steals a turn from a seat that has already finished. The
 * match resolves only once both seats are `COMPLETE`.
 *
 * Timed (V2 MINUTES): no seat completes on darts — the bull restarts the lap.
 * Once `timerExpired`, a seat is `COMPLETE` when it has at least one closed
 * visit and no open one, so the visit in hand when time runs out still
 * finishes.
 */
export function foldAroundTheClockState(
  facts: EngineFacts,
  config: AroundTheClockEngineConfig,
  timerExpired = false,
): AroundTheClockState {
  const rules = rulesOf(config);
  const folded = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ laps: 0, lives: rules.lives ?? null, visitHit: false }),
    clockRules(rules),
  ).map(toClockSeat);
  const seats =
    rules.timed && timerExpired
      ? folded.map((seat) =>
          timedSeatDone(seat.participantRef, facts.turns)
            ? { ...seat, status: "COMPLETE" as const }
            : seat,
        )
      : folded;

  const outcome = scoreCompareOutcome(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      completed: seat.status === "COMPLETE",
      metric: dartsThrownBy(seat.participantRef, facts.turns),
    })),
    "LOWEST",
    seats[0].status === "OUT" ? "COMPLETE" : seats[0].status,
  );

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) =>
        seats.find((seat) => seat.participantRef === candidate.participantRef)
          ?.status !== "IN_PROGRESS",
    ).participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    timerExpired,
    seats,
  };
}

/** A timed seat is done after expiry once it has a closed visit and no open one. */
function timedSeatDone(
  participantRef: string,
  turns: readonly TurnFact[],
): boolean {
  const own = turns.filter((turn) => turn.participantRef === participantRef);
  return (
    own.some((turn) => turn.completedAt !== null) &&
    own.every((turn) => turn.completedAt !== null)
  );
}

const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * Open while the turn is unstamped, short of three darts, the active seat's,
 * and that seat's folded visit still counts darts — a bull completion or a
 * timed lap restart closes it short (1 or 2 darts), and a closed visit is
 * never reused, by the other seat or the same one.
 */
function isClockVisitOpen(turn: TurnFact, state: AroundTheClockState): boolean {
  if (turn.completedAt !== null || turn.darts.length >= 3) return false;
  if (turn.participantRef !== state.activeParticipantRef) return false;
  return activeSeatState(state).dartsThisVisit > 0;
}

/**
 * Whether `observation` would complete the WHOLE session, not merely the
 * active seat's circuit: solo, those are the same; 1v1, every other seat
 * must already be finished. A timed seat completes only on the dart that
 * closes its visit after expiry.
 */
function wouldCompleteSession(
  state: AroundTheClockState,
  observation: DartObservation,
  config: AroundTheClockEngineConfig,
): boolean {
  const seat = activeSeatState(state);
  if (seat.status !== "IN_PROGRESS") return false;
  const rules = rulesOf(config);
  const after = applyAroundTheClockDart(seat, observation, rules);
  const seatDone = rules.timed
    ? state.timerExpired && after.dartsThisVisit === 0
    : after.status !== "IN_PROGRESS";
  return (
    seatDone &&
    otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    )
  );
}

/** Around the Clock's rules for the dart engine shell, V1 to V3; refused once the active seat has finished its own circuit. */
const clockSpec: DartGameSpec<AroundTheClockEngineConfig, AroundTheClockState> =
  {
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    rulesetVersionKeys: ["AROUND_THE_CLOCK_V2", "AROUND_THE_CLOCK_V3"],
    stageOwnership: "PER_SEAT",
    fold: foldAroundTheClockState,
    refusal: (state) =>
      activeSeatState(state).status === "IN_PROGRESS" ? null : SESSION_ENDED,
    intent: () => NO_INTENT,
    isVisitOpen: isClockVisitOpen,
    wouldComplete: wouldCompleteSession,
  };

/** The ruleset key a snapshot's shape names: a `pathDirection` field is V2, a `lives` field V3. */
export function rulesetKeyOf(
  config: AroundTheClockEngineConfig,
): RulesetVersionKey {
  if ("lives" in config) return "AROUND_THE_CLOCK_V3";
  return "pathDirection" in config
    ? "AROUND_THE_CLOCK_V2"
    : "AROUND_THE_CLOCK_V1";
}

/**
 * Around the Clock (Pattern 18), built by the dart engine shell: a 21-target
 * path (V1: 1..20, then BULL; V2: direction and odds-first order, BULL last;
 * V3: V2 on Easy with three lives) walked per seat under the snapshot's rules. Score-compare: both seats
 * always play their whole circuit, then whichever finished in fewer darts
 * wins. A timed V2 run ends only through `expireTimer()`. The key is read
 * off the snapshot's shape, whatever key a factory passes.
 */
export class AroundTheClockEngine extends dartGameEngineClass(clockSpec) {
  constructor(config: AroundTheClockEngineConfig, prior?: EngineFacts) {
    super(config, prior, rulesetKeyOf(config));
  }
}

export const aroundTheClockEngineFactory = dartGameEngineFactory(
  clockSpec,
  AroundTheClockEngine,
);

export const aroundTheClockV2EngineFactory = dartGameEngineFactory(
  clockSpec,
  AroundTheClockEngine,
  "AROUND_THE_CLOCK_V2",
);

export const aroundTheClockV3EngineFactory = dartGameEngineFactory(
  clockSpec,
  AroundTheClockEngine,
  "AROUND_THE_CLOCK_V3",
);

registerEngineFactory(aroundTheClockEngineFactory);
registerEngineFactory(aroundTheClockV2EngineFactory);
registerEngineFactory(aroundTheClockV3EngineFactory);
