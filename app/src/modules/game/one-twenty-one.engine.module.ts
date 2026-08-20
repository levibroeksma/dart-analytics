import type { OneTwentyOneSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  OneTwentyOneInput,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const DARTS_PER_VISIT = 3;
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

/**
 * Discriminates `OneTwentyOneInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in — mirrors
 * `five-oh-one.engine.module.ts`'s `isDartObservation`.
 */
function isDartObservation(input: OneTwentyOneInput): input is DartObservation {
  return "hitZoneKey" in input;
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
 * Why the reported dart counts are impossible for the visit being recorded, or
 * null when they fit it. Mirrors 501's guard: only a claimed checkout is
 * checked against the chart, and the counts are never persisted — a 121 visit
 * carries no dart rows under quick score.
 */
function checkoutDartsRejectionFor(
  state: OneTwentyOneState,
  input: OneTwentyOneVisitInput,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    state.remainingInAttempt,
    input.dartsUsed,
    input.dartsAtDouble,
    DARTS_PER_VISIT,
  );
}

/**
 * Pure reducer: folds one FINISHED visit onto a `OneTwentyOneState`. A
 * checkout at the cap target (170) wins the session; any other checkout
 * climbs the target by one and opens a fresh 3-visit budget. A visit that
 * neither checks out nor is the attempt's 3rd carries its remaining score to
 * the next visit in the same attempt. The 3rd non-checkout visit applies the
 * v1 fail rule — stay on the same target with a fresh budget — whether that
 * visit busted or simply fell short.
 *
 * Callers must only fold a visit that has actually resolved (checked out,
 * busted, or reached its 3rd dart) — this always treats its input as a
 * finished visit and will prematurely count `visitsThisAttempt` for a visit
 * still being thrown. `OneTwentyOneEngine.deriveState()` enforces this split.
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
  const dartsRejection = checkoutDartsRejectionFor(state, input);
  if (dartsRejection) {
    throw new Error(dartsRejection);
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
 * visits (9 darts) and won by a visit whose final dart lands in a double.
 * Under QUICK_SCORE the engine owns one turn per visit, carrying the visit
 * total with no dart rows. Under VISUAL_BOARD it owns one dart at a time,
 * exactly mirroring `FiveOhOneEngine`'s dual-shape `record()` — see this
 * file's own `deriveState()` for why 121's derivation cannot simply copy
 * 501's (the per-round visit cap 501 does not have).
 */
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneInput,
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
   * Folds every CLOSED turn as the finished visit that produced it. Never
   * called with an open turn — `deriveState()` is the only caller and keeps
   * an open turn out of this fold on purpose.
   */
  private deriveClosedState(turns: readonly TurnFact[]): OneTwentyOneState {
    return turns
      .filter((turn) => turn.completedAt !== null)
      .reduce(
        (state, turn) =>
          applyOneTwentyOneVisit(state, {
            scoreAttempted: turn.totalScore,
            finishedOnDouble: true,
          }),
        initialOneTwentyOneState(),
      );
  }

  /**
   * The full derived state: every closed visit folded in full (this is
   * where `currentTarget`/`visitsThisAttempt`/`status` come from), with the
   * currently open visit's running total (if any) overlaid onto
   * `remainingInAttempt` only — a live countdown as darts land, without
   * counting an unfinished visit against the round's 3-visit budget. A
   * keypad-only game log never has an open turn (`recordVisitTotal` always
   * stamps `completedAt` immediately), so this is byte-identical to folding
   * every turn for a pure keypad session.
   */
  private deriveState(): OneTwentyOneState {
    const state = this.deriveClosedState(this.turns);
    const open = this.openVisit();
    if (!open) return state;
    return {
      ...state,
      remainingInAttempt: state.remainingInAttempt - open.totalScore,
    };
  }

  /**
   * Classifies one board observation into the target, zone, and score it
   * struck. A miss carries no coordinates, so it resolves to a scoreless
   * `MISS` hit using the observation's own zone key rather than going
   * through `classify()` — mirrors `five-oh-one.engine.module.ts`.
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

  /** The visit still being thrown, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /** Appends an empty visit to the open round and returns it. */
  private openNewVisit(): TurnFact {
    const round = this.openRound();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * What the attempt's remaining score was immediately before `visit`
   * opened — every turn strictly before `visit` in `this.turns` is always
   * already closed (an engine only ever has one open turn, the last one),
   * so folding them through `deriveClosedState` is safe and exact.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return this.deriveClosedState(this.turns.slice(0, index))
      .remainingInAttempt;
  }

  /**
   * Appends one visit to the open round, then opens the next round's stage
   * when that visit resolved the attempt (checkout or a 3rd non-checkout)
   * and the session continues. Stages and turns move together so the log
   * never holds a turn without its stage.
   * @throws when the score is out of range or the session has already
   *   ended; the fact log is left untouched.
   */
  private recordVisitTotal(input: OneTwentyOneVisitInput): OneTwentyOneState {
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
   * Applies the bust and checkout rules to a visit that just took a dart,
   * and stamps `completedAt` when the visit resolves.
   * @returns whether this dart resolved (closed) the visit — the caller
   *   uses this, not merely "the round changed", to decide whether to open
   *   a new round stage, since an already-in-progress round's
   *   `visitsThisAttempt` can coincidentally read 0 before the round's very
   *   first visit has even closed.
   */
  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const resolved = checkedOut || visit.darts.length === DARTS_PER_VISIT;
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on
   * a double, or on the third dart — mirrors
   * `five-oh-one.engine.module.ts`'s `recordDart`, adapted for the round
   * boundary (see class-level doc).
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): OneTwentyOneState {
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

    const visitResolved = this.settleVisit(visit);

    const after = this.deriveState();
    if (
      visitResolved &&
      after.visitsThisAttempt === 0 &&
      after.status === "IN_PROGRESS"
    ) {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return after;
  }

  record(input: OneTwentyOneInput): OneTwentyOneState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * Pops the last recorded visit or dart, including one replayed from
   * persisted facts. Dispatches on the shape of the last recorded turn — a
   * turn built from a keypad total always has `darts: []`; a turn built
   * from a board dart always holds at least one dart from the moment it
   * exists in the log — mirrors `five-oh-one.engine.module.ts`'s `undo`.
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
   * Whether the dart under consideration would check out the cap target —
   * the one way a 121 session can complete on a single dart.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const resolved = this.resolveObservation(observation);
    const remainingAfter = before.remainingInAttempt - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    return checksOut && before.currentTarget === CAP_TARGET;
  }

  /**
   * Answers whether recording `input` would win the session, without
   * mutating the fact log or the derived state. Only a checkout at the cap
   * target (170) can ever complete a 121 session.
   */
  wouldComplete(input: OneTwentyOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;
    if (checkoutDartsRejectionFor(before, input) !== null) return false;

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
  OneTwentyOneInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  create(config: OneTwentyOneSnapshot, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
