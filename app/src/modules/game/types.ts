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

export type Bobs27State = {
  targetIndex: number;
  score: number;
  dartsThisVisit: boolean[];
  status: "IN_PROGRESS" | "WON" | "LOST";
};

export type SinglesTrainingState = {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
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

/**
 * One 501 visit as the player reports it. 501 is a quick-score game, so the
 * input is a visit total rather than three darts. `finishedOnDouble` is the
 * only field that can win a leg: it says the dart that took the score to
 * exactly zero landed in a double.
 */
export type FiveOhOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;
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

/**
 * 501 session state. `remainingScore` is the score left in the leg being
 * played and `legsWon` counts completed legs; both are folds over the fact
 * log, never accumulated fields. `status` is the whole session's — winning a
 * leg short of `legsToWin` leaves it `IN_PROGRESS`.
 */
export type FiveOhOneState = {
  remainingScore: number;
  legsWon: number;
  status: "IN_PROGRESS" | "WON";
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
  dartsUsed?: 1 | 2 | 3;
  finishedOnDouble?: boolean;
};

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

/** How a session feeds visits to an engine: a whole visit total, or one dart at a time. */
export type EngineInputMode = "QUICK_SCORE" | "VISUAL_BOARD";

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
 */
export type TurnFact = {
  clientKey: string;
  stageClientKey: string;
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
