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
  undoStagedTurn,
  sumDartScores,
} from "./turn-log.module";
import type {
  DartObservation,
  EngineFacts,
  ShellState,
  StageFact,
  TurnFact,
} from "./types";

/**
 * Builds a `GameEngine` class from `spec`, over one `EXERCISE_BLOCK` stage
 * unless `stageFor` names the stage each state plays in.
 * `undo()` pops one dart (`undoLastDart`) and leaves an expired timer set;
 * a rehydrated engine starts unexpired. `completedAt` is stamped when
 * `isVisitOpen` reads false on the state after the dart; a spec with
 * `closedVisitTotal` then sets that turn's `totalScore`. A spec with
 * `visitInput` writes a keypad total as one closed dartless turn and undoes
 * whole turns; `coordinateCapture` resolves each dart from its coordinates
 * instead of its hit fields, leaving an open turn's total unwritten unless
 * `liveTotal` writes the darts' sum; `complete` replaces the default
 * `isComplete()` (any status other than `IN_PROGRESS`) and reads the state
 * when `expireTimer()` first ran. `stageFor` opens a new stage after a closing
 * record, counts turn `sequence` within each stage, and undoes with
 * `undoStagedTurn`.
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
    private readonly stages: StageFact[];
    private timerExpired = false;
    private expiredAt: TState | null = null;

    constructor(
      private readonly config: TConfig,
      prior?: EngineFacts,
      rulesetVersionKey: RulesetVersionKey = spec.rulesetVersionKey,
    ) {
      this.rulesetVersionKey = rulesetVersionKey;
      this.turns = prior ? cloneTurns(prior.turns) : [];
      this.stages =
        prior && prior.stages.length > 0
          ? prior.stages.map((s) => ({ ...s }))
          : [this.firstStage()];
    }

    private firstStage(): StageFact {
      if (!spec.stageFor) return { ...stage };
      return spec.stageFor(
        spec.fold({ stages: [{ ...stage }], turns: [] }, this.config, false),
      );
    }

    private copyStages(): StageFact[] {
      return this.stages.map((s) => ({ ...s }));
    }

    private openStageKey(): string {
      return this.stages.at(-1)!.clientKey;
    }

    private foldTurns(turns: TurnFact[]): TState {
      return spec.fold(
        { stages: this.copyStages(), turns },
        this.config,
        this.timerExpired,
      );
    }

    private numberInStage(turn: TurnFact): void {
      if (!spec.stageFor) return;
      turn.sequence = this.turns.filter(
        (t) => t.stageClientKey === turn.stageClientKey,
      ).length;
    }

    private syncStage(): void {
      const next = spec.stageFor?.(this.deriveState());
      if (next && next.clientKey !== this.openStageKey())
        this.stages.push({ ...next });
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
      const turn = appendCompletedTurn(
        this.turns,
        this.openStageKey(),
        before.activeParticipantRef,
        spec.visitInput!.total(before, input),
      );
      this.numberInStage(turn);
      this.syncStage();
      return this.deriveState();
    }

    private recordDart(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const count = this.turns.length;
      const turn = openOrCreateTurn(
        this.turns,
        this.openStageKey(),
        before.activeParticipantRef,
        (last) => spec.isVisitOpen(last, before, this.config),
      );
      if (this.turns.length > count) this.numberInStage(turn);
      if (spec.coordinateCapture) {
        appendResolvedDart(turn, observation, resolveObservation(observation));
        if (spec.liveTotal) turn.totalScore = sumDartScores(turn.darts);
      } else
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
      this.syncStage();
      return this.deriveState();
    }

    undo(): boolean {
      if (spec.stageFor) return undoStagedTurn(this.turns, this.stages);
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
      this.expiredAt ??= this.deriveState();
      this.timerExpired = true;
    }

    isComplete(): boolean {
      const state = this.deriveState();
      return spec.complete
        ? spec.complete(state, this.config, this.expiredAt)
        : state.status !== "IN_PROGRESS";
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: this.copyStages(), turns: cloneTurns(this.turns) };
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
