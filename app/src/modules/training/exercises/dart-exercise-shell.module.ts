import type {
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "@modules/types";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  refuseWhenEnded,
  undoLastDart,
} from "@modules/game/turn-log.module";
import type {
  DartExerciseEngineClass,
  DartExerciseEngineFactory,
  DartExerciseSpec,
  TimedDartExerciseEngine,
} from "./interfaces";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";

/** The engine every shell-built exercise class extends: one spec, one block stage, the recorded turns. */
class DartShellExerciseEngine<
  TConfig,
  TState,
> implements TimedDartExerciseEngine<TConfig, TState> {
  readonly exerciseRulesetVersionKey: DartExerciseSpec<
    TConfig,
    TState
  >["exerciseRulesetVersionKey"];
  private readonly config: TConfig;
  private readonly turns: TurnFact[];
  private expired = false;

  constructor(
    readonly spec: DartExerciseSpec<TConfig, TState>,
    private readonly blockStage: StageFact,
    config: TConfig,
    prior?: EngineFacts,
  ) {
    this.exerciseRulesetVersionKey = spec.exerciseRulesetVersionKey;
    this.config = spec.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): TState {
    return this.spec.fold(
      { stages: [{ ...this.blockStage }], turns: this.turns },
      this.config,
      this.expired,
    );
  }

  record(observation: DartObservation): TState {
    refuseWhenEnded(this.isComplete(), "exercise is complete");
    const before = this.deriveState();
    const intent = this.spec.intent(before, this.config);
    const turn = openOrCreateTurn(
      this.turns,
      this.blockStage.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => this.spec.isVisitOpen(last, before),
    );
    appendObservedDart(turn, observation, intent);
    if (!this.spec.isVisitOpen(turn, this.deriveState()))
      turn.completedAt = new Date().toISOString();
    return this.deriveState();
  }

  undo(): boolean {
    if (this.expired) {
      this.expired = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  expireTimer(): void {
    this.expired = true;
  }

  isComplete(): boolean {
    return this.expired || (this.spec.ends?.(this.deriveState()) ?? false);
  }

  state(): TState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: [{ ...this.blockStage }],
      turns: cloneTurns(this.turns),
    };
  }
}

/**
 * Builds a `DartExerciseEngine` class over one `EXERCISE_BLOCK` stage.
 * Complete once `expireTimer()` is called or the spec's `ends` holds;
 * `undo()` first reverses an expiry, then pops one dart. `isVisitOpen`
 * sees the state folded before the dart (reuse the open turn) and after it
 * (close the turn).
 */
export function dartExerciseEngineClass<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
): DartExerciseEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class extends DartShellExerciseEngine<TConfig, TState> {
    constructor(config: TConfig, prior?: EngineFacts) {
      super(spec, stage, config, prior);
    }
  };
}

/** The registry-facing factory for a shell-built exercise class. */
export function dartExerciseEngineFactory<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
  Engine: DartExerciseEngineClass<TConfig, TState>,
): DartExerciseEngineFactory<TConfig, TState> {
  return {
    exerciseRulesetVersionKey: spec.exerciseRulesetVersionKey,
    create: (config, prior) => new Engine(config, prior),
  };
}

/**
 * Binds a shell-built exercise's class to its registry-facing factory,
 * registers the factory under the spec's ruleset key, and returns it with
 * the spec's fold.
 */
export function registerDartExercise<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
  Engine: DartExerciseEngineClass<TConfig, TState>,
): {
  factory: DartExerciseEngineFactory<TConfig, TState>;
  fold: DartExerciseSpec<TConfig, TState>["fold"];
} {
  const factory = dartExerciseEngineFactory(spec, Engine);
  registerDartExerciseEngineFactory(factory);
  return { factory, fold: spec.fold };
}
