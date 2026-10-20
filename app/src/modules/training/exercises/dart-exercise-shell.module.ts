import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
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
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";

/**
 * Builds a `DartExerciseEngine` class over one `EXERCISE_BLOCK` stage.
 * Complete only once `expireTimer()` is called; `undo()` first reverses an
 * expiry, then pops one dart.
 */
export function dartExerciseEngineClass<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
): DartExerciseEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class implements TimedDartExerciseEngine<TConfig, TState> {
    readonly spec = spec;
    readonly exerciseRulesetVersionKey = spec.exerciseRulesetVersionKey;
    private readonly config: TConfig;
    private readonly turns: TurnFact[];
    private expired = false;

    constructor(config: TConfig, prior?: EngineFacts) {
      this.config = spec.parse(config);
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }

    private deriveState(): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns: this.turns },
        this.config,
        this.expired,
      );
    }

    record(observation: DartObservation): TState {
      refuseWhenEnded(this.expired, "exercise is complete");
      const intent = spec.intent(this.deriveState(), this.config);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        SOLO_PARTICIPANT_REF,
        spec.isVisitOpen,
      );
      appendObservedDart(turn, observation, intent);
      if (!spec.isVisitOpen(turn)) turn.completedAt = new Date().toISOString();
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
      return this.expired;
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: [{ ...stage }], turns: cloneTurns(this.turns) };
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
