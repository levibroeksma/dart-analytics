import type { BoardHit, SeatFact } from "@lib/types";

/**
 * One seat's Score Training progress, folded from the fact log — never
 * accumulated. `turnCount` is how many visits it has closed; `totalScore` is
 * the running total across every one of its turns, including a still-open
 * visit's darts so far (#168) — it does not wait for a visit to close.
 */
export type ScoreTrainingSeatState = SeatState & {
  turnCount: number;
  totalScore: number;
};

/**
 * Score Training session state, derived on every `state()` call. Score
 * -compare, highest total wins: both seats always play out their own full
 * ROUNDS duration budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`). The MINUTES countdown lives in
 * `game.store.ts`, not the engine, so `timerExpired` reports a flag the
 * caller sets through `ScoreTrainingEngine.expireTimer()` — never by writing
 * to this object, which is a copy. That keeps the contract's zero-argument
 * `isComplete()` intact without handing out live state.
 */
export type ScoreTrainingState = MultiSeatState<ScoreTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  timerExpired: boolean;
};

export type ScoreInputBufferOptions = {
  maxLength?: number;
};

/** Minimal click-like shape for activation guard (`detail` from MouseEvent). */
export type ScoreInputActivationEvent = {
  detail?: number;
};

export type Bobs27SeatState = SeatState & {
  targetIndex: number;
  score: number;
  dartsThisVisit: boolean[];
  status: "IN_PROGRESS" | "WON" | "LOST";
};

/** Bob's 27's Track extras: the open visit's per-dart hits, in throw order. */
export type Bobs27TrackExt = { hits: boolean[] };

export type Bobs27State = MultiSeatState<Bobs27SeatState> & {
  status: "IN_PROGRESS" | "WON" | "LOST" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};

/**
 * One seat's marks-to-close progress, indexed by the game's objective order.
 * `closedAtDart[i]` is the seat's dart count when objective i took its third
 * mark, null while open. `objectiveHits[i]` counts every dart that hit
 * objective i, including after it closed; `trebleHits` counts 3-mark hits.
 * `dartsThisVisit` is how many darts the open visit holds, 0 between visits.
 */
export type MarksSeatState = SeatState & {
  marks: readonly number[];
  closedAtDart: readonly (number | null)[];
  objectiveHits: readonly number[];
  trebleHits: number;
  dartsThrown: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/** The objective one dart marks and by how much; null marks nothing. */
export type MarksHit = { objectiveIndex: number; marks: number } | null;

/**
 * What one dart added to a marks seat: the updated bookkeeping fields and the
 * marks beyond the third (`spare`) that a scoring variant may turn into points.
 */
export type MarksTally = {
  fields: Pick<
    MarksSeatState,
    "marks" | "closedAtDart" | "objectiveHits" | "trebleHits" | "dartsThrown"
  >;
  spare: number;
};

/** A marks seat that also carries points scored on spare marks. */
export type MarksDuelSeat = MarksSeatState & { points: number };

/**
 * How a marks game plugs into the two-seat fold: the starting seat, the hit one
 * dart makes given both seats before it, and each objective's point value
 * (null when it never scores).
 */
export type MarksDuelSpec<TSeat extends MarksDuelSeat> = {
  initialSeat: (seat: SeatFact) => TSeat;
  hitOf: (
    seat: TSeat,
    opponent: TSeat,
    observation: DartObservation,
  ) => MarksHit;
  valueOf: (objectiveIndex: number) => number | null;
};

/** The two seats after a duel fold, and the winner once one exists. */
export type MarksDuelFold<TSeat extends MarksDuelSeat> = {
  seats: TSeat[];
  winnerParticipantRef: string | null;
};

/** One seat's Cricket progress, indexed by `CRICKET_OBJECTIVES` order. */
export type CricketSeatState = MarksSeatState & { points: number };

/** A marks game's state after the seat fold: status and, in a duel, the winner. */
export type MarksGameState<TSeat extends MarksDuelSeat> =
  MultiSeatState<TSeat> & {
    status: "IN_PROGRESS" | "COMPLETE";
    winnerParticipantRef: string | null;
  };

/** A Tactics objective: a number 15–20, the bull, or a Doubles / Triples category. */
export type TacticsObjective = number | "DOUBLES" | "TRIPLES";

/** One seat's Tactics progress, indexed by `TACTICS_OBJECTIVES` order. */
export type TacticsSeatState = MarksSeatState & { points: number };

export type CricketState = MultiSeatState<CricketSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE";
  winnerParticipantRef: string | null;
};

export type TacticsState = MultiSeatState<TacticsSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE";
  winnerParticipantRef: string | null;
};

export type SinglesTrainingSeatState = SeatState & {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  hitsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE" | "LOST";
};

export type SinglesTrainingState = MultiSeatState<SinglesTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE" | "LOST";
  winningSideKey: string | null;
};

/**
 * `dartsThisVisit` is the raw zone each of this visit's darts hit on the
 * round's own number, or `null` for a miss/off-target dart — not a
 * pre-computed single/double/treble flag, so a Shanghai is derived from it
 * on the visit's 3rd dart rather than tracked as it happens.
 */
export type ShanghaiSeatState = SeatState & {
  targetIndex: number;
  totalScore: number;
  dartsThisVisit: (DartZoneKey | null)[];
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE";
  rangeStart: number;
  rangeEnd: number;
  instantWin: boolean;
};

export type ShanghaiState = MultiSeatState<ShanghaiSeatState> & {
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};

/** Shanghai's Track extras: the open visit's hit zones (`null` per miss) and whether the seat hit a Shanghai. */
export type ShanghaiTrackExt = {
  zones: (DartZoneKey | null)[];
  shanghai: boolean;
  rangeStart: number;
  rangeEnd: number;
  instantWin: boolean;
};

/**
 * One seat's Baseball Darts progress: `targetIndex` is the inning (0–8),
 * `runs` the total, `runsPerInning` one entry per inning.
 */
export type BaseballSeatState = SeatState & {
  targetIndex: number;
  runs: number;
  runsPerInning: number[];
  dartsThisVisit: number;
  hitsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export type BaseballState = MultiSeatState<BaseballSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};

/** Baseball Darts' Track extras: runs per inning, one round per target. */
export type BaseballTrackExt = RoundTallyExt;

export type DoublesVisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null;
};

/** Doubles Training's Track extras: the visit outcome log. */
export type DoublesTrackExt = { outcomes: DoublesVisitOutcome[] };

export type DoublesTrainingSeatState = SeatState & {
  targetIndex: number;
  dartsThisVisit: number;
  outcomes: DoublesVisitOutcome[];
  status: "IN_PROGRESS" | "COMPLETE";
};

export type DoublesTrainingState = MultiSeatState<DoublesTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};

/** How many darts of one visit a reported checkout used, or threw at a double. */
export type DartCount = 1 | 2 | 3;

/**
 * The answers a player may give for one checkout: how many darts the visit
 * took, and how many of them were thrown at a double.
 */
export type CheckoutDartOptions = {
  toFinish: DartCount[];
  atDouble: DartCount[];
};

/**
 * One 501 visit as the player reports it. 501 is a quick-score game, so the
 * input is a visit total rather than three darts. `finishedOnDouble` is the
 * only field that can win a leg: it says the dart that took the score to
 * exactly zero landed in a double. `dartsUsed` and `dartsAtDouble` describe
 * that winning visit's shape; they are validated against the checkout chart
 * and never persisted, because a turn under quick score carries no dart rows.
 */
export type FiveOhOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;
  dartsUsed?: DartCount;
  dartsAtDouble?: DartCount;
};

/** 501 accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type FiveOhOneInput = FiveOhOneVisitInput | DartObservation;

/**
 * What one visit did to the leg it was thrown in. `scored` is what the turn
 * records — 0 for a bust, so the attempted value is never persisted as a turn
 * total and a bust can never move the remaining score.
 */
export type FiveOhOneVisitOutcome = {
  isBust: boolean;
  scored: number;
  wonLeg: boolean;
  remainingAfter: number;
};

/** The minimum any seat-aware game state says about one seat. */
export type SeatState = {
  participantRef: string;
  sideKey: string;
};

/**
 * The base every seat-aware `TState` extends, so one generic scoreboard can
 * render any game without knowing its ruleset. Generic in the seat type so a
 * ruleset can add its own per-seat fields without an intersection of two
 * array types.
 */
export type MultiSeatState<TSeat extends SeatState = SeatState> = {
  activeParticipantRef: string;
  seats: readonly TSeat[];
};

/**
 * One dart's fold step: the seat state immediately before and after
 * `observation`, alongside the observation itself. `steps[i].after` is
 * always structurally equal to `steps[i + 1].before` — the walk never skips
 * or rewrites a state between two consecutive darts.
 */
export type SeatFoldStep<TSeat> = {
  before: TSeat;
  observation: DartObservation;
  after: TSeat;
};

/** One seat's score in the leg being played. */
export type FiveOhOneSeatState = SeatState & {
  remainingScore: number;
};

/**
 * One side's score: `legsWon` counts legs in the current set (the whole match
 * without sets), `setsWon` counts sets in the match. A match without sets is
 * one implicit set, so its winner reads `setsWon: 1`; consumers read `legsWon`
 * there. What wins a leg, a set and the match is the SIDE.
 */
export type FiveOhOneSideState = {
  sideKey: string;
  legsWon: number;
  setsWon: number;
};

/**
 * 501 session state, split into the three scopes it actually has: a
 * `remainingScore` per SEAT, `legsWon` per SIDE, and `status` per SESSION.
 * Every field is a fold over the fact log, never an accumulated value — a
 * bust turn stores `totalScore: 0`, so replaying the log reproduces every
 * leg exactly. A solo session is one seat and one side, with no branch
 * anywhere in the engine.
 */
export type FiveOhOneState = MultiSeatState<FiveOhOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  sides: readonly FiveOhOneSideState[];
  sets: readonly SetFold[];
  decidingSet: boolean;
  suddenDeath: boolean;
};

export type LegResult = {
  sideKey: string;
  participantRef: string;
  darts: number;
};

/**
 * One 121 visit as the player reports it — a visit total plus whether the
 * finishing dart landed in a double, exactly like `FiveOhOneVisitInput`.
 */
export type OneTwentyOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;
  dartsUsed?: DartCount;
  dartsAtDouble?: DartCount;
};

/** 121 accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type OneTwentyOneInput = OneTwentyOneVisitInput | DartObservation;

/**
 * What one visit did to the attempt it was thrown in. `scored` is what the
 * turn records — 0 for a bust, so the attempted value is never persisted as a
 * turn total and a bust can never move `remainingInAttempt`.
 */
export type OneTwentyOneVisitOutcome = {
  isBust: boolean;
  scored: number;
  checkedOut: boolean;
  remainingAfter: number;
};

/**
 * 121 session state. `currentTarget` is the ladder position (121..170).
 * `remainingInAttempt` is the live countdown within the open attempt — reset
 * to `currentTarget` whenever a new attempt starts, exactly like
 * `FiveOhOneState.remainingScore` resets to `startingScore` per leg.
 * `visitsThisAttempt` counts visits used in the open attempt (0..2 while
 * in progress — it resets the instant the 3rd resolves). All three are folds
 * over the fact log, never accumulated fields. `attemptsCompleted` counts
 * attempts that have fully resolved — checkout climb, checkout at the cap,
 * or a 3rd-visit fail-reset — never a mid-attempt (visit 1 or 2) reduction or
 * bust. Drives `ROUNDS`/`MINUTES` completion in `121_V2`; always 0-and-climbing
 * under `121_V1` too, simply unread there.
 */
export type OneTwentyOneSeatState = SeatState & {
  currentTarget: number;
  remainingInAttempt: number;
  visitsThisAttempt: number;
  status: "IN_PROGRESS" | "WON";
  attemptsCompleted: number;
};

export type OneTwentyOneState = MultiSeatState<OneTwentyOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  timerExpired: boolean;
};

/**
 * Around the Clock's resolved per-session rules. V1 resolves to the fixed
 * 1..20 path, any segment, Easy, untimed. `hitsRequired` 0 = Easy
 * (mid-visit advance); 1..3 = hits a closed visit needs to move up.
 */
export type AroundTheClockRules = {
  path: readonly BoardTarget[];
  segmentRule: "ANY" | "OUTER_SINGLE";
  hitsRequired: 0 | 1 | 2 | 3;
  timed: boolean;
  lives?: number;
};

/**
 * Around the Clock session state. `targetIndex` is the active index into the
 * session's path (the last index is BULL). Under Easy it can advance more
 * than once within a single visit — a visit's remaining darts aim at
 * whatever target is now active. `dartsThisVisit` counts darts thrown in the
 * open visit (0..2); it reads 0 exactly when the last dart closed a visit.
 * `hitsThisVisit` counts hits in the open visit under a 1/2/3-dart
 * difficulty; `laps` counts timed-run restarts at the bull. Both read 0
 * under V1. Every field is a fold over the fact log, never accumulated.
 */
export type AroundTheClockSeatState = SeatState & {
  targetIndex: number;
  dartsThisVisit: number;
  hitsThisVisit: number;
  laps: number;
  lives?: number;
  visitHit?: boolean;
  status: "IN_PROGRESS" | "COMPLETE" | "OUT";
};

/** Around the Clock's Track extras: timed-run laps completed. */
export type AroundTheClockTrackExt = { laps: number };

/** Lives bookkeeping for a Track seat: lives left (null = no lives rule) and whether the open visit has hit. */
export type LivesTrackExt = { lives: number | null; visitHit: boolean };

/** Around the Clock's engine-internal seat ext: laps plus the lives rule. */
export type AroundTheClockLivesExt = AroundTheClockTrackExt & LivesTrackExt;

export type AroundTheClockState = MultiSeatState<AroundTheClockSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  timerExpired: boolean;
};

/**
 * One Ten Up One Down attempt as the player reports it. An attempt is a single
 * visit at the current target, so the input describes the whole visit rather
 * than three darts. `checkedOut` alone never wins: the finishing dart must land
 * in a double, which is what `finishedOnDouble` says. A bust is reported the
 * same way any other failure is — `checkedOut: false` — because a bust voids
 * the visit and, with one visit per attempt, ends the attempt.
 */
export type TuodAttemptInput = {
  checkedOut: boolean;
  dartsUsed?: DartCount;
  dartsAtDouble?: DartCount;
  finishedOnDouble?: boolean;
};

/**
 * Every input `TuodEngine.record()` accepts. A `TuodAttemptInput` is a whole
 * visit reported by the keypad; a `DartObservation` is one board-tapped dart,
 * discriminated by the presence of `hitZoneKey` — mirrors `OneTwentyOneInput`.
 */
export type TuodInput = TuodAttemptInput | DartObservation;

/**
 * One seat's ladder in a Ten Up One Down session. `currentTarget`,
 * `remainingInAttempt`, `attempts`, `successes` and `failures` are folded
 * from the fact log on every read — the ladder position is never
 * accumulated. `remainingInAttempt` is the live countdown inside the open
 * attempt, equal to `currentTarget` whenever no attempt is open, exactly
 * like `OneTwentyOneSeatState.remainingInAttempt`.
 */
export type TuodSeatState = SeatState & {
  currentTarget: number;
  remainingInAttempt: number;
  attempts: number;
  successes: number;
  failures: number;
};

/**
 * Ten Up One Down session state. Score-compare: both seats always play out
 * their own full duration budget, then whichever reached the higher target
 * wins — `status`/`winningSideKey` resolve only once every seat has.
 * `timerExpired` is the one field the log cannot derive: the MINUTES
 * countdown lives in `game.store.ts`, so expiry arrives through
 * `TuodEngine.expireTimer()` exactly as it does for Score Training, never by
 * writing to this object, which is a copy.
 */
export type TuodState = MultiSeatState<TuodSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
  timerExpired: boolean;
};

/**
 * `SINGLE` is the unbanded value recorded by keypad capture, which has no
 * coordinate and therefore cannot know its band; coordinate capture always
 * resolves to `INNER_SINGLE` or `OUTER_SINGLE`.
 */
export type DartZoneKey =
  | "SINGLE"
  | "INNER_SINGLE"
  | "OUTER_SINGLE"
  | "DOUBLE"
  | "TREBLE"
  | "OUTER_BULL"
  | "INNER_BULL"
  | "MISS";

export type StageTypeKey =
  "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK" | "EXERCISE_SECTION";

export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "TREBLE"; number: number }
  | { kind: "BULL" };

/** A number-less Track target: any double (the bullseye included) or any treble. */
export type ZoneTarget = { kind: "ANY_DOUBLE" } | { kind: "ANY_TREBLE" };

/** A Track path entry: one bed of the board, or a whole zone. */
export type TrackTarget = BoardTarget | ZoneTarget;

/** A Track seat's lifecycle: still throwing, finished the path, or knocked out. */
export type TrackStatus = "IN_PROGRESS" | "DONE" | "OUT";

/**
 * One seat under the Track kernel: progress along its path, running score,
 * the open visit's dart and hit counts, and game-owned extras in `ext`.
 */
export type TrackSeat<TExt> = SeatState & {
  targetIndex: number;
  score: number;
  dartsThisVisit: number;
  hitsThisVisit: number;
  status: TrackStatus;
  ext: TExt;
};

/** Points per zone for a Track ruleset: one row for NUMBER targets, one for BULL; an absent zone scores 0. */
export type PointsTable = {
  readonly number: Partial<Record<DartZoneKey, number>>;
  readonly bull: Partial<Record<DartZoneKey, number>>;
};

/** A dart as the Track kernel judged it against the seat's target. */
export type JudgedDart<TTarget extends TrackTarget = BoardTarget> = {
  observation: DartObservation;
  target: TTarget;
  hit: boolean;
  points: number;
};

/** Chain bookkeeping for a Track seat (Target Scoring): the live chain, the best finished chain per path index, and hits so far. */
export type ChainTrackExt = {
  chain: number;
  finishedBest: (number | null)[];
  hits: number;
};

/** Sequence bookkeeping for a sequence-walking Track seat: the live chain, the best chain a miss ended, hits so far, and full passes through the path. */
export type SequenceTrackExt = {
  chain: number;
  finishedBest: number | null;
  hits: number;
  sequences: number;
};

/** Per-target bookkeeping for a Track seat (Hit Count): darts thrown at the current target, and hits per path index. */
export type TargetTallyExt = {
  dartsOnTarget: number;
  hitsPerTarget: number[];
};

/** Completed walks of a repeating path. */
export type PassTrackExt = {
  passes: number;
};

/** A ladder's furthest index reached, kept as the seat moves up and down. */
export type LadderTrackExt = { highestIndex: number };

/** Index change by visit hit count; a count the table lacks does not move the seat. */
export type MoveTable = Readonly<Record<number, number>>;

/** Hit Count's Track extras. */
export type HitCountTrackExt = TargetTallyExt & PassTrackExt;

/** Halve-It's Track extras: the per-target tally, passes, and blank visits. */
export type HalveItTrackExt = TargetTallyExt &
  PassTrackExt & {
    halvings: number;
  };

/** Doubles Snakes & Ladders' Track extras: the per-level tally, the furthest level, and closed visits. */
export type SnakesLaddersTrackExt = TargetTallyExt &
  LadderTrackExt & {
    rounds: number;
  };

/** Points per round for a Track seat whose path is cut into equal rounds (SwitchBlade). */
export type RoundTallyExt = {
  roundTotals: number[];
};

/** SwitchBlade's Track extras. */
export type SwitchbladeTrackExt = RoundTallyExt & PassTrackExt;

/** A visit-close bonus table: the bonus a visit's hit count earns; a count it does not name earns no lock. */
export type LockBonus = Readonly<Partial<Record<number, number>>>;

/** A Track seat's checkpoint: the path index of its last lock, and how many locks it made. */
export type LockTrackExt = {
  lastLock: number | null;
  locks: number;
};

/** Doubles Lock's Track extras: the checkpoint, passes, and darts per pass. */
export type DoublesLockTrackExt = LockTrackExt &
  PassTrackExt & {
    dartsThisPass: number;
    dartsPerPass: number[];
  };

/**
 * What the player did, as observed at input time — the engine's only input.
 * `locationX` / `locationY` are the landing point in regulation millimetres
 * (origin bull centre, y increasing downward), present only for VISUAL_BOARD
 * capture and null together when the landing point was never seen.
 */
export type DartObservation = {
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  locationX: number | null;
  locationY: number | null;
};

/** Score Training accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type ScoreTrainingInput = number | DartObservation;

/**
 * One row of `darts`. `score` is the actual board score, never a game-specific
 * point value. The location pair is written together or not at all, mirroring
 * `chk_dart_location_pair`.
 */
export type DartFact = {
  sequence: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  score: number;
  locationX: number | null;
  locationY: number | null;
};

/**
 * One row of `turns`. `totalScore` is the counted board score — 0 for a void
 * visit, never negative. `completedAt` is the client-observed end of the visit
 * (`06-Spec/04-Runtime-Layer.md`), so it is stamped when the visit resolves and
 * stays null while the visit is still open.
 *
 * `participantRef` is the seat that threw the visit — the engine mints it
 * exactly as it mints `clientKey`, `sequence` and `completedAt`, which is what
 * lets one session's log hold several throwers.
 */
export type TurnFact = {
  clientKey: string;
  stageClientKey: string;
  participantRef: string;
  sequence: number;
  completedAt: string | null;
  totalScore: number;
  darts: DartFact[];
};

/** One row of `exercise_stages`. */
export type StageFact = {
  clientKey: string;
  stageTypeKey: StageTypeKey;
  parentClientKey: string | null;
  sequence: number;
};

export type EngineFacts = {
  stages: StageFact[];
  turns: TurnFact[];
};

/** One visit's darts, plus the remaining score it opened against. */
export type CheckoutVisitDarts = {
  startingRemaining: number;
  darts: readonly DartFact[];
};

/**
 * A checkout visit plus the counted total its engine recorded for it --
 * `turns.total_score`, which is 0 for a busted 501/121 visit and for every
 * failed TUOD attempt, while the visit's darts keep their real board scores.
 *
 * Separate from `CheckoutVisitDarts` because only a reader that subtracts
 * darts from a total built out of `turns.total_score` needs it
 * (`scoring-average.module.ts`); the classifier and the highest-checkout
 * reader work off the darts alone and should not have to supply it.
 */
export type CheckoutVisitTotals = CheckoutVisitDarts & {
  countedTotal: number;
};

/** The largest successful checkout finish, how many times it was hit, and the session of the first such finish (`null` when the visits carry no session id). */
export type HighestCheckout = {
  value: number;
  timesHit: number;
  sessionId: string | null;
};

/** One dart's classification against the remaining score it was thrown at. */
export type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";

/** A pointer position in client (viewport) pixels. */
export type BoardPointer = {
  clientX: number;
  clientY: number;
};

/** A point on the board in millimetres, or null when the transform is unavailable. */
export type BoardCoordinate = {
  x: number;
  y: number;
};

export type ScreenToBoard = (pointer: BoardPointer) => BoardCoordinate | null;

/** Which hand throws, so the magnifier is never placed under the throwing thumb. */
export type Handedness = "LEFT" | "RIGHT";

/** Where to draw the magnifier, relative to the pointer, in viewport pixels. */
export type MagnifierPlacement = {
  offsetX: number;
  offsetY: number;
};

/** Which side of the pointer the magnifier sits on, decided once per gesture. */
export type MagnifierSide = {
  x: "left" | "right";
  y: "above" | "below";
};

export type BoardInputOptions = {
  toBoard: ScreenToBoard;
  onCommit: (observation: DartObservation) => void;
  handedness?: Handedness;
  viewport?: { width: number; height: number };
  magnifierSize?: number;
  /**
   * Reads the board SVG's current screen scale, in pixels per board
   * millimetre. Supplied as a closure (mirroring `toBoard`) rather than a
   * plain number so the controller can re-read it on every access — the
   * board is `w-full`, so this changes with viewport width.
   */
  pxPerMm?: () => number;
};

export type BoardInputController = {
  readonly active: boolean;
  readonly preview: BoardHit | null;
  readonly point: BoardCoordinate | null;
  readonly placement: MagnifierPlacement | null;
  /**
   * The magnifier's diameter in pixels, as this controller clamps for. The view
   * renders the magnifier at exactly this size — it is published here so the
   * rendered box and the placement clamp cannot hold separate copies of the
   * number and drift apart.
   */
  readonly magnifierSize: number;
  /**
   * Pixels per board millimetre at the board's current displayed size,
   * recomputed on every read. The magnifier multiplies this by its own
   * zoom factor so magnification stays a fixed multiple of the displayed
   * board rather than a fixed absolute scale.
   */
  readonly pxPerMm: number;
  press(pointer: BoardPointer): void;
  move(pointer: BoardPointer): void;
  release(): void;
  cancel(): void;
  commitUnseen(): void;
};

/**
 * Which stage shape an engine has, so the shared rota can derive the active
 * seat for both. `SHARED`: one stage instance holds every seat's turns,
 * interleaved — an X01 leg, where a checkout ends the stage for all seats at
 * once. `PER_SEAT`: one stage instance per seat per round — seat 2's round 4
 * is not seat 1's round 4.
 */
export type StageOwnership = "SHARED" | "PER_SEAT";

/**
 * What a dart was aimed at. Both fields move together: a target number with a
 * null zone is rejected by `chk_dart_target_consistency` (migration `0007`),
 * which admits only both-null or a NOT NULL zone.
 */
export type DartIntent = {
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
};

/** One seat's entry in a score-compare, reduced to what deciding needs. */
export type ScoreCompareSeat = {
  sideKey: string;
  completed: boolean;
  metric: number;
};

/** A whole match's resolution: its status and the side that took it. */
export type MatchOutcome = {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE";
  winningSideKey: string | null;
};

/** One modal context row: left parts in order, plus the right-hand value. */
export type SessionContextRow = {
  title: string | null;
  stage: string | null;
  round: string | null;
  value: string | null;
};

export type SessionContextInput = {
  gameTypeKey: string | null;
  sessionId: string | null;
  configSnapshot: unknown;
  facts: EngineFacts;
  timerExpired: boolean;
};

export type SessionContextOptions = {
  expectedSessionId?: string | null;
  fallbackTitle?: string | null;
};

/**
 * One in-progress session's progress line for an active-session card:
 * sentence-case `detail` (`vs Dartbot · Leg 3 · First to 3 · 2–0`) and an
 * optional headline value with its uppercase mono label (`TO GO`).
 */
export type SessionProgress = {
  detail: string;
  big: { value: string; label: string } | null;
};

/** A race to a number of legs or sets (`501_V2`); `count` is odd under `BEST_OF`. */
export type RaceSpec = { mode: "FIRST_TO" | "BEST_OF"; count: number };

/** Win by 2 legs, bounded by sudden death at `cap`-`cap`. */
export type WinByTwo = { cap: number; scope: "EVERY_SET" | "DECIDING_SET" };

/** A 501 match format, normalised across ruleset versions (`matchFormatOf`). */
export type MatchFormat = {
  legs: RaceSpec;
  sets: RaceSpec | null;
  winByTwo: WinByTwo | null;
};

/** One set's leg tally and winner; a match without sets folds as one set. */
export type SetFold = {
  legsWon: Readonly<Record<string, number>>;
  winner: string | null;
};

/**
 * A match folded from its leg winners: one `SetFold` per set played (or the
 * single open set), sets won per side, and the match winner (null while open).
 * `decidingSet` flags the set that can end the match; `suddenDeath` flags a
 * leg race where two sides sit at the margin cap with no winner yet.
 */
export type MatchFold = {
  sets: SetFold[];
  setsWon: Readonly<Record<string, number>>;
  winner: string | null;
  decidingSet: boolean;
  suddenDeath: boolean;
};

/** The two fields the dart engine shell reads from any folded state. */
export type ShellState = { activeParticipantRef: string; status: string };

/** A point on the board in millimetres from the bull centre, y downward. */
export type BoardPointMm = { x: number; y: number };

/** A coin face in the who-throws-first toss. */
export type CoinFace = "heads" | "tails";

/** Which side won a starter contest (0 or 1), or a tie that must be rethrown. */
export type StarterResult = 0 | 1 | "tie";

/**
 * How a Checkout ruleset judged one visit (Pattern 18 §Rule-kernel
 * families): a checkout in `darts` darts, a bust, a closed visit short of
 * zero, a visit still open, or `FAIL`, the attempt dead now whatever visits
 * remain (an unreachable remainder).
 */
export type VisitVerdict =
  | { kind: "CHECKOUT"; darts: number }
  | { kind: "BUST" }
  | { kind: "SPENT"; remaining: number }
  | { kind: "OPEN"; remaining: number; darts: number }
  | { kind: "FAIL" };

/**
 * One seat on the Checkout kernel: the open attempt's `target`, the score
 * its current visit started from (`visitStart`) and the live `remaining`;
 * `ext` is the ruleset's own bookkeeping.
 */
export type CheckoutSeat<TExt> = {
  target: number;
  visitStart: number;
  remaining: number;
  dartsInVisit: number;
  visitIndex: number;
  attemptIndex: number;
  attempts: number;
  checkouts: number;
  status: "IN_PROGRESS" | "DONE";
  ext: TExt;
};

/**
 * One seat of an Elimination match (`elimination-kernel.module.ts`): its
 * lives, whether it is out, and the game-owned `ext`.
 */
export type EliminationSeat<TExt> = {
  participantRef: string;
  sideKey: string;
  lives: number;
  out: boolean;
  ext: TExt;
};

/**
 * One seat's change from one dart. `livesDelta` is clamped so lives never go
 * below 0; `ext` replaces the seat's ext. A change to a seat already out is
 * ignored.
 */
export type SeatChange<TExt> = {
  participantRef: string;
  livesDelta?: number;
  ext?: TExt;
};

/** An Elimination match folded from its darts: seats, out order, outcome and the seat to throw. */
export type EliminationMatch<TExt> = {
  seats: EliminationSeat<TExt>[];
  outOrder: string[];
  status: "IN_PROGRESS" | "COMPLETE";
  winningSideKey: string | null;
  activeParticipantRef: string;
};

/** Killer's seat extras: its number, Killer status, lives taken, darts to become a Killer, darts thrown. */
export type KillerExt = {
  number: number;
  killer: boolean;
  livesTaken: number;
  dartsToKiller: number | null;
  dartsThrown: number;
};

/** One Killer seat as the play screen reads it: its number, lives, Killer status, out, and its tallies. */
export type KillerSeatState = SeatState & {
  number: number;
  lives: number;
  killer: boolean;
  out: boolean;
  livesTaken: number;
  dartsToKiller: number | null;
  dartsThrown: number;
};

/** Killer's folded state: seats, the order seats went out, and the outcome. */
export type KillerState = MultiSeatState<KillerSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE";
  winningSideKey: string | null;
  outOrder: string[];
  seats: KillerSeatState[];
};
