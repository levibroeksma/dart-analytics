import type { FiveOhOneSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  EngineInputMode,
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
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: FiveOhOneSnapshot,
    prior?: EngineFacts,
    private readonly inputMode: EngineInputMode = "QUICK_SCORE",
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
    if (this.inputMode === "VISUAL_BOARD") {
      return this.recordDart(input as DartObservation);
    }
    return this.recordVisitTotal(input as FiveOhOneVisitInput);
  }

  private recordVisitTotal(input: FiveOhOneVisitInput): FiveOhOneState {
    const before = this.deriveState();
    const after = applyFiveOhOneVisit(before, input, this.config);
    const outcome = resolveFiveOhOneVisit(before.remainingScore, input);

    const leg = this.openLeg();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: leg.clientKey,
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
   */
  private recordDart(observation: DartObservation): FiveOhOneState {
    const resolved = this.resolveObservation(observation);

    const leg = this.openLeg();
    let visit = this.openVisit();
    if (!visit) {
      visit = {
        clientKey: newClientKey(),
        stageClientKey: leg.clientKey,
        sequence: this.turnCountIn(leg.clientKey) + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(visit);
    }

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

    const remainingBefore = this.remainingBeforeVisit(visit);
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = remainingBefore - thrown;
    const checkedOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
    } else {
      visit.totalScore = thrown;
      if (checkedOut || visit.darts.length === DARTS_PER_VISIT) {
        visit.completedAt = new Date().toISOString();
      }
    }

    const after = this.deriveState();
    if (checkedOut && after.status !== "WON") {
      this.stages.push(legStage(this.stages.length + 1));
    }

    return after;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted facts,
   * and removes the leg stage that visit opened. The stage only goes when the
   * popped turn belonged to an earlier leg — that is exactly the case where
   * `record()` appended a stage — so undoing a visit played inside a new leg
   * leaves that leg open. Under `VISUAL_BOARD`, one dart goes at a time:
   * popping a visit's only dart pops the visit itself, by the same rule;
   * popping one of several darts instead clears `completedAt` and recomputes
   * `totalScore` from the darts left behind, reopening the visit.
   * @returns true if a dart or a visit was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    if (this.inputMode === "VISUAL_BOARD") {
      return this.undoDart();
    }

    const removed = this.turns.pop();
    if (!removed) return false;

    const openLeg = this.stages.at(-1);
    if (
      this.stages.length > 1 &&
      openLeg &&
      openLeg.clientKey !== removed.stageClientKey
    ) {
      this.stages.pop();
    }
    return true;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();

    const openLeg = this.stages.at(-1);
    if (
      this.stages.length > 1 &&
      openLeg &&
      openLeg.clientKey !== visit.stageClientKey
    ) {
      this.stages.pop();
    }

    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
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
   * reject never completes it either.
   */
  wouldComplete(input: FiveOhOneInput): boolean {
    if (this.inputMode === "VISUAL_BOARD") {
      return this.wouldCompleteDart(input as DartObservation);
    }

    const visitInput = input as FiveOhOneVisitInput;
    if (
      !isPlayableVisitScore(
        visitInput.scoreAttempted,
        this.config.maxVisitScore,
      )
    ) {
      return false;
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    return (
      applyFiveOhOneVisit(before, visitInput, this.config).status === "WON"
    );
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
  FiveOhOneSnapshot,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  create(
    config: FiveOhOneSnapshot,
    prior?: EngineFacts,
    inputMode?: EngineInputMode,
  ) {
    return new FiveOhOneEngine(config, prior, inputMode);
  },
};

registerEngineFactory(fiveOhOneEngineFactory);
