import type { HitCountTarget } from "@lib/types";
import type { BoardTarget } from "@modules/types";

/**
 * Warm-Up state, derived on every `state()` call. It carries no elapsed time:
 * an `ExerciseEngine` is deterministic with respect to its inputs,
 * configuration and ruleset (09-Training/01-Routines.md §9), so the clock lives in
 * the caller and transitions arrive as `advance()` calls.
 */
export type WarmUpState = {
  phaseIndex: number;
  phaseName: string;
  targets: readonly number[];
  phaseDurationSeconds: number;
  phaseCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Switching state, derived on every `state()` call by replaying `facts()`
 * (`foldSwitchingState`) — nothing here is held as mutable engine state.
 * `targetIndex` is the position in `config.targets` the *next* dart scores
 * against; `currentTargetNumber` is that same target's board number, so a
 * caller never has to index into its own copy of the config to render it.
 */
export type SwitchingState = {
  currentTargetNumber: number;
  targetIndex: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Double Pattern state, derived on every `state()` call by replaying
 * `facts()` (`foldDoublePatternState`), exactly like `SwitchingState`.
 * `patternIndex`/`targetWithinPattern` locate the *next* dart inside
 * `config.patterns`; `currentDoubleNumber` is that double's own board
 * number, e.g. `20` for `D20`.
 */
export type DoublePatternState = {
  patternIndex: number;
  targetWithinPattern: number;
  currentDoubleNumber: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Target Scoring state, derived on every `state()` call by replaying
 * `facts()` (`foldTargetScoringState`), exactly like `SwitchingState`.
 * `targetIndex`/`currentTargetNumber` locate the target the *next* dart is
 * thrown at. `bestChain` and `bestChainByTarget` include the live chain, so
 * a chain cut by the timer still counts; `markToBeat` is the best *finished*
 * chain on the current target this run — `null` until one exists.
 */
export type TargetScoringState = {
  currentTargetNumber: number;
  targetIndex: number;
  currentChain: number;
  bestChain: number;
  markToBeat: number | null;
  bestChainByTarget: { targetNumber: number; bestChain: number }[];
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Switching Chain state, derived by replaying `facts()`
 * (`foldSwitchingChainState`). `targetIndex`/`currentTargetNumber` locate
 * the target the *next* dart is thrown at. `bestChain` includes the live
 * chain; `markToBeat` is the best chain ended by a miss this run — `null`
 * until one exists. `completedSequences` counts hits on the last target,
 * i.e. full passes through the sequence.
 */
export type SwitchingChainState = {
  currentTargetNumber: number;
  targetIndex: number;
  currentChain: number;
  bestChain: number;
  markToBeat: number | null;
  completedSequences: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Score Threshold ("65 or More") state, derived by replaying `facts()`
 * (`foldScoreThresholdState`). A visit is judged once its third dart lands:
 * `visits` counts judged visits, `beats` those reaching `threshold`, and
 * `lastVisitTotal` is the latest judged total — `null` until one exists.
 * `currentVisitTotal`/`dartsInVisit` describe the visit still open.
 */
export type ScoreThresholdState = {
  threshold: number;
  beats: number;
  visits: number;
  lastVisitTotal: number | null;
  currentVisitTotal: number;
  dartsInVisit: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Bullseye Checkout ("Bullseye Checkouts") state, derived by replaying
 * `facts()` (`foldBullseyeCheckoutState`). A visit is judged once its third
 * dart lands: `visits` counts judged visits, `checkouts` those whose setup
 * darts total `startScore − 50` and whose third dart hit the inner bull.
 * `lastVisitCheckout` is `null` until a visit is judged. `currentLeft` is
 * `startScore` minus the open visit's darts — negative once the setup
 * overshoots.
 */
export type BullseyeCheckoutState = {
  startScore: number;
  checkouts: number;
  visits: number;
  lastVisitCheckout: boolean | null;
  currentLeft: number;
  dartsInVisit: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/** One throw's outcome in Bull Up Practice. */
export type BullUpTier = "BULLSEYE" | "OUTER_BULL" | "MISS";

/**
 * Bull Up ("Bull Up Practice") state, derived by replaying `facts()`
 * (`foldBullUpState`). Every throw is one dart and is judged when it lands:
 * `bulls` counts bullseyes and outer bulls together. `lastTier` is `null`
 * before the first throw. Rates are derived at display, not held here.
 */
export type BullUpState = {
  throws: number;
  bullseyes: number;
  bulls: number;
  lastTier: BullUpTier | null;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Checkout Sequence ("Catch 40") state, derived by replaying `facts()`
 * (`foldCheckoutSequenceState`). `currentOutshot` is `null` once the last
 * outshot has been attempted. `remaining` is the open visit's walked score.
 * `attemptDart` counts darts used in the open attempt — a busted visit uses
 * all three. `lastAttemptPoints` is `null` until an attempt resolves.
 */
export type CheckoutSequenceState = {
  currentOutshot: number | null;
  remaining: number;
  attemptDart: number;
  points: number;
  checkouts: number;
  attempts: number;
  lastAttemptPoints: number | null;
  dartsInVisit: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Random Checkout state, derived by replaying `facts()`
 * (`foldRandomCheckoutState`). One attempt is one visit from `startScore`,
 * drawn from the run's seed; `remaining` is the open visit's walked score.
 * `attempts` counts judged attempts only — one open at expiry is not judged.
 * `lastAttempt` is `null` until an attempt resolves. The checkout rate is
 * derived by consumers, not held here.
 */
export type RandomCheckoutState = {
  startScore: number;
  remaining: number;
  dartsInVisit: number;
  checkouts: number;
  attempts: number;
  lastAttempt: "CHECKOUT" | "FAILED" | null;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Hit Count state, derived by replaying `facts()` (`foldHitCountState`).
 * `currentTarget`/`targetIndex` locate the target the next dart is thrown
 * at; `hitsPerTarget` follows the config's list and sums every pass.
 */
export type HitCountState = {
  currentTarget: HitCountTarget;
  targetIndex: number;
  dartsLeftOnTarget: number;
  hits: number;
  dartsThrown: number;
  hitsPerTarget: { target: HitCountTarget; hits: number }[];
  passes: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/** One SwitchBlade path slot: a treble, or the bull. */
export type SwitchbladeSlot =
  { kind: "TREBLE"; number: number } | { kind: "BULL" };

/**
 * SwitchBlade state, derived by replaying `facts()` (`foldSwitchbladeState`).
 * `currentSlot`/`slotIndex`/`round` locate the next dart; `roundTotals`
 * sums each round's board points over every pass.
 */
export type SwitchbladeState = {
  currentSlot: SwitchbladeSlot;
  slotIndex: number;
  round: number;
  total: number;
  roundTotals: number[];
  passes: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Doubles Lock state, derived by replaying `facts()` (`foldDoublesLockState`).
 * `currentDouble`/`targetIndex` locate the next dart; `lastLock` is this
 * pass's checkpoint; `bonus` and `locks` sum over every pass; `dartsPerPass`
 * lists each completed pass's darts, `bestPassDarts` the fewest.
 */
export type DoublesLockState = {
  currentDouble: BoardTarget;
  targetIndex: number;
  lastLock: BoardTarget | null;
  bonus: number;
  locks: number;
  passes: number;
  dartsPerPass: number[];
  bestPassDarts: number | null;
  dartsThisPass: number;
  hits: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
