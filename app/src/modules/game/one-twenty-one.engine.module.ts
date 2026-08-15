import type { OneTwentyOneSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  EngineFacts,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const MAX_VISIT_SCORE = 180;

/**
 * Builds the `ROUND` stage for attempt `sequence`. Rounds are root stages —
 * 121 has no enclosing MATCH or SET stage, so every round's `parentClientKey`
 * is null and its `sequence` is its position in the session.
 */
function roundStage(sequence: number): StageFact {
  return {
    clientKey: `round-${sequence}`,
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/** A visit score is playable only as a whole number in `0..180`. */
function isPlayableVisitScore(scoreAttempted: number): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= MAX_VISIT_SCORE
  );
}

export function initialOneTwentyOneState(): OneTwentyOneState {
  return {
    currentTarget: START_TARGET,
    remainingInAttempt: START_TARGET,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * Resolves one visit against the remaining score of the attempt in play,
 * under the same bust matrix 501 uses: an overshoot busts; leaving exactly 1
 * busts because 1 cannot be finished on a double (D1 = 2); reaching exactly 0
 * busts unless the visit declares `finishedOnDouble`. A bust scores 0 and
 * leaves the remaining score untouched.
 */
function resolveOneTwentyOneVisit(
  remainingInAttempt: number,
  input: OneTwentyOneVisitInput,
): OneTwentyOneVisitOutcome {
  const wouldRemain = remainingInAttempt - input.scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && input.finishedOnDouble !== true);

  if (isBust) {
    return {
      isBust: true,
      scored: 0,
      checkedOut: false,
      remainingAfter: remainingInAttempt,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    checkedOut: reachedZero,
    remainingAfter: wouldRemain,
  };
}

/**
 * Pure reducer: folds one visit onto a `OneTwentyOneState`. A checkout at the
 * cap target (170) wins the session; any other checkout climbs the target by
 * one and opens a fresh 3-visit budget. A visit that neither checks out nor
 * is the attempt's 3rd carries its remaining score to the next visit in the
 * same attempt. The 3rd non-checkout visit applies the v1 fail rule — stay on
 * the same target with a fresh budget — whether that visit busted or simply
 * fell short.
 * @throws when the session is already complete, or when `scoreAttempted` is
 *   not a whole number within `0..180`; the caller's state is left untouched
 *   either way.
 */
export function applyOneTwentyOneVisit(
  state: OneTwentyOneState,
  input: OneTwentyOneVisitInput,
): OneTwentyOneState {
  if (!isPlayableVisitScore(input.scoreAttempted)) {
    throw new Error(`Enter a score between 0 and ${MAX_VISIT_SCORE}.`);
  }
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the session is complete; undo first to correct it.",
    );
  }

  const outcome = resolveOneTwentyOneVisit(state.remainingInAttempt, input);

  if (outcome.checkedOut) {
    if (state.currentTarget === CAP_TARGET) {
      return {
        currentTarget: state.currentTarget,
        remainingInAttempt: 0,
        visitsThisAttempt: 0,
        status: "WON",
      };
    }
    const nextTarget = state.currentTarget + 1;
    return {
      currentTarget: nextTarget,
      remainingInAttempt: nextTarget,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
  }

  const visitsThisAttempt = state.visitsThisAttempt + 1;
  if (visitsThisAttempt < VISITS_PER_ATTEMPT) {
    return {
      ...state,
      remainingInAttempt: outcome.remainingAfter,
      visitsThisAttempt,
    };
  }

  return {
    currentTarget: state.currentTarget,
    remainingInAttempt: state.currentTarget,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * 121: a checkout ladder from 121 to 170, each target attempted in up to 3
 * visits (9 darts) and won by a visit whose final dart lands in a double. The
 * engine owns the fact log — one `ROUND` stage per attempt and one turn per
 * visit, carrying the visit total with no dart rows because 121 is a
 * quick-score game. `currentTarget`, `remainingInAttempt` and
 * `visitsThisAttempt` are derived by folding those turns through
 * `applyOneTwentyOneVisit`, never accumulated: a bust turn stores
 * `totalScore: 0`, so replaying the log reproduces the ladder exactly.
 */
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneVisitInput,
  OneTwentyOneState
> {
  readonly rulesetVersionKey = "121_V1";
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: OneTwentyOneSnapshot,
    prior?: EngineFacts,
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [roundStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Replays every recorded turn as the visit that produced it. A turn's
   * `totalScore` is what actually counted, so a bust replays as a scoreless
   * visit and only a genuine checkout can bring a visit to zero — which is
   * why `finishedOnDouble` is safe to assert on replay.
   */
  private deriveState(): OneTwentyOneState {
    let state = initialOneTwentyOneState();
    for (const turn of this.turns) {
      state = applyOneTwentyOneVisit(state, {
        scoreAttempted: turn.totalScore,
        finishedOnDouble: true,
      });
    }
    return state;
  }

  private openRound(): StageFact {
    const stage = this.stages.at(-1);
    if (!stage) {
      throw new Error("A 121 engine always has an open round stage.");
    }
    return stage;
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey)
      .length;
  }

  /**
   * Appends one visit to the open round, then opens the next round's stage
   * when that visit resolved the attempt (checkout or a 3rd non-checkout) and
   * the session continues. Stages and turns move together so the log never
   * holds a turn without its stage.
   * @throws when the score is out of range or the session has already ended;
   *   the fact log is left untouched.
   */
  record(input: OneTwentyOneVisitInput): OneTwentyOneState {
    const before = this.deriveState();
    const after = applyOneTwentyOneVisit(before, input);
    const outcome = resolveOneTwentyOneVisit(before.remainingInAttempt, input);

    const round = this.openRound();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    if (after.visitsThisAttempt === 0 && after.status === "IN_PROGRESS") {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return after;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted
   * facts, and removes the round stage that visit opened. The stage only
   * goes when the popped turn belonged to an earlier round — that is exactly
   * the case where `record()` appended a stage — so undoing a visit played
   * inside a new round leaves that round open.
   * @returns true if a visit was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const removed = this.turns.pop();
    if (!removed) return false;

    this.popStageOpenedBy(removed.stageClientKey);
    return true;
  }

  /**
   * Pops the open round's stage when it was opened by the turn now being
   * undone — the same stage `record()` would have appended for that turn.
   */
  private popStageOpenedBy(stageClientKey: string): void {
    const openRound = this.stages.at(-1);
    if (
      this.stages.length > 1 &&
      openRound &&
      openRound.clientKey !== stageClientKey
    ) {
      this.stages.pop();
    }
  }

  /**
   * Answers whether recording `input` would win the session, without
   * mutating the fact log or the derived state. Only a checkout at the cap
   * target (170) can ever complete a 121 session.
   */
  wouldComplete(input: OneTwentyOneVisitInput): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;

    return applyOneTwentyOneVisit(before, input).status === "WON";
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): OneTwentyOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const oneTwentyOneEngineFactory: GameEngineFactory<
  OneTwentyOneSnapshot,
  OneTwentyOneVisitInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  create(config: OneTwentyOneSnapshot, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
