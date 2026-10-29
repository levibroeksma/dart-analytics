import type {
  CricketSnapshot,
  RulesetVersionKey,
  SeatFact,
  Seated,
  TacticsSnapshot,
} from "@lib/types";
import {
  applyMarksDart,
  DARTS_PER_VISIT,
  initialMarksSeat,
  MARKS_TO_CLOSE,
  tallyMarksDart,
} from "@modules/game/marks-close.module";
import {
  CRICKET_OBJECTIVES,
  cricketMarksOf,
} from "@modules/game/cricket.engine.module";
import {
  TACTICS_OBJECTIVES,
  tacticsMarksOf,
} from "@modules/game/tactics.engine.module";
import { activeSeat, seatOf } from "@modules/game/seat-rota.module";
import { foldSeatStates, toObservation } from "@modules/game/seat-state.module";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  refuseWhenEnded,
  undoLastDart,
} from "@modules/game/turn-log.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  EngineFacts,
  MarksDuelSeat,
  MarksGameState,
  MarksHit,
  MarksSeatState,
  MultiSeatState,
  TacticsSeatState,
  TacticsState,
  TurnFact,
} from "@modules/types";

/*
 * Frozen copy of `MarksEngine`, `recordMarksDart`, `foldMarksSeats`,
 * `foldMarksDuel` and `applyDuelDart` as they stood before the rebind onto
 * the marks kernel and the game shell. Deleted once the goldens hold.
 */

type LegacyDuelSpec<TSeat extends MarksDuelSeat> = {
  initialSeat: (seat: SeatFact) => TSeat;
  hitOf: (
    seat: TSeat,
    opponent: TSeat,
    observation: DartObservation,
  ) => MarksHit;
  valueOf: (objectiveIndex: number) => number | null;
};

const STAGE = exerciseBlockStage();

function recordMarksDart<TState extends MultiSeatState<MarksSeatState>>(
  turns: TurnFact[],
  stageClientKey: string,
  observation: DartObservation,
  derive: () => TState,
  isEnded: (state: TState) => boolean,
): TState {
  const before = derive();
  refuseWhenEnded(isEnded(before), "game has ended");
  const openTurn = openOrCreateTurn(
    turns,
    stageClientKey,
    before.activeParticipantRef,
    (last) => last.completedAt === null && last.darts.length < DARTS_PER_VISIT,
  );
  appendObservedDart(openTurn, observation);
  if (openTurn.darts.length === DARTS_PER_VISIT || isEnded(derive())) {
    openTurn.completedAt = new Date().toISOString();
  }
  return derive();
}

function applyDuelDart<TSeat extends MarksDuelSeat>(
  seat: TSeat,
  opponent: TSeat,
  hit: MarksHit,
  valueOf: (objectiveIndex: number) => number | null,
): TSeat {
  const { fields, spare } = tallyMarksDart(seat, hit);
  const value =
    hit && opponent.marks[hit.objectiveIndex] < MARKS_TO_CLOSE
      ? valueOf(hit.objectiveIndex)
      : null;
  const visitDarts = seat.dartsThisVisit + 1;
  return {
    ...seat,
    ...fields,
    points: seat.points + (value === null ? 0 : spare * value),
    dartsThisVisit: visitDarts === DARTS_PER_VISIT ? 0 : visitDarts,
    status: fields.marks.every((count) => count === MARKS_TO_CLOSE)
      ? "COMPLETE"
      : "IN_PROGRESS",
  };
}

function foldMarksDuel<TSeat extends MarksDuelSeat>(
  turns: readonly TurnFact[],
  seats: readonly [SeatFact, SeatFact],
  spec: LegacyDuelSpec<TSeat>,
): { seats: TSeat[]; winnerParticipantRef: string | null } {
  const states = seats.map(spec.initialSeat);
  let winnerParticipantRef: string | null = null;
  for (const turn of turns) {
    const index = seats.indexOf(seatOf(turn, seats));
    for (const dart of turn.darts) {
      refuseWhenEnded(winnerParticipantRef !== null, "game has ended");
      const opponent = states[1 - index];
      const next = applyDuelDart(
        states[index],
        opponent,
        spec.hitOf(states[index], opponent, toObservation(dart)),
        spec.valueOf,
      );
      states[index] = next;
      if (next.status === "COMPLETE" && next.points >= opponent.points) {
        states[index] = { ...next, dartsThisVisit: 0 };
        winnerParticipantRef = next.participantRef;
      }
    }
  }
  return { seats: states, winnerParticipantRef };
}

function foldMarksSeats<TSeat extends MarksDuelSeat>(
  facts: EngineFacts,
  seats: readonly SeatFact[],
  spec: LegacyDuelSpec<TSeat>,
  applyDart: (seat: TSeat, observation: DartObservation) => TSeat,
): MarksGameState<TSeat> {
  const turnParticipantRef = activeSeat(
    facts,
    seats,
    "PER_SEAT",
  ).participantRef;
  if (seats.length === 2) {
    const duel = foldMarksDuel(facts.turns, [seats[0], seats[1]], spec);
    return {
      activeParticipantRef: duel.winnerParticipantRef ?? turnParticipantRef,
      status: duel.winnerParticipantRef === null ? "IN_PROGRESS" : "COMPLETE",
      winnerParticipantRef: duel.winnerParticipantRef,
      seats: duel.seats,
    };
  }
  const folded = foldSeatStates(
    facts.turns,
    seats,
    spec.initialSeat,
    applyDart,
  );
  return {
    activeParticipantRef: turnParticipantRef,
    status: folded.every((seat) => seat.status === "COMPLETE")
      ? "COMPLETE"
      : "IN_PROGRESS",
    winnerParticipantRef: null,
    seats: folded,
  };
}

abstract class LegacyMarksEngine<
  TConfig,
  TState extends MultiSeatState<MarksSeatState> & {
    status: "IN_PROGRESS" | "COMPLETE";
  },
> implements GameEngine<DartObservation, TState> {
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  protected constructor(
    protected readonly config: TConfig,
    prior: EngineFacts | undefined,
    readonly rulesetVersionKey: RulesetVersionKey,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  protected abstract fold(facts: EngineFacts): TState;

  protected abstract fork(): LegacyMarksEngine<TConfig, TState>;

  record(observation: DartObservation): TState {
    return recordMarksDart(
      this.turns,
      STAGE.clientKey,
      observation,
      () => this.state(),
      (state) => state.status === "COMPLETE",
    );
  }

  undo(): boolean {
    return undoLastDart(this.turns);
  }

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

const tacticsSeat = (seat: SeatFact): TacticsSeatState => ({
  ...initialMarksSeat(seat, TACTICS_OBJECTIVES.length),
  points: 0,
});

const TACTICS_DUEL: LegacyDuelSpec<TacticsSeatState> = {
  initialSeat: tacticsSeat,
  hitOf: (seat, opponent, observation) =>
    tacticsMarksOf(
      seat,
      observation,
      (index) => opponent.marks[index] < MARKS_TO_CLOSE,
    ),
  valueOf: (index) => {
    const objective = TACTICS_OBJECTIVES[index];
    return typeof objective === "number" ? objective : null;
  },
};

export class LegacyTacticsEngine extends LegacyMarksEngine<
  Seated<TacticsSnapshot>,
  TacticsState
> {
  constructor(
    config: Seated<TacticsSnapshot>,
    prior?: EngineFacts,
    rulesetVersionKey: RulesetVersionKey = "TACTICS_V1",
  ) {
    super(config, prior, rulesetVersionKey);
  }

  protected fold(facts: EngineFacts): TacticsState {
    return foldMarksSeats(facts, this.config.seats, TACTICS_DUEL, (s, o) => ({
      ...s,
      ...applyMarksDart(s, tacticsMarksOf(s, o)),
    }));
  }

  protected fork(): LegacyTacticsEngine {
    return new LegacyTacticsEngine(
      this.config,
      this.facts(),
      this.rulesetVersionKey,
    );
  }
}

const cricketSeat = (seat: SeatFact): CricketSeatState => ({
  ...initialMarksSeat(seat, CRICKET_OBJECTIVES.length),
  points: 0,
});

const CRICKET_DUEL: LegacyDuelSpec<CricketSeatState> = {
  initialSeat: cricketSeat,
  hitOf: (_seat, _opponent, observation) => cricketMarksOf(observation),
  valueOf: (index) => CRICKET_OBJECTIVES[index],
};

export class LegacyCricketEngine extends LegacyMarksEngine<
  Seated<CricketSnapshot>,
  CricketState
> {
  constructor(
    config: Seated<CricketSnapshot>,
    prior?: EngineFacts,
    rulesetVersionKey: RulesetVersionKey = "CRICKET_V1",
  ) {
    super(config, prior, rulesetVersionKey);
  }

  protected fold(facts: EngineFacts): CricketState {
    return foldMarksSeats(facts, this.config.seats, CRICKET_DUEL, (s, o) => ({
      ...s,
      ...applyMarksDart(s, cricketMarksOf(o)),
    }));
  }

  protected fork(): LegacyCricketEngine {
    return new LegacyCricketEngine(
      this.config,
      this.facts(),
      this.rulesetVersionKey,
    );
  }
}
