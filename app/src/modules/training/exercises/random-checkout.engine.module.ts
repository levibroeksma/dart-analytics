import type { RandomCheckoutConfigData } from "@lib/types";
import { RandomCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import { seededUniform } from "@modules/game/seeded-rng.module";
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
import type { RandomCheckoutState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "RANDOM_CHECKOUT_V1" as const;
const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;
const MIN_START = 40;
const MAX_START = 170;
const UNFINISHABLE_STARTS: ReadonlySet<number> = new Set([
  159, 162, 163, 165, 166, 168, 169,
]);

/**
 * The scores a three-dart double-out can finish, 40-170 ascending. Frozen
 * for `RANDOM_CHECKOUT_V1`: a stored draw seed must replay to the same scores
 * forever, so a change here is a new ruleset version (D424).
 */
export const RANDOM_CHECKOUT_POOL: readonly number[] = Array.from(
  { length: MAX_START - MIN_START + 1 },
  (_, offset) => MIN_START + offset,
).filter((score) => !UNFINISHABLE_STARTS.has(score));

/**
 * The start score of attempt `attemptIndex` (0-based): a uniform pick from
 * the pool keyed by `(drawSeed, attemptIndex)` alone, never by earlier darts,
 * so undo and replay reproduce it exactly.
 */
export function drawStartScore(
  config: RandomCheckoutConfigData,
  attemptIndex: number,
): number {
  const uniform = seededUniform(config.drawSeed, attemptIndex)();
  return RANDOM_CHECKOUT_POOL[
    Math.floor(uniform * RANDOM_CHECKOUT_POOL.length)
  ];
}

type VisitOutcome =
  | { kind: "CHECKOUT" }
  | { kind: "FAILED" }
  | { kind: "OPEN"; remaining: number; darts: number };

function isFinishingDart(dart: DartFact): boolean {
  return dart.hitZoneKey === "DOUBLE" || dart.hitZoneKey === "INNER_BULL";
}

/** Walks one visit's darts from `start` under the X01 double-out rule. */
function walkVisit(start: number, darts: readonly DartFact[]): VisitOutcome {
  let remaining = start;
  for (const dart of darts) {
    const outcome = resolveCheckoutAttempt(
      remaining,
      dart.score,
      isFinishingDart(dart),
    );
    if (outcome.checkedOut) return { kind: "CHECKOUT" };
    if (outcome.busted) return { kind: "FAILED" };
    remaining = outcome.remainingAfter;
  }
  return darts.length === DARTS_PER_VISIT
    ? { kind: "FAILED" }
    : { kind: "OPEN", remaining, darts: darts.length };
}

/**
 * Folds the whole fact log into Random Checkout state — a pure function of
 * `facts`/`config`/`expired`. Attempt *n* is turn *n*, started from
 * `drawStartScore(config, n)`; it closes on a checkout, a bust or its third
 * dart, read from its darts alone. The run is complete once the timer
 * expired; an attempt open then is never judged.
 */
export function foldRandomCheckoutState(
  facts: EngineFacts,
  config: RandomCheckoutConfigData,
  expired: boolean,
): RandomCheckoutState {
  let checkouts = 0;
  let attempts = 0;
  let lastAttempt: RandomCheckoutState["lastAttempt"] = null;
  let dartsThrown = 0;
  let open: { index: number; remaining: number; darts: number } | null = null;

  for (const [index, turn] of facts.turns.entries()) {
    dartsThrown += turn.darts.length;
    const outcome = walkVisit(drawStartScore(config, index), turn.darts);
    if (outcome.kind === "OPEN") {
      open = { index, remaining: outcome.remaining, darts: outcome.darts };
      continue;
    }
    attempts += 1;
    if (outcome.kind === "CHECKOUT") checkouts += 1;
    lastAttempt = outcome.kind;
  }

  const index = open ? open.index : facts.turns.length;
  const startScore = drawStartScore(config, index);

  return {
    startScore,
    remaining: open ? open.remaining : startScore,
    dartsInVisit: open ? open.darts : 0,
    checkouts,
    attempts,
    lastAttempt,
    dartsThrown,
    status: expired ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Random Checkout: one-visit checkout attempts from a seed-drawn start score,
 * X01 double-out (`docs/game-rules/training/exercises/random-checkout.md`).
 * One `TurnFact` is one attempt; free aim, so no dart carries an intent. The
 * run ends only through `expireTimer()` (D264).
 */
export class RandomCheckoutEngine implements DartExerciseEngine<RandomCheckoutState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: RandomCheckoutConfigData;
  private readonly turns: TurnFact[];
  private expired = false;

  constructor(config: RandomCheckoutConfigData, prior?: EngineFacts) {
    this.config = RandomCheckoutV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): RandomCheckoutState {
    return foldRandomCheckoutState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.expired,
    );
  }

  record(observation: DartObservation): RandomCheckoutState {
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

  state(): RandomCheckoutState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const randomCheckoutEngineFactory: DartExerciseEngineFactory<
  RandomCheckoutConfigData,
  RandomCheckoutState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: RandomCheckoutConfigData, prior?: EngineFacts) {
    return new RandomCheckoutEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(randomCheckoutEngineFactory);
