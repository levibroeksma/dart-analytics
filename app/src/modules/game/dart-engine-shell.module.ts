import type { RulesetVersionKey } from "@lib/types";
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
 * `undo()` pops one dart (`undoLastDart`) and leaves an expired timer set;
 * a rehydrated engine starts unexpired. `completedAt` is stamped when
 * `isVisitOpen` reads false on the state after the dart. `isComplete()` is
 * any status other than `IN_PROGRESS`.
 */
export function dartGameEngineClass<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
): DartGameEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class implements ShellGameEngine<TConfig, TState> {
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

    private deriveState(): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns: this.turns },
        this.config,
        this.timerExpired,
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
        (last) => spec.isVisitOpen(last, before),
      );
      appendObservedDart(turn, observation, spec.intent(before, this.config));
      const after = this.deriveState();
      if (spec.isVisitOpen(turn, after)) return after;
      turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }

    undo(): boolean {
      return undoLastDart(this.turns);
    }

    wouldComplete(observation: DartObservation): boolean {
      return spec.wouldComplete(this.deriveState(), observation, this.config);
    }

    expireTimer(): void {
      this.timerExpired = true;
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

/** The registry-facing factory for one ruleset key of a shell-built engine class (default: the spec's own key). */
export function dartGameEngineFactory<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
  Engine: DartGameEngineClass<TConfig, TState>,
  rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
): GameEngineFactory<TConfig, DartObservation, TState> {
  const served = [spec.rulesetVersionKey, ...(spec.rulesetVersionKeys ?? [])];
  if (!served.includes(rulesetVersionKey))
    throw new Error(`${rulesetVersionKey} is not served by this spec`);
  return {
    rulesetVersionKey,
    stageOwnership: spec.stageOwnership,
    create: (config, prior) => new Engine(config, prior, rulesetVersionKey),
  };
}
