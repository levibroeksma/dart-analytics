import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import {
  doublesPath,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
import type { GameEngine } from "@modules/game/interfaces";
import type {
  Bobs27State,
  DartFact,
  DartObservation,
  DoublesTrainingState,
  EngineFacts,
  SinglesTrainingState,
} from "@modules/game/types";
import type {
  Bobs27Snapshot,
  DoublesTrainingSnapshot,
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  SinglesSnapshot,
} from "@lib/game/rulesets/types";

/**
 * Mirrors `chk_dart_target_consistency` (migration `0007`, `database/`): a
 * dart row is only insertable when both intention columns are NULL, or
 * `intended_zone_id` is NOT NULL. A target number paired with a null zone —
 * the shape Singles Training emitted until D144's follow-up fix — is the one
 * shape every engine must never produce. No test enforced this pairing
 * across engines before this file; it exists so a future engine (or a
 * regression in an existing one) fails here instead of at INSERT time.
 */
function satisfiesTargetConsistency(dart: DartFact): boolean {
  if (dart.intendedTargetNumber === null && dart.intendedZoneKey === null) {
    return true;
  }
  return dart.intendedZoneKey !== null;
}

function allDarts(facts: EngineFacts): DartFact[] {
  return facts.turns.flatMap((turn) => turn.darts);
}

const bobs27Config: Bobs27Snapshot = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
};

function bobs27HitObservation(state: Bobs27State): DartObservation {
  const target = targetAt(doublesPath(), state.targetIndex);
  return target.kind === "BULL"
    ? { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }
    : { hitTargetNumber: target.number, hitZoneKey: "DOUBLE" };
}

/** Plays every NUMBER-double target (all hits, so score never busts) then one visit on BULL. */
function playBobs27ThroughBull(): GameEngine<DartObservation, Bobs27State> {
  const engine = bobs27EngineFactory.create(bobs27Config);
  for (let target = 0; target < 20; target++) {
    engine.record(bobs27HitObservation(engine.state()));
    engine.record(bobs27HitObservation(engine.state()));
    engine.record(bobs27HitObservation(engine.state()));
  }
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record(bobs27HitObservation(engine.state()));
  return engine;
}

const doublesConfig: DoublesTrainingSnapshot = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
};

function doublesHitObservation(state: DoublesTrainingState): DartObservation {
  const target = targetAt(doublesPath(), state.targetIndex);
  return target.kind === "BULL"
    ? { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }
    : { hitTargetNumber: target.number, hitZoneKey: "DOUBLE" };
}

/** A hit closes a Doubles Training visit instantly, so 20 hits reach BULL. */
function playDoublesTrainingThroughBull(): GameEngine<
  DartObservation,
  DoublesTrainingState
> {
  const engine = doublesTrainingEngineFactory.create(doublesConfig);
  for (let target = 0; target < 20; target++) {
    engine.record(doublesHitObservation(engine.state()));
  }
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record(doublesHitObservation(engine.state()));
  return engine;
}

const singlesConfig: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};

function singlesObservationFor(
  state: SinglesTrainingState,
  zone: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
): DartObservation {
  const target = targetAt(numbersPath(), state.targetIndex);
  if (target.kind === "BULL") {
    return {
      hitTargetNumber: 25,
      hitZoneKey:
        zone === "MISS"
          ? "MISS"
          : zone === "DOUBLE"
            ? "INNER_BULL"
            : "OUTER_BULL",
    };
  }
  return { hitTargetNumber: target.number, hitZoneKey: zone };
}

/** All-MISS visits on every NUMBER target (never resolves the session), then one visit on BULL. */
function playSinglesThroughBull(): GameEngine<
  DartObservation,
  SinglesTrainingState
> {
  const engine = singlesTrainingEngineFactory.create(singlesConfig);
  for (let target = 0; target < 20; target++) {
    engine.record(singlesObservationFor(engine.state(), "MISS"));
    engine.record(singlesObservationFor(engine.state(), "SINGLE"));
    engine.record(singlesObservationFor(engine.state(), "TREBLE"));
  }
  engine.record(singlesObservationFor(engine.state(), "DOUBLE"));
  return engine;
}

const fiveOhOneConfig: FiveOhOneSnapshot = {
  startingScore: 501,
  legsToWin: 2,
  checkIn: "STRAIGHT_IN",
  checkOut: "DOUBLE_OUT",
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
};

function playFiveOhOne() {
  const engine = fiveOhOneEngineFactory.create(fiveOhOneConfig);
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 101 });
  engine.record({ scoreAttempted: 40, finishedOnDouble: true });
  return engine;
}

const scoreTrainingConfig: ScoreTrainingSnapshot = {
  durationType: "ROUNDS",
  durationValue: 3,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
};

function playScoreTraining() {
  const engine = scoreTrainingEngineFactory.create(scoreTrainingConfig);
  engine.record(45);
  engine.record(60);
  engine.record(100);
  return engine;
}

describe("dart fact intention pair satisfies chk_dart_target_consistency (migration 0007)", () => {
  it("Bob's 27: every dart carries a real intended zone (DOUBLE or INNER_BULL)", () => {
    const darts = allDarts(playBobs27ThroughBull().facts());
    expect(darts.length).toBeGreaterThan(0);
    for (const dart of darts) {
      expect(satisfiesTargetConsistency(dart)).toBe(true);
    }
  });

  it("Doubles Training: every dart carries a real intended zone (DOUBLE or INNER_BULL)", () => {
    const darts = allDarts(playDoublesTrainingThroughBull().facts());
    expect(darts.length).toBeGreaterThan(0);
    for (const dart of darts) {
      expect(satisfiesTargetConsistency(dart)).toBe(true);
    }
  });

  it("Singles Training: every dart carries the nulled intention pair, on both NUMBER and BULL targets", () => {
    const darts = allDarts(playSinglesThroughBull().facts());
    expect(darts.length).toBeGreaterThan(0);
    for (const dart of darts) {
      expect(satisfiesTargetConsistency(dart)).toBe(true);
      expect(dart.intendedTargetNumber).toBeNull();
      expect(dart.intendedZoneKey).toBeNull();
    }
  });

  it("501: never emits dart rows (visit-level capture only), so the pair is vacuously satisfied", () => {
    const darts = allDarts(playFiveOhOne().facts());
    expect(darts).toHaveLength(0);
  });

  it("Score Training: never emits dart rows (visit-level capture only), so the pair is vacuously satisfied", () => {
    const darts = allDarts(playScoreTraining().facts());
    expect(darts).toHaveLength(0);
  });
});
