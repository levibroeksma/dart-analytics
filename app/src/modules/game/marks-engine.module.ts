import type { RulesetVersionKey } from "@lib/types";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import { recordMarksDart } from "./marks-close.module";
import {
  cloneTurns,
  exerciseBlockStage,
  undoLastDart,
} from "./turn-log.module";
import type {
  DartObservation,
  EngineFacts,
  MarksSeatState,
  MultiSeatState,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();

/**
 * The shared body of a marks engine (Cricket, Tactics): owns the fact log and
 * records, undoes and reports through it. A subclass supplies only how its
 * rules fold the log into state (`fold`) and how to copy itself (`fork`).
 */
export abstract class MarksEngine<
  TConfig,
  TState extends MultiSeatState<MarksSeatState> & {
    status: "IN_PROGRESS" | "COMPLETE";
  },
  TKey extends RulesetVersionKey = RulesetVersionKey,
> implements GameEngine<DartObservation, TState> {
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  protected constructor(
    protected readonly config: TConfig,
    prior: EngineFacts | undefined,
    readonly rulesetVersionKey: TKey,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  protected abstract fold(facts: EngineFacts): TState;

  protected abstract fork(): MarksEngine<TConfig, TState, TKey>;

  /**
   * Appends one dart to the open visit (`recordMarksDart`).
   * @throws when the game has already ended.
   */
  record(observation: DartObservation): TState {
    return recordMarksDart(
      this.turns,
      STAGE.clientKey,
      observation,
      () => this.state(),
      (state) => state.status === "COMPLETE",
    );
  }

  /** Pops the last dart; a surviving visit reopens (`undoLastDart`). */
  undo(): boolean {
    return undoLastDart(this.turns);
  }

  /** Whether `observation` would end the game, answered on a copy of the log. */
  wouldComplete(observation: DartObservation): boolean {
    try {
      return this.fork().record(observation).status === "COMPLETE";
    } catch {
      return false;
    }
  }

  isComplete(): boolean {
    return this.state().status !== "IN_PROGRESS";
  }

  state(): TState {
    return this.fold({ stages: [{ ...STAGE }], turns: this.turns });
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

/** The factory for one marks ruleset version; the literal key stays in the engine file for the wiring gate. */
export function marksEngineFactory<
  TConfig,
  TState,
  TKey extends RulesetVersionKey,
>(spec: {
  rulesetVersionKey: TKey;
  build: (
    config: TConfig,
    prior?: EngineFacts,
  ) => GameEngine<DartObservation, TState> & {
    rulesetVersionKey: NoInfer<TKey>;
  };
}): GameEngineFactory<TConfig, DartObservation, TState> {
  return {
    rulesetVersionKey: spec.rulesetVersionKey,
    stageOwnership: "PER_SEAT",
    create: spec.build,
  };
}
