import type { RulesetVersionKey } from "@lib/types";
import type {
  DartGameEngineClass,
  DartGameSpec,
  GameEngineFactory,
  ShellGameEngine,
} from "./interfaces";
import {
  appendCompletedTurn,
  appendObservedDart,
  appendResolvedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  openVisit,
  resolveObservation,
  turnsBeforeVisit,
  undoLastDart,
  undoLastUnit,
} from "./turn-log.module";
import type {
  DartObservation,
  EngineFacts,
  ShellState,
  TurnFact,
} from "./types";

/**
 * Builds a `GameEngine` class over one `EXERCISE_BLOCK` stage from `spec`.
 * `undo()` pops one dart (`undoLastDart`) and leaves an expired timer set;
 * a rehydrated engine starts unexpired. `completedAt` is stamped when
 * `isVisitOpen` reads false on the state after the dart; a spec with
 * `closedVisitTotal` then sets that turn's `totalScore`. A spec with
 * `visitInput` writes a keypad total as one closed dartless turn and undoes
 * whole turns; `coordinateCapture` resolves each dart from its coordinates
 * instead of its hit fields, leaving an open turn's total unwritten; `complete`
 * replaces the default `isComplete()` (any status other than `IN_PROGRESS`).
 */
export function dartGameEngineClass<
  TConfig,
  TState extends ShellState,
  TVisit = never,
>(
  spec: DartGameSpec<TConfig, TState, TVisit>,
): DartGameEngineClass<TConfig, TState, DartObservation | TVisit> {
  const stage = exerciseBlockStage();
  return class implements ShellGameEngine<
    TConfig,
    TState,
    DartObservation | TVisit
  > {
    readonly spec = spec;
    readonly rulesetVersionKey: RulesetVersionKey;
    readonly stageOwnership = spec.stageOwnership;
    private readonly turns: TurnFact[];
    private timerExpired = false;

    constructor(
      private readonly config: TConfig,
      prior?: EngineFacts,
      rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
    ) {
      this.rulesetVersionKey = rulesetVersionKey;
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }

    private foldTurns(turns: TurnFact[]): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns },
        this.config,
        this.timerExpired,
      );
    }

    private deriveState(): TState {
      return this.foldTurns(this.turns);
    }

    record(input: DartObservation | TVisit): TState {
      if (spec.visitInput?.isVisit(input)) return this.recordVisit(input);
      return this.recordDart(input as DartObservation);
    }

    private recordVisit(input: TVisit): TState {
      const before = this.deriveState();
      const refusal = spec.visitInput!.refusal(
        before,
        input,
        this.config,
        openVisit(this.turns),
      );
      if (refusal !== null) throw new Error(refusal);
      appendCompletedTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        spec.visitInput!.total(before, input),
      );
      return this.deriveState();
    }

    private recordDart(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        (last) => spec.isVisitOpen(last, before, this.config),
      );
      if (spec.coordinateCapture)
        appendResolvedDart(turn, observation, resolveObservation(observation));
      else
        appendObservedDart(turn, observation, spec.intent(before, this.config));
      const after = this.deriveState();
      if (spec.isVisitOpen(turn, after, this.config)) return after;
      turn.completedAt = new Date().toISOString();
      if (spec.closedVisitTotal)
        turn.totalScore = spec.closedVisitTotal(
          this.foldTurns(turnsBeforeVisit(this.turns, turn)),
          this.deriveState(),
          turn.participantRef,
          turn,
          this.config,
        );
      return this.deriveState();
    }

    undo(): boolean {
      return spec.visitInput
        ? undoLastUnit(this.turns)
        : undoLastDart(this.turns);
    }

    wouldComplete(input: DartObservation | TVisit): boolean {
      return spec.wouldComplete(
        this.deriveState(),
        input,
        this.config,
        openVisit(this.turns),
      );
    }

    expireTimer(): void {
      this.timerExpired = true;
    }

    isComplete(): boolean {
      const state = this.deriveState();
      return spec.complete
        ? spec.complete(state, this.config)
        : state.status !== "IN_PROGRESS";
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: [{ ...stage }], turns: cloneTurns(this.turns) };
    }
  };
}

/** The registry-facing factory for one ruleset key of a shell-built engine class (default: the spec's own key). */
export function dartGameEngineFactory<
  TConfig,
  TState extends ShellState,
  TVisit = never,
>(
  spec: DartGameSpec<TConfig, TState, TVisit>,
  Engine: DartGameEngineClass<TConfig, TState, DartObservation | TVisit>,
  rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
): GameEngineFactory<TConfig, DartObservation | TVisit, TState> {
  const served = [spec.rulesetVersionKey, ...(spec.rulesetVersionKeys ?? [])];
  if (!served.includes(rulesetVersionKey))
    throw new Error(`${rulesetVersionKey} is not served by this spec`);
  return {
    rulesetVersionKey,
    stageOwnership: spec.stageOwnership,
    create: (config, prior) => new Engine(config, prior, rulesetVersionKey),
  };
}
