import { describe, expect, it } from "vitest";
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  decodeReplayCursor,
  encodeReplayCursor,
  replayFacts,
  rowsToTurns,
  stageOrder,
} from "@modules/stats/replay.module";
import { toBase64Url } from "@modules/stats/sections/series.module";
import type { ReplayRow, ReplayStageRow } from "@modules/types";
import {
  PLAYER_ONE,
  playFiveOhOne,
  SCRIPTED_GAMES,
} from "../../lib/stats/replay-games";

describe("replayFacts", () => {
  it.each(SCRIPTED_GAMES)(
    "rebuilds a %s engine whose state equals the one that played it",
    (_name, play) => {
      const game = play();
      const facts = replayFacts(game.header.stages, game.turns);
      const factory = getEngineFactory(game.rulesetVersionKey)!;

      expect(factory.create(game.config, facts).state()).toEqual(
        game.finalState,
      );
    },
  );

  it("keys stages by id and turns by stage and sequence, darts by dart number", () => {
    const game = playFiveOhOne();
    const facts = replayFacts(game.header.stages, game.turns);
    const first = game.turns[0]!;

    expect(facts.stages[0]).toEqual({
      clientKey: game.header.stages[0]!.stageId,
      stageTypeKey: "LEG",
      parentClientKey: null,
      sequence: 1,
    });
    expect(facts.turns[0]).toMatchObject({
      clientKey: `${first.stageId}:${first.turnSequence}`,
      stageClientKey: first.stageId,
      participantRef: PLAYER_ONE.participantId,
      sequence: first.turnSequence,
      totalScore: 81,
    });
    expect(facts.turns[0]!.darts.map((dart) => dart.sequence)).toEqual([
      1, 2, 3,
    ]);
    expect(facts.turns[0]!.darts).toEqual(game.facts.turns[0]!.darts);
    expect(facts.turns[0]!.darts[0]!.locationX).not.toBeNull();
  });
});

function stage(overrides: Partial<ReplayStageRow> = {}): ReplayStageRow {
  return {
    stageId: "stage-1",
    parentStageId: null,
    stageTypeKey: "LEG",
    sequence: 1,
    ...overrides,
  };
}

function row(overrides: Partial<ReplayRow> = {}): ReplayRow {
  return {
    stageId: "stage-1",
    turnSequence: 1,
    participantId: "participant-1",
    participantName: "Alex",
    participantTypeKey: "PLAYER",
    turnTotalScore: 60,
    dartNumber: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    locationX: null,
    locationY: null,
    ...overrides,
  };
}

describe("stageOrder", () => {
  it("orders three roots by sequence", () => {
    const stages = [
      stage({ stageId: "c", sequence: 3 }),
      stage({ stageId: "a", sequence: 1 }),
      stage({ stageId: "b", sequence: 2 }),
    ];
    expect(stageOrder(stages).map((s) => s.stageId)).toEqual(["a", "b", "c"]);
  });

  it("interleaves a root's children before the next root", () => {
    const stages = [
      stage({ stageId: "root1", parentStageId: null, sequence: 1 }),
      stage({ stageId: "root2", parentStageId: null, sequence: 2 }),
      stage({ stageId: "child2", parentStageId: "root1", sequence: 2 }),
      stage({ stageId: "child1", parentStageId: "root1", sequence: 1 }),
    ];
    expect(stageOrder(stages).map((s) => s.stageId)).toEqual([
      "root1",
      "child1",
      "child2",
      "root2",
    ]);
  });

  it("preserves depth-3 nesting in pre-order", () => {
    const stages = [
      stage({ stageId: "leaf", parentStageId: "mid", sequence: 1 }),
      stage({ stageId: "root", parentStageId: null, sequence: 1 }),
      stage({ stageId: "mid", parentStageId: "root", sequence: 1 }),
    ];
    expect(stageOrder(stages).map((s) => s.stageId)).toEqual([
      "root",
      "mid",
      "leaf",
    ]);
  });

  it("throws on a cycle", () => {
    const stages = [
      stage({ stageId: "a", parentStageId: "b", sequence: 1 }),
      stage({ stageId: "b", parentStageId: "a", sequence: 1 }),
    ];
    expect(() => stageOrder(stages)).toThrow();
  });

  it("throws on an unknown parent", () => {
    const stages = [stage({ stageId: "a", parentStageId: "missing" })];
    expect(() => stageOrder(stages)).toThrow();
  });
});

describe("replay cursor codec", () => {
  it("round-trips", () => {
    const cursor = { stageId: "stage-1", turnSequence: 7 };
    expect(decodeReplayCursor(encodeReplayCursor(cursor))).toEqual(cursor);
  });

  it("returns null for a bad prefix", () => {
    expect(decodeReplayCursor(toBase64Url("v2:stage-1:7"))).toBeNull();
  });

  it("returns null for bad base64", () => {
    expect(decodeReplayCursor("%%%")).toBeNull();
  });

  it("returns null for a non-integer sequence", () => {
    expect(decodeReplayCursor(toBase64Url("v1:stage-1:seven"))).toBeNull();
  });

  it("returns null for a missing part", () => {
    expect(decodeReplayCursor(toBase64Url("v1:stage-1"))).toBeNull();
  });

  it.each(["0", "2147483648", "99999999999", "99999999999999999999"])(
    "returns null for a turn sequence %s outside Postgres integer 1..2147483647",
    (turnSequence) => {
      expect(
        decodeReplayCursor(toBase64Url(`v1:stage-1:${turnSequence}`)),
      ).toBeNull();
    },
  );

  it("accepts the largest Postgres integer turn sequence", () => {
    expect(decodeReplayCursor(toBase64Url("v1:stage-1:2147483647"))).toEqual({
      stageId: "stage-1",
      turnSequence: 2147483647,
    });
  });
});

describe("rowsToTurns", () => {
  it("groups two turns of three darts each", () => {
    const rows = [
      row({ turnSequence: 1, dartNumber: 1, score: 20, hitZoneKey: "SINGLE" }),
      row({ turnSequence: 1, dartNumber: 2, score: 20, hitZoneKey: "SINGLE" }),
      row({ turnSequence: 1, dartNumber: 3, score: 20, hitZoneKey: "SINGLE" }),
      row({
        turnSequence: 2,
        dartNumber: 1,
        score: 60,
        hitZoneKey: "TREBLE",
      }),
      row({
        turnSequence: 2,
        dartNumber: 2,
        score: 60,
        hitZoneKey: "TREBLE",
      }),
      row({
        turnSequence: 2,
        dartNumber: 3,
        score: 60,
        hitZoneKey: "TREBLE",
      }),
    ];
    const turns = rowsToTurns(rows);
    expect(turns).toHaveLength(2);
    expect(turns[0].darts).toHaveLength(3);
    expect(turns[1].darts).toHaveLength(3);
  });

  it("yields an empty darts array for a turn-total-only row", () => {
    const rows = [
      row({
        dartNumber: null,
        score: null,
        hitZoneKey: null,
        hitTargetNumber: null,
        turnTotalScore: 45,
      }),
    ];
    expect(rowsToTurns(rows)).toEqual([
      {
        stageId: "stage-1",
        turnSequence: 1,
        participantId: "participant-1",
        turnTotalScore: 45,
        darts: [],
      },
    ]);
  });

  it("keeps darts in row order", () => {
    const rows = [
      row({ dartNumber: 3, score: 5, hitZoneKey: "SINGLE" }),
      row({ dartNumber: 1, score: 60, hitZoneKey: "TREBLE" }),
      row({ dartNumber: 2, score: 25, hitZoneKey: "OUTER_BULL" }),
    ];
    const turns = rowsToTurns(rows);
    expect(turns[0].darts.map((dart) => dart.dartNumber)).toEqual([3, 1, 2]);
  });

  it("throws when a dart row has a null score", () => {
    const rows = [row({ dartNumber: 1, score: null })];
    expect(() => rowsToTurns(rows)).toThrow();
  });

  it("throws when a dart row has a null hitZoneKey", () => {
    const rows = [row({ dartNumber: 1, hitZoneKey: null })];
    expect(() => rowsToTurns(rows)).toThrow();
  });

  it("throws when a NULL dart-number row follows real darts in the same turn", () => {
    const rows = [
      row({ dartNumber: 1, score: 60, hitZoneKey: "TREBLE" }),
      row({
        dartNumber: null,
        score: null,
        hitZoneKey: null,
        hitTargetNumber: null,
      }),
    ];
    expect(() => rowsToTurns(rows)).toThrow();
  });

  it("throws when a real dart follows a NULL dart-number row in the same turn", () => {
    const rows = [
      row({
        dartNumber: null,
        score: null,
        hitZoneKey: null,
        hitTargetNumber: null,
      }),
      row({ dartNumber: 1, score: 60, hitZoneKey: "TREBLE" }),
    ];
    expect(() => rowsToTurns(rows)).toThrow();
  });
});
