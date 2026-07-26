import type { FiveOhOneSnapshot } from "@lib/game/rulesets/types";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  EngineFacts,
  FiveOhOneState,
  FiveOhOneVisitInput,
  FiveOhOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

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
 * remaining score untouched. `dartsAtDouble` counts darts thrown at a double
 * for analytics and is deliberately not consulted — only the dart that reached
 * zero decides the leg.
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
 * double-out finish are applied directly rather than branched on;
 * `config.maxDartsPerTurn` describes a visit the caller reports as a total, so
 * it constrains `dartsUsed` at the input's type level rather than here.
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
  FiveOhOneVisitInput,
  FiveOhOneState
> {
  readonly rulesetVersionKey = "501_V1";
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: FiveOhOneSnapshot,
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

  /**
   * Appends one visit to the open leg, then opens the next leg's stage when
   * that visit won a leg and the match continues. Stages and turns move
   * together so the log never holds a turn without its stage.
   * @throws when the score is out of range or the session has already ended;
   *   the fact log is left untouched.
   */
  record(input: FiveOhOneVisitInput): FiveOhOneState {
    const before = this.deriveState();
    const after = applyFiveOhOneVisit(before, input, this.config);
    const outcome = resolveFiveOhOneVisit(before.remainingScore, input);

    const leg = this.openLeg();
    this.turns.push({
      clientKey: crypto.randomUUID(),
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
   * Pops the last recorded visit, including one replayed from persisted facts,
   * and removes the leg stage that visit opened. The stage only goes when the
   * popped turn belonged to an earlier leg — that is exactly the case where
   * `record()` appended a stage — so undoing a visit played inside a new leg
   * leaves that leg open.
   * @returns true if a visit was removed; false if there was nothing to undo.
   */
  undo(): boolean {
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

  /**
   * Answers the finish-confirm gate without touching the fact log. Only the
   * checkout that takes `legsWon` to `legsToWin` completes the session — a
   * checkout that merely wins a leg does not — and a visit `record()` would
   * reject never completes it either.
   */
  wouldComplete(input: FiveOhOneVisitInput): boolean {
    if (
      !isPlayableVisitScore(input.scoreAttempted, this.config.maxVisitScore)
    ) {
      return false;
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

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
  FiveOhOneSnapshot,
  FiveOhOneVisitInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  create(config: FiveOhOneSnapshot, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior);
  },
};

registerEngineFactory(fiveOhOneEngineFactory);
