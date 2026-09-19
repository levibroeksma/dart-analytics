import { describe, expect, it } from "vitest";
import {
  fiveOhOneCheckoutVisits,
  oneTwentyOneCheckoutVisits,
} from "@modules/game/checkout-visits.module";
import { checkoutVisitsFromRows } from "@modules/stats/x01-checkout-sessions.module";
import type {
  DartFact,
  EngineFacts,
  StageFact,
  TurnFact,
  X01CheckoutDartRow,
} from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

function row(overrides: Partial<X01CheckoutDartRow>): X01CheckoutDartRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    configuration: {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      seats: SEATS,
    },
    stageId: "stage-1",
    stageSequence: 1,
    stageTypeKey: "LEG",
    parentStageId: null,
    turnId: "turn-1",
    turnSequence: 1,
    turnTotalScore: 60,
    turnCompletedAt: "2026-09-19T10:00:00.000Z",
    participantId: "participant-1",
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    ...overrides,
  };
}

describe("checkoutVisitsFromRows", () => {
  it("returns nothing for no rows", () => {
    expect(checkoutVisitsFromRows([])).toEqual([]);
  });

  it("opens a 501 leg's first visit on the configured starting score", () => {
    const visits = checkoutVisitsFromRows([row({})]);
    expect(visits).toEqual([
      {
        startingRemaining: 501,
        countedTotal: 60,
        darts: [expect.objectContaining({ score: 60 })],
      },
    ]);
  });

  it("does not let a busted visit's darts move the next visit's remaining", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        turnId: "turn-2",
        turnSequence: 2,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
      }),
      row({
        turnId: "turn-3",
        turnSequence: 3,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("keeps two sessions' ladders separate", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        sessionId: "session-2",
        stageId: "stage-2",
        turnId: "turn-9",
        turnSequence: 1,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });

  it("contributes no visits for a 501 session with no stored configuration", () => {
    const visits = checkoutVisitsFromRows([row({ configuration: null })]);
    expect(visits).toEqual([]);
  });

  it("contributes no visits for a TUOD session with no stored configuration", () => {
    const visits = checkoutVisitsFromRows([
      row({
        sessionId: "session-tuod",
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        configuration: null,
        stageId: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
      }),
    ]);
    expect(visits).toEqual([]);
  });

  it("does not let a null-config session suppress its neighbours in the same batch", () => {
    const visits = checkoutVisitsFromRows([
      row({
        sessionId: "session-null",
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        configuration: null,
        stageId: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
      }),
      row({}),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });

  it("contributes no visits for a session whose stored configuration no longer validates", () => {
    const visits = checkoutVisitsFromRows([
      row({ configuration: { starting_score: 501, seats: SEATS } }),
    ]);
    expect(visits).toEqual([]);
  });

  it("contributes no visits for a session whose ruleset version is unknown", () => {
    const visits = checkoutVisitsFromRows([
      row({ rulesetVersionKey: "501_V99" }),
    ]);
    expect(visits).toEqual([]);
  });

  it("does not let one unparseable configuration suppress the rest of the batch", () => {
    const visits = checkoutVisitsFromRows([
      row({
        sessionId: "session-broken",
        configuration: { starting_score: 501, seats: SEATS },
      }),
      row({}),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });

  it("orders a visit's darts by dart number, whatever order the rows arrive in", () => {
    const visits = checkoutVisitsFromRows([
      row({
        dartNumber: 3,
        hitTargetNumber: 5,
        hitZoneKey: "SINGLE",
        score: 5,
      }),
      row({
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
      }),
      row({
        dartNumber: 2,
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        score: 1,
      }),
    ]);
    expect(visits[0].darts.map((dartFact) => dartFact.sequence)).toEqual([
      1, 2, 3,
    ]);
  });
});

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

function stagedTurn(
  stageClientKey: string,
  sequence: number,
  totalScore: number,
  darts: DartFact[],
): TurnFact {
  return {
    clientKey: `${stageClientKey}-turn-${sequence}`,
    stageClientKey,
    participantRef: "participant-1",
    sequence,
    completedAt: "2026-09-19T10:00:00.000Z",
    totalScore,
    darts,
  };
}

function stage(
  clientKey: string,
  stageTypeKey: StageFact["stageTypeKey"],
  sequence: number,
): StageFact {
  return { clientKey, stageTypeKey, parentClientKey: null, sequence };
}

/**
 * The rows `v_x01_checkout_darts` would return for `facts`, in the exact
 * order `findX01CheckoutDarts` asks the database for them -- session, stage
 * sequence, turn sequence, dart number.
 */
function rowsFor(
  facts: EngineFacts,
  meta: Pick<
    X01CheckoutDartRow,
    "sessionId" | "gameTypeKey" | "rulesetVersionKey" | "configuration"
  >,
): X01CheckoutDartRow[] {
  const stageOf = new Map(
    facts.stages.map((stageFact) => [stageFact.clientKey, stageFact]),
  );
  return facts.turns
    .flatMap((turnFact) => {
      const stageFact = stageOf.get(turnFact.stageClientKey)!;
      return turnFact.darts.map((dartFact) => ({
        ...meta,
        stageId: stageFact.clientKey,
        stageSequence: stageFact.sequence,
        stageTypeKey: stageFact.stageTypeKey,
        parentStageId: stageFact.parentClientKey,
        turnId: turnFact.clientKey,
        turnSequence: turnFact.sequence,
        turnTotalScore: turnFact.totalScore,
        turnCompletedAt: turnFact.completedAt,
        participantId: turnFact.participantRef,
        dartNumber: dartFact.sequence,
        hitTargetNumber: dartFact.hitTargetNumber,
        hitZoneKey: dartFact.hitZoneKey,
        score: dartFact.score,
      }));
    })
    .sort(
      (a, b) =>
        a.stageSequence - b.stageSequence ||
        a.turnSequence - b.turnSequence ||
        a.dartNumber - b.dartNumber,
    );
}

/**
 * Two rounds of a solo 121, written exactly as `OneTwentyOneEngine` writes
 * them: a stage per round, and `sequence` restarting at 1 inside each one.
 */
function twoRoundOneTwentyOneFacts(): EngineFacts {
  return {
    stages: [stage("round-1", "ROUND", 1), stage("round-2", "ROUND", 2)],
    turns: [
      stagedTurn("round-1", 1, 60, [dart(1, 20, "TREBLE", 60)]),
      stagedTurn("round-1", 2, 0, [dart(1, 20, "TREBLE", 60)]),
      stagedTurn("round-1", 3, 20, [dart(1, 20, "SINGLE", 20)]),
      stagedTurn("round-2", 1, 60, [dart(1, 20, "TREBLE", 60)]),
      stagedTurn("round-2", 2, 1, [dart(1, 1, "SINGLE", 1)]),
      stagedTurn("round-2", 3, 0, [dart(1, 20, "TREBLE", 60)]),
    ],
  };
}

/**
 * Two legs of a solo 501, one of them containing a busted visit, written as
 * `FiveOhOneEngine` writes them: a stage per leg, `sequence` restarting at 1
 * inside each one, and the busted visit's counted total zeroed while its
 * darts keep their real board scores.
 */
function twoLegFiveOhOneFacts(): EngineFacts {
  return {
    stages: [stage("leg-1", "LEG", 1), stage("leg-2", "LEG", 2)],
    turns: [
      stagedTurn("leg-1", 1, 180, [
        dart(1, 20, "TREBLE", 60),
        dart(2, 20, "TREBLE", 60),
        dart(3, 20, "TREBLE", 60),
      ]),
      stagedTurn("leg-1", 2, 0, [dart(1, 20, "TREBLE", 60)]),
      stagedTurn("leg-2", 1, 140, [
        dart(1, 20, "TREBLE", 60),
        dart(2, 20, "TREBLE", 60),
        dart(3, 20, "SINGLE", 20),
      ]),
      stagedTurn("leg-2", 2, 100, [
        dart(1, 20, "TREBLE", 60),
        dart(2, 20, "DOUBLE", 40),
      ]),
    ],
  };
}

/**
 * One fact log, both paths. The live result modals call the builders in
 * `checkout-visits.module.ts` directly off the engine's own facts; the
 * career read rebuilds those facts from `v_x01_checkout_darts` rows first.
 * The two can never be allowed to disagree -- that agreement is the whole
 * point of the shared builder.
 */
describe("checkoutVisitsFromRows agrees with the live modal path", () => {
  it("matches one-twenty-one-play.data.ts over a multi-round 121", () => {
    const facts = twoRoundOneTwentyOneFacts();
    const config = { seats: SEATS } as Parameters<
      typeof oneTwentyOneCheckoutVisits
    >[3];

    const live = oneTwentyOneCheckoutVisits(
      facts.turns,
      facts.stages,
      facts.turns,
      config,
      "participant-1",
    );
    const career = checkoutVisitsFromRows(
      rowsFor(facts, {
        sessionId: "session-121",
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        configuration: { seats: SEATS },
      }),
    );

    expect(live.map((visit) => visit.startingRemaining)).toEqual([
      121, 61, 61, 121, 61, 60,
    ]);
    expect(career.map((visit) => visit.startingRemaining)).toEqual(
      live.map((visit) => visit.startingRemaining),
    );
    expect(career).toEqual(live);
  });

  it("matches five-oh-one-play.data.ts over a multi-leg 501 containing a bust", () => {
    const facts = twoLegFiveOhOneFacts();

    const live = fiveOhOneCheckoutVisits(facts.turns, 501);
    const career = checkoutVisitsFromRows(
      rowsFor(facts, {
        sessionId: "session-501",
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 501,
          legs_to_win: 2,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          seats: SEATS,
        },
      }),
    );

    expect(live.map((visit) => visit.startingRemaining)).toEqual([
      501, 321, 501, 361,
    ]);
    expect(career.map((visit) => visit.startingRemaining)).toEqual(
      live.map((visit) => visit.startingRemaining),
    );
    expect(career).toEqual(live);
  });
});
