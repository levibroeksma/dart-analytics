import { describe, expect, it } from "vitest";
import {
  fiveOhOneCheckoutVisits,
  oneTwentyOneCheckoutVisits,
  tuodCheckoutVisits,
} from "@modules/game/checkout-visits.module";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

function dart(
  sequence: number,
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

function turn(
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return {
    clientKey: `turn-${sequence}`,
    stageClientKey: "leg-1",
    participantRef: "seat-1",
    sequence,
    completedAt: "2026-09-19T10:00:00.000Z",
    totalScore,
    darts,
  };
}

describe("fiveOhOneCheckoutVisits", () => {
  it("opens the first visit of a leg on the session's starting score", () => {
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });

  it("subtracts each visit's counted total from the next visit's remaining", () => {
    const visits = fiveOhOneCheckoutVisits(
      [
        turn(1, 60, [dart(1, 20, "TREBLE", 60)]),
        turn(2, 100, [dart(1, 20, "TREBLE", 60), dart(2, 20, "DOUBLE", 40)]),
      ],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 441]);
  });

  it("ignores a busted visit's thrown darts, which the engine zeroes out of the counted total", () => {
    const busted = turn(2, 0, [dart(1, 20, "TREBLE", 60)]);
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), busted, turn(3, 0, [])],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("carries each visit's counted total, zero included, alongside its darts", () => {
    const visits = fiveOhOneCheckoutVisits(
      [
        turn(1, 60, [dart(1, 20, "TREBLE", 60)]),
        turn(2, 0, [dart(1, 20, "TREBLE", 60)]),
      ],
      501,
    );
    expect(visits.map((visit) => visit.countedTotal)).toEqual([60, 0]);
  });

  it("restarts each leg at the starting score", () => {
    const legTwo: TurnFact = {
      ...turn(2, 60, [dart(1, 20, "TREBLE", 60)]),
      stageClientKey: "leg-2",
    };
    const visits = fiveOhOneCheckoutVisits(
      [turn(1, 60, [dart(1, 20, "TREBLE", 60)]), legTwo],
      501,
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });
});

const SEAT = {
  participantRef: "seat-1",
  displayName: "Levi",
  sideKey: "HOME",
  participantTypeKey: "PLAYER",
} as const;

const TUOD_CONFIG = {
  startingTarget: 40,
  finishBonus: 2,
  missPenalty: 2,
  durationType: "ROUNDS",
  durationValue: 10,
  maxDartsPerTurn: 3,
  seats: [SEAT],
} as const;

const BLOCK_STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function blockTurn(
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return { ...turn(sequence, totalScore, darts), stageClientKey: "block-1" };
}

describe("tuodCheckoutVisits", () => {
  it("opens the first attempt on the configured starting target", () => {
    const turns = [blockTurn(1, 40, [dart(1, 20, "DOUBLE", 40)])];
    const visits = tuodCheckoutVisits(
      turns,
      { stages: [BLOCK_STAGE], turns },
      TUOD_CONFIG,
      "seat-1",
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([40]);
  });

  it("climbs by finishBonus after every counted attempt", () => {
    const turns = [
      blockTurn(1, 40, [dart(1, 20, "DOUBLE", 40)]),
      blockTurn(2, 42, [dart(1, 1, "SINGLE", 2), dart(2, 20, "DOUBLE", 40)]),
      blockTurn(3, 44, [dart(1, 2, "SINGLE", 4), dart(2, 20, "DOUBLE", 40)]),
    ];
    const visits = tuodCheckoutVisits(
      turns,
      { stages: [BLOCK_STAGE], turns },
      TUOD_CONFIG,
      "seat-1",
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      40, 42, 44,
    ]);
  });

  it("reads a failed attempt off its zeroed counted total, never off its darts (bust regression)", () => {
    // The failed attempt keeps a 60-point dart while the engine writes
    // totalScore 0. Folding the darts instead would read it as a success and
    // climb the ladder; the counted total says it failed, so it falls.
    const turns = [
      blockTurn(1, 40, [dart(1, 20, "DOUBLE", 40)]),
      blockTurn(2, 0, [dart(1, 20, "TREBLE", 60)]),
      blockTurn(3, 40, [dart(1, 20, "DOUBLE", 40)]),
    ];
    const visits = tuodCheckoutVisits(
      turns,
      { stages: [BLOCK_STAGE], turns },
      TUOD_CONFIG,
      "seat-1",
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      40, 42, 40,
    ]);
    expect(visits.map((visit) => visit.countedTotal)).toEqual([40, 0, 40]);
  });
});

const ONE_TWENTY_ONE_CONFIG = { seats: [SEAT] } as const;

const ROUND_STAGES: StageFact[] = [
  {
    clientKey: "round-1",
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence: 1,
  },
  {
    clientKey: "round-2",
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence: 2,
  },
];

function roundTurn(
  stageClientKey: string,
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return {
    ...turn(sequence, totalScore, darts),
    clientKey: `${stageClientKey}-turn-${sequence}`,
    stageClientKey,
  };
}

/**
 * Two rounds of a solo 121, each of the three visits per attempt written
 * exactly as `OneTwentyOneEngine` writes them -- `sequence` restarting at 1
 * inside every round stage.
 */
function twoRoundOneTwentyOneTurns(): TurnFact[] {
  return [
    roundTurn("round-1", 1, 60, [dart(1, 20, "TREBLE", 60)]),
    roundTurn("round-1", 2, 0, [dart(1, 20, "TREBLE", 60)]),
    roundTurn("round-1", 3, 20, [dart(1, 20, "SINGLE", 20)]),
    roundTurn("round-2", 1, 60, [dart(1, 20, "TREBLE", 60)]),
    roundTurn("round-2", 2, 1, [dart(1, 1, "SINGLE", 1)]),
    roundTurn("round-2", 3, 0, [dart(1, 20, "TREBLE", 60)]),
  ];
}

describe("oneTwentyOneCheckoutVisits", () => {
  it("opens every visit on the remaining the ladder fold puts the seat on", () => {
    const turns = twoRoundOneTwentyOneTurns();
    const visits = oneTwentyOneCheckoutVisits(
      turns,
      ROUND_STAGES,
      turns,
      ONE_TWENTY_ONE_CONFIG,
      "seat-1",
    );
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      121, 61, 61, 121, 61, 60,
    ]);
  });

  it("leaves the remaining untouched across a busted visit (bust regression)", () => {
    // Visit 2 of round 1 throws T20 from 61 and busts on the leftover 1; its
    // counted total is 0, so visit 3 must open on the same 61 visit 2 did.
    const turns = twoRoundOneTwentyOneTurns();
    const visits = oneTwentyOneCheckoutVisits(
      turns,
      ROUND_STAGES,
      turns,
      ONE_TWENTY_ONE_CONFIG,
      "seat-1",
    );
    expect(visits[1].startingRemaining).toBe(visits[2].startingRemaining);
    expect(visits[1].countedTotal).toBe(0);
  });
});
