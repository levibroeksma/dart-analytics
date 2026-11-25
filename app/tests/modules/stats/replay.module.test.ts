import { describe, expect, it } from "vitest";
import { getEngineFactory } from "@modules/game/engine.registry";
import { FollowTheLeaderEngine } from "@modules/game/follow-the-leader.engine.module";
import { foldReplay } from "@lib/stats/replay-fold";
import { REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import { ReplayTurnSchema } from "@routes/statistics/types";
import {
  decodeReplayCursor,
  encodeReplayCursor,
  foldOwnerSessions,
  groupBySession,
  ownerSessions,
  replayFacts,
  rowsToTurns,
  sessionFactsOf,
  stageOrder,
} from "@modules/stats/replay.module";
import { toBase64Url } from "@modules/stats/sections/series.module";
import type { SeatFact } from "@lib/types";
import type {
  EngineFacts,
  FollowTheLeaderState,
  ReplayFoldRow,
  ReplayRow,
  ReplayStageRow,
  StagedReplayRow,
} from "@modules/types";
import {
  PLAYER_ONE,
  PLAYER_TWO,
  replayHeader,
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
    kept: false,
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
        kept: false,
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

describe("a Follow the Leader keep replayed from database rows", () => {
  const STAGE = "01900000-0000-7000-9000-000000000001";
  const config = {
    lives: 3 as const,
    seats: [
      {
        participantRef: PLAYER_ONE.participantId,
        displayName: PLAYER_ONE.displayName,
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: PLAYER_TWO.participantId,
        displayName: PLAYER_TWO.displayName,
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const board = (
    hitTargetNumber: number,
    hitZoneKey: "TREBLE" | "OUTER_SINGLE" | "DOUBLE",
  ) => ({ hitTargetNumber, hitZoneKey, locationX: null, locationY: null });
  const INPUTS = [
    board(18, "TREBLE"),
    board(18, "OUTER_SINGLE"),
    board(18, "OUTER_SINGLE"),
    board(18, "OUTER_SINGLE"),
    { kind: "KEEP" as const },
    board(18, "TREBLE"),
    { kind: "STOP" as const },
    board(20, "DOUBLE"),
  ];

  function play() {
    const engine = new FollowTheLeaderEngine(config);
    const liveStates: FollowTheLeaderState[] = [];
    for (const input of INPUTS) {
      engine.record(input);
      engine.facts().turns.forEach((turn, index) => {
        if (turn.completedAt !== null && liveStates[index] === undefined)
          liveStates[index] = engine.state();
      });
    }
    return { facts: engine.facts(), liveStates };
  }

  function databaseRows(facts: EngineFacts): ReplayRow[] {
    return facts.turns.flatMap((turn): ReplayRow[] => {
      const base = {
        stageId: STAGE,
        turnSequence: turn.sequence,
        participantId: turn.participantRef,
        participantName: "",
        participantTypeKey: "PLAYER",
        turnTotalScore: turn.totalScore,
        kept: turn.kept ?? false,
      };
      if (turn.darts.length === 0)
        return [
          {
            ...base,
            dartNumber: null,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: null,
            hitZoneKey: null,
            score: null,
            locationX: null,
            locationY: null,
          },
        ];
      return turn.darts.map((dart) => ({
        ...base,
        dartNumber: dart.sequence,
        intendedTargetNumber: dart.intendedTargetNumber,
        intendedZoneKey: dart.intendedZoneKey,
        hitTargetNumber: dart.hitTargetNumber,
        hitZoneKey: dart.hitZoneKey,
        score: dart.score,
        locationX: dart.locationX,
        locationY: dart.locationY,
      }));
    });
  }

  function replayed() {
    const { facts, liveStates } = play();
    const turns = rowsToTurns(databaseRows(facts)).map((turn) =>
      ReplayTurnSchema.parse(turn),
    );
    const header = replayHeader({
      gameTypeKey: "FOLLOW_THE_LEADER",
      rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
      configuration: { lives: 3, seats: config.seats },
      participants: [PLAYER_ONE, PLAYER_TWO],
      stages: [
        {
          stageId: STAGE,
          parentStageId: null,
          stageTypeKey: facts.stages[0]!.stageTypeKey,
          sequence: 1,
        },
      ],
    });
    return { fold: foldReplay(header, turns), turns, liveStates };
  }

  it("carries the kept flag onto the rebuilt turn fact", () => {
    const { turns } = replayed();
    const facts = replayFacts([], turns);
    expect(facts.turns.map((turn) => turn.kept)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("rebuilds the live engine's state after every turn, the keep included", () => {
    const { fold, turns, liveStates } = replayed();
    if (!fold.ok) throw new Error(`expected a fold, got ${fold.reason}`);
    turns.forEach((_turn, index) => {
      const rebuilt = fold.stateAfter(index) as FollowTheLeaderState;
      expect({
        active: rebuilt.activeParticipantRef,
        phase: rebuilt.phase,
      }).toEqual({
        active: liveStates[index]!.activeParticipantRef,
        phase: liveStates[index]!.phase,
      });
      expect(rebuilt).toEqual(liveStates[index]);
    });
  });

  it("presents the stored keep as Keep, not Retry", () => {
    const { fold } = replayed();
    if (!fold.ok) throw new Error(`expected a fold, got ${fold.reason}`);
    expect(
      REPLAY_PRESENTERS.FOLLOW_THE_LEADER.turn(
        fold.steps[2]!,
        fold.snapshot,
      )[1],
    ).toEqual({ kind: "value", label: "Result", value: "Keep" });
  });
});

describe("groupBySession", () => {
  it("groups by session in first-appearance order, keeping each session's row order", () => {
    const groups = groupBySession([
      { sessionId: "b", n: 1 },
      { sessionId: "a", n: 2 },
      { sessionId: "b", n: 3 },
    ]);
    expect([...groups.keys()]).toEqual(["b", "a"]);
    expect(groups.get("b")!.map((row) => row.n)).toEqual([1, 3]);
  });
});

describe("sessionFactsOf", () => {
  const ROOT = "01900000-0000-7000-9000-0000000000a1";
  const CHILD = "01900000-0000-7000-9000-0000000000a2";

  function staged(
    stageId: string,
    turnSequence: number,
    dartNumber: number,
  ): StagedReplayRow {
    return {
      sessionId: "s-1",
      stageId,
      stageSequence: 1,
      stageTypeKey: "EXERCISE_BLOCK",
      parentStageId: stageId === CHILD ? ROOT : null,
      turnSequence,
      participantId: "p-1",
      participantName: "Levi",
      participantTypeKey: "PLAYER",
      turnTotalScore: 0,
      dartNumber,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: dartNumber,
      hitZoneKey: "OUTER_SINGLE",
      score: dartNumber,
      locationX: null,
      locationY: null,
      kept: false,
    };
  }

  it("rebuilds stages in pre-order and turns in play order, darts sorted", () => {
    const facts = sessionFactsOf([
      staged(CHILD, 1, 1),
      staged(ROOT, 1, 2),
      staged(ROOT, 1, 1),
    ]);
    expect(facts.stages.map((stage) => stage.clientKey)).toEqual([ROOT, CHILD]);
    expect(facts.turns.map((turn) => turn.stageClientKey)).toEqual([
      ROOT,
      CHILD,
    ]);
    expect(facts.turns[0]!.darts.map((dart) => dart.sequence)).toEqual([1, 2]);
  });
});

const OWNER = "owner";
const RIVAL = "rival";
const MARKS = ["CRICKET", "TACTICS", "MICKEY_MOUSE"] as const;
const DUEL_SEATS: SeatFact[] = [
  {
    participantRef: OWNER,
    displayName: OWNER,
    sideKey: "A",
    participantTypeKey: "PLAYER",
  } as SeatFact,
  {
    participantRef: RIVAL,
    displayName: RIVAL,
    sideKey: "B",
    participantTypeKey: "GUEST",
  } as SeatFact,
];

const FOLD_ROOT = "01900000-0000-7000-9000-0000000000a1";

let dartNo = 0;

function foldRow(overrides: Partial<ReplayFoldRow> = {}): ReplayFoldRow {
  dartNo += 1;
  return {
    sessionId: "s-1",
    gameTypeKey: "CRICKET",
    rulesetVersionKey: "CRICKET_V2",
    configuration: { seats: DUEL_SEATS },
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    stageId: FOLD_ROOT,
    stageSequence: 1,
    stageTypeKey: "EXERCISE_BLOCK",
    parentStageId: null,
    turnSequence: 1,
    participantId: OWNER,
    participantName: OWNER,
    participantTypeKey: "PLAYER",
    turnTotalScore: 0,
    dartNumber: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    locationX: null,
    locationY: null,
    kept: false,
    ...overrides,
  };
}

describe("ownerSessions", () => {
  it("groups rows into sessions with both seats, the PLAYER seat as owner", () => {
    const result = ownerSessions(
      [
        foldRow({ turnSequence: 1, dartNumber: 1 }),
        foldRow({ turnSequence: 1, dartNumber: 2, hitTargetNumber: 19 }),
        foldRow({
          turnSequence: 2,
          dartNumber: 1,
          participantId: RIVAL,
          participantTypeKey: "GUEST",
        }),
        foldRow({ sessionId: "s-2", turnSequence: 1 }),
      ],
      MARKS,
    );
    expect(result.skippedSessions).toBe(0);
    expect(result.sessions.map((s) => s.sessionId)).toEqual(["s-1", "s-2"]);
    const [first] = result.sessions;
    expect(first.gameTypeKey).toBe("CRICKET");
    expect(first.ownerRef).toBe(OWNER);
    expect(first.seats.map((s) => s.participantRef)).toEqual([OWNER, RIVAL]);
    expect(first.facts.turns.map((t) => t.participantRef)).toEqual([
      OWNER,
      RIVAL,
    ]);
    expect(first.facts.turns[0].darts.map((d) => d.hitTargetNumber)).toEqual([
      20, 19,
    ]);
  });

  it("keeps a turn whatever its kept flag", () => {
    const result = ownerSessions([foldRow({ kept: false })], MARKS);
    expect(result.sessions[0].facts.turns).toHaveLength(1);
  });

  it("seats a seatless snapshot's only participant as the owner", () => {
    const result = ownerSessions(
      [foldRow({ rulesetVersionKey: "CRICKET_V1", configuration: {} })],
      MARKS,
    );
    expect(result.sessions[0].seats.map((s) => s.participantRef)).toEqual([
      OWNER,
    ]);
    expect(result.sessions[0].ownerRef).toBe(OWNER);
  });

  it("skips a seatless snapshot with two participants", () => {
    const result = ownerSessions(
      [
        foldRow({ configuration: {} }),
        foldRow({ participantId: RIVAL, turnSequence: 2 }),
      ],
      MARKS,
    );
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });

  it("skips a session with no PLAYER seat", () => {
    const result = ownerSessions(
      [
        foldRow({
          configuration: {
            seats: [
              { ...DUEL_SEATS[0], participantTypeKey: "GUEST" },
              DUEL_SEATS[1],
            ],
          },
        }),
      ],
      MARKS,
    );
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });

  it("skips a session whose snapshot does not decode", () => {
    const result = ownerSessions(
      [foldRow({ rulesetVersionKey: "NOT_A_RULESET" })],
      MARKS,
    );
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });
  it("carries the decoded snapshot as config", () => {
    const result = ownerSessions(
      [
        foldRow({
          gameTypeKey: "KILLER",
          rulesetVersionKey: "KILLER_V1",
          configuration: {
            lives: 3,
            seat_numbers: [20, 19],
            seats: DUEL_SEATS,
          },
        }),
      ],
      ["KILLER"],
    );
    expect(result.skippedSessions).toBe(0);
    expect(result.sessions[0].config).toMatchObject({
      lives: 3,
      seatNumbers: [20, 19],
    });
    expect(
      result.sessions[0].config.seats.map((s) => s.participantRef),
    ).toEqual([OWNER, RIVAL]);
  });

  it("skips and counts a game outside the requested games", () => {
    const result = ownerSessions(
      [foldRow({ gameTypeKey: "KILLER", rulesetVersionKey: "KILLER_V1" })],
      MARKS,
    );
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });
});

describe("foldOwnerSessions", () => {
  const base = {
    gameTypeKey: "KILLER",
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    seats: DUEL_SEATS,
    ownerRef: OWNER,
    config: { seats: DUEL_SEATS },
    facts: { stages: [], turns: [] },
  };

  it("tags each session's metrics with its bucket and counts the ones that throw", () => {
    const result = foldOwnerSessions(
      [
        { ...base, sessionId: "ok" },
        { ...base, sessionId: "bad" },
      ],
      (session) => {
        if (session.sessionId === "bad") throw new Error("refused");
        return 7;
      },
    );
    expect(result).toEqual({
      sessions: [
        {
          sessionId: "ok",
          bucketStart: base.bucketStart,
          bucketEnd: base.bucketEnd,
          metrics: 7,
        },
      ],
      skippedSessions: 1,
    });
  });
});
