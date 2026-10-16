import type {
  DartGameEngineClass,
  DartGameSpec,
  GameEngineFactory,
  ShellGameEngine,
} from "./interfaces";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import type {
  DartObservation,
  EngineFacts,
  ShellState,
  TurnFact,
} from "./types";

/**
 * Builds a `GameEngine` class over one `EXERCISE_BLOCK` stage from `spec`.
 * `undo()` pops one dart (`undoLastDart`); `isComplete()` is any status
 * other than `IN_PROGRESS`.
 */
export function dartGameEngineClass<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
): DartGameEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class implements ShellGameEngine<TConfig, TState> {
    readonly spec = spec;
    readonly rulesetVersionKey = spec.rulesetVersionKey;
    readonly stageOwnership = spec.stageOwnership;
    private readonly turns: TurnFact[];

    constructor(
      private readonly config: TConfig,
      prior?: EngineFacts,
    ) {
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }

    private deriveState(): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns: this.turns },
        this.config,
      );
    }

    record(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        spec.isVisitOpen,
      );
      appendObservedDart(turn, observation, spec.intent(before, this.config));
      if (!spec.isVisitOpen(turn)) turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }

    undo(): boolean {
      return undoLastDart(this.turns);
    }

    wouldComplete(observation: DartObservation): boolean {
      return spec.wouldComplete(this.deriveState(), observation, this.config);
    }

    isComplete(): boolean {
      return this.deriveState().status !== "IN_PROGRESS";
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: [{ ...stage }], turns: cloneTurns(this.turns) };
    }
  };
}

/** The registry-facing factory for a shell-built engine class. */
export function dartGameEngineFactory<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
  Engine: DartGameEngineClass<TConfig, TState>,
): GameEngineFactory<TConfig, DartObservation, TState> {
  return {
    rulesetVersionKey: spec.rulesetVersionKey,
    stageOwnership: spec.stageOwnership,
    create: (config, prior) => new Engine(config, prior),
  };
}
