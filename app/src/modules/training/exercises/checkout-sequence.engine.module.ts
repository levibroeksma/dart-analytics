import type { CheckoutSequenceConfigData } from "@lib/types";
import { CheckoutSequenceV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { CheckoutSequenceState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "CHECKOUT_SEQUENCE_V1" as const;
const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;
/** Outshots no two darts can finish, so three darts earn the top score. */
const THREE_DART_MINIMUM_OUTSHOTS: ReadonlySet<number> = new Set([99]);

type VisitOutcome =
  | { kind: "CHECKOUT"; darts: number }
  | { kind: "BUST" }
  | { kind: "SPENT"; remaining: number }
  | { kind: "OPEN"; remaining: number; darts: number };

type Progress = {
  outshot: number;
  visitIndex: number;
  visitStart: number;
  points: number;
  checkouts: number;
  attempts: number;
  lastAttemptPoints: number | null;
  openDarts: number;
  openRemaining: number;
  dartsThrown: number;
};

function isFinishingDart(dart: DartFact): boolean {
  return dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
}

/** Walks one visit's darts from `start` under the X01 double-out rule. */
function walkVisit(start: number, darts: readonly DartFact[]): VisitOutcome {
  let remaining = start;
  for (const [index, dart] of darts.entries()) {
    const outcome = resolveCheckoutAttempt(
      remaining,
      dart.score,
      isFinishingDart(dart),
    );
    if (outcome.checkedOut) return { kind: "CHECKOUT", darts: index + 1 };
    if (outcome.busted) return { kind: "BUST" };
    remaining = outcome.remainingAfter;
  }
  return darts.length === DARTS_PER_VISIT
    ? { kind: "SPENT", remaining }
    : { kind: "OPEN", remaining, darts: darts.length };
}

/** Points one checked-out attempt earns by darts used. */
function attemptPoints(outshot: number, dartsUsed: number): number {
  if (dartsUsed <= 2) return 3;
  if (dartsUsed === 3) return THREE_DART_MINIMUM_OUTSHOTS.has(outshot) ? 3 : 2;
  return 1;
}

function nextAttempt(progress: Progress, earned: number): Progress {
  const outshot = progress.outshot + 1;
  return {
    ...progress,
    outshot,
    visitIndex: 0,
    visitStart: outshot,
    points: progress.points + earned,
    attempts: progress.attempts + 1,
    lastAttemptPoints: earned,
    openDarts: 0,
    openRemaining: outshot,
  };
}

function applyVisit(
  config: CheckoutSequenceConfigData,
  progress: Progress,
  turn: TurnFact,
): Progress {
  const counted = {
    ...progress,
    dartsThrown: progress.dartsThrown + turn.darts.length,
  };
  const outcome = walkVisit(progress.visitStart, turn.darts);
  switch (outcome.kind) {
    case "OPEN":
      return {
        ...counted,
        openDarts: outcome.darts,
        openRemaining: outcome.remaining,
      };
    case "CHECKOUT": {
      const dartsUsed = DARTS_PER_VISIT * progress.visitIndex + outcome.darts;
      return nextAttempt(
        { ...counted, checkouts: counted.checkouts + 1 },
        attemptPoints(progress.outshot, dartsUsed),
      );
    }
    case "BUST":
    case "SPENT": {
      const visitIndex = progress.visitIndex + 1;
      if (visitIndex * DARTS_PER_VISIT >= config.dartLimit) {
        return nextAttempt(counted, 0);
      }
      const visitStart =
        outcome.kind === "BUST" ? progress.visitStart : outcome.remaining;
      return {
        ...counted,
        visitIndex,
        visitStart,
        openDarts: 0,
        openRemaining: visitStart,
      };
    }
  }
}

/**
 * Folds the whole fact log into Checkout Sequence state — a pure function
 * of `facts`/`config`/`expired`, mirroring `foldBullseyeCheckoutState`. A
 * visit closes on a checkout, a bust or its third dart, read from its darts
 * alone. The run is complete once the timer expired or the last outshot has
 * been attempted.
 */
export function foldCheckoutSequenceState(
  facts: EngineFacts,
  config: CheckoutSequenceConfigData,
  expired: boolean,
): CheckoutSequenceState {
  const initial: Progress = {
    outshot: config.firstOutshot,
    visitIndex: 0,
    visitStart: config.firstOutshot,
    points: 0,
    checkouts: 0,
    attempts: 0,
    lastAttemptPoints: null,
    openDarts: 0,
    openRemaining: config.firstOutshot,
    dartsThrown: 0,
  };
  const progress = facts.turns.reduce(
    (acc, turn) => applyVisit(config, acc, turn),
    initial,
  );
  const sequenceDone = progress.outshot > config.lastOutshot;

  return {
    currentOutshot: sequenceDone ? null : progress.outshot,
    remaining: sequenceDone ? 0 : progress.openRemaining,
    attemptDart: DARTS_PER_VISIT * progress.visitIndex + progress.openDarts,
    points: progress.points,
    checkouts: progress.checkouts,
    attempts: progress.attempts,
    lastAttemptPoints: progress.lastAttemptPoints,
    dartsInVisit: progress.openDarts,
    dartsThrown: progress.dartsThrown,
    status: expired || sequenceDone ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Checkout Sequence ("Catch 40"): check out 61, then 62, … up to 100, each
 * within six darts, X01 double-out
 * (`docs/game-rules/training/exercises/catch-40.md`). One `TurnFact` is one
 * visit; free aim, so no dart carries an intent. Completes on its own once
 * the last outshot is attempted, or through `expireTimer()` (D264).
 */
export class CheckoutSequenceEngine implements DartExerciseEngine<CheckoutSequenceState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: CheckoutSequenceConfigData;
  private readonly turns: TurnFact[];
  private expired = false;

  constructor(config: CheckoutSequenceConfigData, prior?: EngineFacts) {
    this.config = CheckoutSequenceV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): CheckoutSequenceState {
    return foldCheckoutSequenceState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.expired,
    );
  }

  record(observation: DartObservation): CheckoutSequenceState {
    const before = this.deriveState();
    if (before.status === "COMPLETE") {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      () => before.dartsInVisit > 0,
    );
    appendObservedDart(turn, observation);
    const after = this.deriveState();
    if (after.dartsInVisit === 0) {
      turn.completedAt = new Date().toISOString();
    }
    return after;
  }

  undo(): boolean {
    if (this.expired) {
      this.expired = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.expired = true;
  }

  isComplete(): boolean {
    return this.deriveState().status === "COMPLETE";
  }

  state(): CheckoutSequenceState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const checkoutSequenceEngineFactory: DartExerciseEngineFactory<
  CheckoutSequenceConfigData,
  CheckoutSequenceState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: CheckoutSequenceConfigData, prior?: EngineFacts) {
    return new CheckoutSequenceEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(checkoutSequenceEngineFactory);
