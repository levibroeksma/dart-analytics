import type { BoardHit } from "@lib/types";

/**
 * Score Training's engine state, derived on every `state()` call. The MINUTES
 * countdown lives in `game.store.ts`, not the engine, so `timerExpired`
 * reports a flag the caller sets through `ScoreTrainingEngine.expireTimer()` —
 * never by writing to this object, which is a copy. That keeps the contract's
 * zero-argument `isComplete()` intact without handing out live state.
 */
export type ScoreTrainingState = {
  turnCount: number;
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

export type Bobs27State = MultiSeatState<Bobs27SeatState> & {
  status: "IN_PROGRESS" | "WON" | "LOST" | "COMPLETE";
  winningSideKey: string | null;
};

export type SinglesTrainingState = {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * `dartsThisVisit` is the raw zone each of this visit's darts hit on the
 * round's own number, or `null` for a miss/off-target dart — not a
 * pre-computed single/double/treble flag, so a Shanghai is derived from it
 * on the visit's 3rd dart rather than tracked as it happens.
 */
export type ShanghaiState = {
  targetIndex: number;
  totalScore: number;
  dartsThisVisit: (DartZoneKey | null)[];
  status: "IN_PROGRESS" | "SHANGHAI" | "COMPLETE";
};

export type DoublesVisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null;
};

export type DoublesTrainingState = {
  targetIndex: number;
  dartsThisVisit: number;
  outcomes: DoublesVisitOutcome[];
  status: "IN_PROGRESS" | "COMPLETE";
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

/** One seat's score in the leg being played. */
export type FiveOhOneSeatState = SeatState & {
  remainingScore: number;
};

/** One side's completed legs. What wins a leg and the match is the SIDE. */
export type FiveOhOneSideState = {
  sideKey: string;
  legsWon: number;
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
 * over the fact log, never accumulated fields.
 */
export type OneTwentyOneState = {
  currentTarget: number;
  remainingInAttempt: number;
  visitsThisAttempt: number;
  status: "IN_PROGRESS" | "WON";
};

/**
 * Around the Clock session state. `targetIndex` is the active target (0..19
 * = numbers 1..20, 20 = BULL) and can advance more than once within a single
 * visit — unlike every other engine, a visit's remaining darts aim at
 * whatever target is now active, not the one the visit started on.
 * `dartsThisVisit` counts darts thrown in the open visit (0..2); it resets
 * to 0 both when a visit closes normally at 3 darts and when a BULL hit
 * completes the session early. Both fields are folds over the fact log,
 * never accumulated.
 */
export type AroundTheClockState = {
  targetIndex: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
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
 * Ten Up One Down session state. `currentTarget`, `attempts`, `successes` and
 * `failures` are folded from the fact log on every read — the ladder position
 * is never accumulated. `timerExpired` is the one field the log cannot derive:
 * the MINUTES countdown lives in `game.store.ts`, so expiry arrives through
 * `TuodEngine.expireTimer()` exactly as it does for Score Training, never by
 * writing to this object, which is a copy.
 */
export type TuodState = {
  currentTarget: number;
  attempts: number;
  successes: number;
  failures: number;
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

export type StageTypeKey = "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK";

export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "BULL" };

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
