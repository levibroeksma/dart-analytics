import { doublesPathTargetLabel } from "@lib/game/doubles-path-play";
import {
  activeTargetOf as clockTargetOf,
  applyAroundTheClockDart,
  isClockHit,
  rulesOf,
} from "@modules/game/around-the-clock.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { checkoutAttemptCount } from "@modules/game/checkout-bust.module";
import { foldSeatSteps } from "@modules/game/seat-state.module";
import { activeTargetOf as shanghaiTargetOf } from "@modules/game/shanghai.engine.module";
import {
  activeTargetOf as singlesTargetOf,
  applySinglesTrainingDart,
} from "@modules/game/singles-training.engine.module";
import type {
  AroundTheClockEngineConfig,
  DoublesTrainingSnapshot,
  GameTypeKey,
} from "@lib/types";
import type {
  AroundTheClockSeatState,
  BoardTarget,
  Bobs27SeatState,
  DartObservation,
  DoublesTrainingSeatState,
  FiveOhOneSeatState,
  FiveOhOneState,
  MultiSeatState,
  OneTwentyOneSeatState,
  ScoreTrainingSeatState,
  SeatState,
  ShanghaiSeatState,
  SinglesTrainingSeatState,
  TuodSeatState,
  TurnFact,
} from "@modules/types";
import type {
  ReplayCell,
  ReplayMark,
  ReplayPresenter,
  ReplaySessionLine,
  ReplaySnapshot,
  ReplayStep,
} from "./types";

type SinglesConfig = Parameters<typeof applySinglesTrainingDart>[0];

/** A seat whose game has a ladder target and an in-attempt countdown (121, TUOD). */
type LadderSeatState = OneTwentyOneSeatState | TuodSeatState;

const EMPTY_LINE: ReplaySessionLine = { entries: [], curves: [] };

function seatsOf<TSeat extends SeatState>(state: unknown): readonly TSeat[] {
  return (state as MultiSeatState<TSeat>).seats;
}

/**
 * The seat `participantId` holds in a replayed state.
 * @throws when it holds none -- `foldReplay` only yields steps whose every
 *   turn's participant is seated.
 */
function seatIn<TSeat extends SeatState>(
  state: unknown,
  participantId: string,
): TSeat {
  const seat = seatsOf<TSeat>(state).find(
    (candidate) => candidate.participantRef === participantId,
  );
  if (!seat) throw new Error(`No seat for participant ${participantId}.`);
  return seat;
}

function valueCell(label: string, value: string | number): ReplayCell {
  return { kind: "value", label, value: String(value) };
}

function hitsCell(hits: readonly boolean[]): ReplayCell {
  return {
    kind: "marks",
    label: "Hits",
    marks: hits.map((hit): ReplayMark => (hit ? "hit" : "miss")),
  };
}

/** The number-or-BULL label the Singles, Shanghai and Around the Clock play pages show. */
function targetLabel(target: BoardTarget): string {
  return target.kind === "BULL" ? "BULL" : String(target.number);
}

/** A seat's final progress: the target it stopped at, or its finished status. */
function progressLabel(status: string, target: string): string {
  return status === "IN_PROGRESS"
    ? target
    : status.charAt(0) + status.slice(1).toLowerCase();
}

function observationsOf(turn: TurnFact): DartObservation[] {
  return turn.darts.map((dart) => ({
    hitTargetNumber: dart.hitTargetNumber,
    hitZoneKey: dart.hitZoneKey,
    locationX: dart.locationX,
    locationY: dart.locationY,
  }));
}

/** One entry per seat, read off the state after the session's last loaded turn. */
function finalLine<TSeat extends SeatState>(
  steps: readonly ReplayStep[],
  label: string,
  read: (seat: TSeat) => string | number,
): ReplaySessionLine {
  const last = steps.at(-1);
  if (!last) return EMPTY_LINE;
  return {
    entries: seatsOf<TSeat>(last.after).map((seat) => ({
      participantId: seat.participantRef,
      label,
      value: String(read(seat)),
    })),
    curves: [],
  };
}

function legsWonIn(state: unknown): number {
  return (state as FiveOhOneState).sides.reduce(
    (sum, side) => sum + side.legsWon,
    0,
  );
}

/**
 * 501, read as `five-oh-one-play.data.ts` does (`remainingScoreFor`,
 * `legsWonFor`). A bust is the visit its engine counted as zero though its
 * darts scored (`checkoutAttemptCount`), so a keypad visit, which has no
 * darts, is never flagged.
 */
const FIVE_OH_ONE: ReplayPresenter = {
  turn({ turn, after }) {
    const seat = seatIn<FiveOhOneSeatState>(after, turn.participantRef);
    const remaining = valueCell("Remaining", seat.remainingScore);
    return checkoutAttemptCount([turn]) > 0
      ? [remaining, { kind: "flag", label: "Bust" }]
      : [remaining];
  },
  session(steps) {
    const legWins = steps.filter(
      ({ before, after }) => legsWonIn(after) > legsWonIn(before),
    );
    return {
      entries: legWins.map(({ turn }, index) => ({
        participantId: turn.participantRef,
        label: `Leg ${index + 1}`,
        value: "Won",
      })),
      curves: [],
    };
  },
};

/** 121 and TUOD, read as their play pages do (`currentTargetLabelFor`, `remainingInAttemptFor`). */
const LADDER: ReplayPresenter = {
  turn({ turn, after }) {
    const seat = seatIn<LadderSeatState>(after, turn.participantRef);
    return [
      valueCell("Target", seat.currentTarget),
      valueCell("Remaining", seat.remainingInAttempt),
    ];
  },
  session: (steps) =>
    finalLine<LadderSeatState>(
      steps,
      "Final target",
      (seat) => seat.currentTarget,
    ),
};

/** Score Training, read as `score-training-play.data.ts` does (`totalScoreFor`). */
const SCORE_TRAINING: ReplayPresenter = {
  turn({ turn, after }) {
    const seat = seatIn<ScoreTrainingSeatState>(after, turn.participantRef);
    return [valueCell("Total", seat.totalScore)];
  },
  session: (steps) =>
    finalLine<ScoreTrainingSeatState>(
      steps,
      "Total",
      (seat) => seat.totalScore,
    ),
};

/**
 * Bob's 27, read as `bobs27-play.data.ts` does (the seat's `score`). The
 * session curve is each seat's score after every visit it threw.
 */
const BOBS27: ReplayPresenter = {
  turn({ turn, after }) {
    const seat = seatIn<Bobs27SeatState>(after, turn.participantRef);
    return [valueCell("Score", seat.score)];
  },
  session(steps) {
    const line = finalLine<Bobs27SeatState>(
      steps,
      "Score",
      (seat) => seat.score,
    );
    return {
      entries: line.entries,
      curves: line.entries.map(({ participantId }) => ({
        participantId,
        points: steps
          .filter(({ turn }) => turn.participantRef === participantId)
          .map(({ after }) => seatIn<Bobs27SeatState>(after, participantId))
          .map((seat) => seat.score),
      })),
    };
  },
};

/**
 * Singles Training, read as `singles-training-play.data.ts` does
 * (`currentTargetLabelFor`; a dart is a hit when it scored, as its preview
 * marks it), each dart replayed from the seat's state before the visit.
 */
const SINGLES: ReplayPresenter = {
  turn({ turn, before, after }, snapshot) {
    const config = snapshot as unknown as SinglesConfig;
    const steps = foldSeatSteps(
      observationsOf(turn),
      seatIn<SinglesTrainingSeatState>(before, turn.participantRef),
      (state, observation) =>
        applySinglesTrainingDart(config, state, observation),
    );
    const seat = seatIn<SinglesTrainingSeatState>(after, turn.participantRef);
    return [
      valueCell("Target", targetLabel(singlesTargetOf(seat, config))),
      hitsCell(
        steps.map((step) => step.after.totalPoints > step.before.totalPoints),
      ),
    ];
  },
  session(steps, snapshot) {
    const config = snapshot as unknown as SinglesConfig;
    return finalLine<SinglesTrainingSeatState>(steps, "Progress", (seat) =>
      progressLabel(seat.status, targetLabel(singlesTargetOf(seat, config))),
    );
  },
};

/** A Doubles seat's active target, labelled as `currentTargetLabelFor` does ("D16", "BULL"). */
function doublesTargetLabel(
  seat: DoublesTrainingSeatState,
  snapshot: ReplaySnapshot,
): string {
  const config = snapshot as unknown as DoublesTrainingSnapshot;
  return doublesPathTargetLabel(
    targetAt(doublesPath(config.targetOrder), seat.targetIndex),
  );
}

/**
 * Doubles Training, read as `doubles-training-play.data.ts` does
 * (`currentTargetLabelFor`, the seat's `outcomes`): the hit dart is the one
 * the visit's own recorded outcome names.
 */
const DOUBLES: ReplayPresenter = {
  turn({ turn, after }, snapshot) {
    const seat = seatIn<DoublesTrainingSeatState>(after, turn.participantRef);
    const outcome = seat.outcomes.at(-1);
    return [
      valueCell("Target", doublesTargetLabel(seat, snapshot)),
      hitsCell(
        turn.darts.map((dart) => outcome?.hitDartNumber === dart.sequence),
      ),
    ];
  },
  session: (steps, snapshot) =>
    finalLine<DoublesTrainingSeatState>(steps, "Progress", (seat) =>
      progressLabel(seat.status, doublesTargetLabel(seat, snapshot)),
    ),
};

/**
 * Shanghai, read as `shanghai-play.data.ts` does (`currentTargetLabelFor`;
 * a dart is a hit when it landed on the round's number).
 */
const SHANGHAI: ReplayPresenter = {
  turn({ turn, before, after }) {
    const aimed = shanghaiTargetOf(
      seatIn<ShanghaiSeatState>(before, turn.participantRef),
    );
    const seat = seatIn<ShanghaiSeatState>(after, turn.participantRef);
    return [
      valueCell("Target", targetLabel(shanghaiTargetOf(seat))),
      hitsCell(
        turn.darts.map(
          (dart) =>
            aimed.kind === "NUMBER" && dart.hitTargetNumber === aimed.number,
        ),
      ),
    ];
  },
  session: (steps) =>
    finalLine<ShanghaiSeatState>(steps, "Progress", (seat) =>
      progressLabel(seat.status, targetLabel(shanghaiTargetOf(seat))),
    ),
};

/**
 * Around the Clock, read as `around-the-clock-play.data.ts` does
 * (`labelOf`; `replayHits` judges each dart against the target active when
 * it was thrown), each dart replayed from the seat's state before the visit.
 */
const AROUND_THE_CLOCK: ReplayPresenter = {
  turn({ turn, before, after }, snapshot) {
    const config = snapshot as unknown as AroundTheClockEngineConfig;
    const rules = rulesOf(config);
    const steps = foldSeatSteps(
      observationsOf(turn),
      seatIn<AroundTheClockSeatState>(before, turn.participantRef),
      (state, observation) =>
        applyAroundTheClockDart(state, observation, rules),
    );
    const seat = seatIn<AroundTheClockSeatState>(after, turn.participantRef);
    return [
      valueCell("Target", targetLabel(clockTargetOf(seat, config))),
      hitsCell(
        steps.map((step) =>
          isClockHit(
            rules,
            clockTargetOf(step.before, config),
            step.observation,
          ),
        ),
      ),
    ];
  },
  session(steps, snapshot) {
    const config = snapshot as unknown as AroundTheClockEngineConfig;
    return finalLine<AroundTheClockSeatState>(steps, "Progress", (seat) =>
      progressLabel(seat.status, targetLabel(clockTargetOf(seat, config))),
    );
  },
};

/**
 * Each game's replay presenter (D371 decision 8): per turn, the values its
 * play page shows after the visit; per session, its outcome line.
 */
export const REPLAY_PRESENTERS: Record<GameTypeKey, ReplayPresenter> = {
  "501": FIVE_OH_ONE,
  TUOD: LADDER,
  ONE_TWENTY_ONE: LADDER,
  SCORE_TRAINING,
  SINGLES_TRAINING: SINGLES,
  DOUBLES_TRAINING: DOUBLES,
  BOBS27,
  SHANGHAI,
  AROUND_THE_CLOCK,
};
