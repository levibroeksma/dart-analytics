import type { FiveOhOneSnapshot, Seated } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  FiveOhOneInput,
  FiveOhOneState,
  FiveOhOneVisitInput,
  FiveOhOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const DARTS_PER_VISIT = 3;

/**
 * Builds the `LEG` stage for leg `sequence`. Legs are root stages — 501 has no
 * enclosing MATCH or SET stage, so every leg's `parentClientKey` is null and
 * its `sequence` is its position in the match.
 */
function legStage(sequence: number): StageFact {
  return {
    clientKey: `leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: null,
    sequence,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Discriminates `FiveOhOneInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in. `record()` and
 * `wouldComplete()` both dispatch on this, so a keypad-shaped input can never
 * reach `resolveObservation` and get misclassified as a dart. The engine
 * holds no mode of its own to disagree with the input it is handed.
 */
function isDartObservation(input: FiveOhOneInput): input is DartObservation {
  return "hitZoneKey" in input;
}

/** A visit score is playable only as a whole number in `0..maxVisitScore`. */
function isPlayableVisitScore(
  scoreAttempted: number,
  maxVisitScore: number,
): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= maxVisitScore
  );
}

export function initialFiveOhOneState(
  config: FiveOhOneSnapshot,
): FiveOhOneState {
  return {
    remainingScore: config.startingScore,
    legsWon: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * Resolves one visit against the remaining score of the leg in play, under the
 * bust matrix in precedence order: an overshoot busts; leaving exactly 1 busts
 * because 1 cannot be finished on a double (D1 is 2); reaching exactly 0 busts
 * unless the visit declares `finishedOnDouble`. A bust scores 0 and leaves the
 * remaining score untouched.
 */
function resolveFiveOhOneVisit(
  remainingScore: number,
  input: FiveOhOneVisitInput,
): FiveOhOneVisitOutcome {
  const wouldRemain = remainingScore - input.scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && input.finishedOnDouble !== true);

  if (isBust) {
    return {
      isBust: true,
      scored: 0,
      wonLeg: false,
      remainingAfter: remainingScore,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    wonLeg: reachedZero,
    remainingAfter: wouldRemain,
  };
}

/**
 * Why the reported dart counts are impossible for the visit that is being
 * recorded, or null when they are consistent with it. Only a claimed checkout
 * is checked: on any other visit the counts describe nothing the checkout
 * chart can contradict, so they are carried without comment.
 */
function checkoutDartsRejectionFor(
  state: FiveOhOneState,
  input: FiveOhOneVisitInput,
  config: FiveOhOneSnapshot,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    state.remainingScore,
    input.dartsUsed,
    input.dartsAtDouble,
    config.maxDartsPerTurn,
  );
}

/**
 * Pure reducer: folds one visit onto a `FiveOhOneState`. A won leg increments
 * `legsWon` and restarts the next leg at `config.startingScore`; the session
 * only reaches `WON` once `legsWon` reaches `config.legsToWin`.
 * `config.checkIn` and `config.checkOut` each carry exactly one value in
 * `501_V1` (`STRAIGHT_IN` / `DOUBLE_OUT`), so the straight-in start and
 * double-out finish are applied directly rather than branched on.
 * @throws when the session is already complete, or when `scoreAttempted` is
 *   not a whole number within `0..config.maxVisitScore`; the caller's state is
 *   left untouched either way.
 */
export function applyFiveOhOneVisit(
  state: FiveOhOneState,
  input: FiveOhOneVisitInput,
  config: FiveOhOneSnapshot,
): FiveOhOneState {
  if (!isPlayableVisitScore(input.scoreAttempted, config.maxVisitScore)) {
    throw new Error(`Enter a score between 0 and ${config.maxVisitScore}.`);
  }
  const dartsRejection = checkoutDartsRejectionFor(state, input, config);
  if (dartsRejection) {
    throw new Error(dartsRejection);
  }
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the session is complete; undo first to correct it.",
    );
  }

  const outcome = resolveFiveOhOneVisit(state.remainingScore, input);
  if (!outcome.wonLeg) {
    return { ...state, remainingScore: outcome.remainingAfter };
  }

  const legsWon = state.legsWon + 1;
  if (legsWon >= config.legsToWin) {
    return { remainingScore: 0, legsWon, status: "WON" };
  }
  return {
    remainingScore: config.startingScore,
    legsWon,
    status: "IN_PROGRESS",
  };
}

/**
 * 501: a match of `legsToWin` legs, each started at `startingScore` and won by
 * a visit whose final dart lands in a double. The engine owns the fact log —
 * one `LEG` stage per leg and one turn per visit, carrying the visit total
 * with no dart rows because 501 is a quick-score game. `remainingScore` and
 * `legsWon` are derived by folding those turns through `applyFiveOhOneVisit`,
 * never accumulated: a bust turn stores `totalScore: 0`, so replaying the log
 * reproduces the leg exactly.
 */
export class FiveOhOneEngine implements GameEngine<
  FiveOhOneInput,
  FiveOhOneState
> {
  readonly rulesetVersionKey = "501_V1";
  readonly stageOwnership = "SHARED" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<FiveOhOneSnapshot>,
    prior?: EngineFacts,
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [legStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Replays every recorded turn as the visit that produced it. A turn's
   * `totalScore` is what actually counted, so a bust replays as a scoreless
   * visit and only a genuine checkout can take a leg to zero — which is why
   * `finishedOnDouble` is safe to assert on replay.
   */
  private deriveState(): FiveOhOneState {
    let state = initialFiveOhOneState(this.config);
    for (const turn of this.turns) {
      state = applyFiveOhOneVisit(
        state,
        { scoreAttempted: turn.totalScore, finishedOnDouble: true },
        this.config,
      );
    }
    return state;
  }

  /**
   * Classifies one board observation into the target, zone, and score it
   * struck. A miss carries no coordinates, so it resolves to a scoreless
   * `MISS` hit using the observation's own zone key rather than going through
   * `classify()`.
   */
  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? {
          targetNumber: null,
          zoneKey: observation.hitZoneKey,
          score: 0,
        }
      : classify(observation.locationX, observation.locationY);
  }

  private openLeg(): StageFact {
    const stage = this.stages.at(-1);
    if (!stage) {
      throw new Error("A 501 engine always has an open leg stage.");
    }
    return stage;
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey)
      .length;
  }

  /** The visit still being thrown in the open leg, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /**
   * The leg's starting score minus the counted total of every earlier turn in
   * the same leg — the score `visit` opened against, before any of its own
   * darts were thrown.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const scoredBefore = this.turns
      .filter(
        (turn) =>
          turn.stageClientKey === visit.stageClientKey &&
          turn.sequence < visit.sequence,
      )
      .reduce((sum, turn) => sum + turn.totalScore, 0);
    return this.config.startingScore - scoredBefore;
  }

  /**
   * Appends one visit to the open leg, then opens the next leg's stage when
   * that visit won a leg and the match continues. Stages and turns move
   * together so the log never holds a turn without its stage.
   * @throws when the score is out of range or the session has already ended;
   *   the fact log is left untouched.
   */
  record(input: FiveOhOneInput): FiveOhOneState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * @throws when a dart-based visit is still open — a whole-visit total and a
   *   part-thrown board visit are not composable, so this refuses loudly
   *   rather than guess how to merge them. A clean visit boundary (no open
   *   board visit) always accepts a keypad total, so the keypad stays usable
   *   as the accessible alternative from any resting state.
   */
  private recordVisitTotal(input: FiveOhOneVisitInput): FiveOhOneState {
    if (this.openVisit() !== null) {
      throw new Error(
        "Finish the open visit on the board before entering a keypad total.",
      );
    }

    const before = this.deriveState();
    const after = applyFiveOhOneVisit(before, input, this.config);
    const outcome = resolveFiveOhOneVisit(before.remainingScore, input);

    const leg = this.openLeg();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    if (outcome.wonLeg && after.status === "IN_PROGRESS") {
      this.stages.push(legStage(this.stages.length + 1));
    }

    return after;
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on a
   * double, or on the third dart.
   *
   * A busted visit keeps its dart rows and their real board scores while
   * `totalScore` goes to 0 — counted zero, thrown non-zero. That divergence is
   * the fact that makes bust rate computable, and it is why `totalScore` is
   * not simply the sum of the visit's darts here.
   *
   * Completion is checked before anything is written, mirroring
   * `recordVisitTotal`: the fold that rejects a throw into a won session used
   * to run after the dart was already pushed, so the refusal left the dart —
   * and possibly a whole new visit — behind in the log it claimed not to have
   * touched.
   *
   * @throws when the session is already complete; the fact log is left untouched.
   */
  private recordDart(observation: DartObservation): FiveOhOneState {
    if (this.deriveState().status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the session is complete");
    }

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit();

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    const checkedOut = this.settleVisit(visit, resolved.zoneKey);

    const after = this.deriveState();
    if (checkedOut && after.status !== "WON") {
      this.stages.push(legStage(this.stages.length + 1));
    }

    return after;
  }

  /** Appends an empty visit to the open leg and returns it. */
  private openNewVisit(): TurnFact {
    const leg = this.openLeg();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turnCountIn(leg.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * Applies the bust and checkout rules to a visit that just took a dart, and
   * stamps `completedAt` when the visit resolves.
   *
   * A busted visit keeps its dart rows and their real board scores while
   * `totalScore` goes to 0 — counted zero, thrown non-zero. That divergence is
   * the fact that makes bust rate computable, and it is why `totalScore` is
   * not simply the sum of the visit's darts.
   * @returns whether the visit checked out on a double.
   */
  private settleVisit(visit: TurnFact, hitZoneKey: DartZoneKey): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const checkedOut = remainingAfter === 0 && hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return false;
    }

    visit.totalScore = thrown;
    if (checkedOut || visit.darts.length === DARTS_PER_VISIT) {
      visit.completedAt = new Date().toISOString();
    }

    return checkedOut;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted facts,
   * and removes the leg stage that visit opened. The stage only goes when the
   * popped turn belonged to an earlier leg — that is exactly the case where
   * `record()` appended a stage — so undoing a visit played inside a new leg
   * leaves that leg open.
   *
   * Dispatches on the shape of the last recorded turn: `record()` and
   * `wouldComplete()` already discriminate their input by shape, and both
   * shapes can appear in one session's log, so undo — which has no input to
   * read a shape from — reads the shape of what `record()`
   * actually wrote instead. A turn built from a keypad total always has
   * `darts: []`; a turn built from a board dart always holds at least one
   * dart from the moment it exists in the log (`recordDart` opens a visit and
   * appends its first dart in the same call, so a zero-dart board turn is
   * never observable outside that call). One dart goes at a time when the
   * last turn holds darts: popping a visit's only dart pops the visit itself,
   * by the same rule; popping one of several darts instead clears
   * `completedAt` and recomputes `totalScore` from the darts left behind,
   * reopening the visit.
   * @returns true if a dart or a visit was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;

    return last.darts.length > 0 ? this.undoDart() : this.undoVisitTotal();
  }

  private undoVisitTotal(): boolean {
    const removed = this.turns.pop();
    if (!removed) return false;

    this.popStageOpenedBy(removed.stageClientKey);
    return true;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    this.popStageOpenedBy(visit.stageClientKey);

    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
  }

  /**
   * Pops the open leg's stage when it was opened by the turn now being
   * undone — the same stage `record()` would have appended for that turn.
   */
  private popStageOpenedBy(stageClientKey: string): void {
    const openLeg = this.stages.at(-1);
    if (
      this.stages.length > 1 &&
      openLeg &&
      openLeg.clientKey !== stageClientKey
    ) {
      this.stages.pop();
    }
  }

  /**
   * Whether the dart under consideration would check out the final leg — the
   * one 501 way a session can complete on a single dart, independent of how
   * many darts the open visit already holds.
   */
  private dartChecksOutFinalLeg(
    observation: DartObservation,
    before: FiveOhOneState,
  ): boolean {
    const resolved = this.resolveObservation(observation);

    const remainingAfter = before.remainingScore - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    return checksOut && before.legsWon + 1 >= this.config.legsToWin;
  }

  /**
   * Answers the finish-confirm gate under `VISUAL_BOARD` without touching the
   * fact log. A dart that checks out the final leg completes the session —
   * the one way a 501 session can complete, whatever the open visit's dart
   * count. A dart count alone never completes a 501 session, so every other
   * case answers false.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    return this.dartChecksOutFinalLeg(observation, before);
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. Only the
   * checkout that takes `legsWon` to `legsToWin` completes the session — a
   * checkout that merely wins a leg does not — and a visit `record()` would
   * reject never completes it either, dart counts the checkout chart
   * contradicts included: this predicate answers, it never throws.
   */
  wouldComplete(input: FiveOhOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    if (this.openVisit() !== null) return false;
    if (
      !isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)
    ) {
      return false;
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (checkoutDartsRejectionFor(before, input, this.config) !== null) {
      return false;
    }

    return applyFiveOhOneVisit(before, input, this.config).status === "WON";
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): FiveOhOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const fiveOhOneEngineFactory: GameEngineFactory<
  Seated<FiveOhOneSnapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneSnapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior);
  },
};

registerEngineFactory(fiveOhOneEngineFactory);
