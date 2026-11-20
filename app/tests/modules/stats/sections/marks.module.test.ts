import { describe, expect, it } from "vitest";
import {
  foldMarksSessions,
  marksBuckets,
  marksSessionMetrics,
  marksSessions,
  RULES_BY_GAME,
} from "@modules/stats/sections/marks.module";
import { CRICKET_RULES } from "@modules/game/cricket.engine.module";
import { TACTICS_RULES } from "@modules/game/tactics.engine.module";
import { MICKEY_MOUSE_RULES } from "@modules/game/mickey-mouse.engine.module";
import type { SeatFact } from "@lib/types";
import type { DartFact, DartZoneKey, EngineFacts } from "@modules/types";
import type { MarksFoldRow, MarksSession } from "@modules/types";

const CTX = {
  to: "2026-10-01T00:00:00.000Z",
  now: new Date("2026-11-01T00:00:00.000Z"),
};

const OWNER = "owner";
const RIVAL = "rival";

function seat(participantRef: string, sideKey: string): SeatFact {
  return {
    participantRef,
    displayName: participantRef,
    sideKey,
    participantTypeKey: "PLAYER",
  } as SeatFact;
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): Omit<DartFact, "sequence"> {
  return {
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score: 0,
    locationX: null,
    locationY: null,
  };
}

const T = (n: number) => dart(n, "TREBLE");
const D = (n: number) => dart(n, "DOUBLE");
const MISS = dart(null, "MISS");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

type Visit = [string, Omit<DartFact, "sequence">[]];

function facts(visits: Visit[]): EngineFacts {
  return {
    stages: [
      {
        clientKey: "stage-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ],
    turns: visits.map(([participantRef, darts], index) => ({
      clientKey: `stage-1:${index + 1}`,
      stageClientKey: "stage-1",
      participantRef,
      sequence: index + 1,
      completedAt: new Date(0).toISOString(),
      totalScore: 0,
      kept: true,
      darts: darts.map((d, i) => ({ ...d, sequence: i + 1 })),
    })),
  };
}

function session(
  gameTypeKey: MarksSession["gameTypeKey"],
  visits: Visit[],
  seats: SeatFact[] = [seat(OWNER, "A")],
  overrides: Partial<MarksSession> = {},
): MarksSession {
  return {
    sessionId: "session-1",
    gameTypeKey,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    seats,
    ownerRef: OWNER,
    facts: facts(visits),
    ...overrides,
  };
}

const DUEL_SEATS = [
  seat(OWNER, "A"),
  { ...seat(RIVAL, "B"), participantTypeKey: "GUEST" } as SeatFact,
];

describe("RULES_BY_GAME", () => {
  it("maps each marks game to its engine's own rules", () => {
    expect(RULES_BY_GAME.CRICKET).toBe(CRICKET_RULES);
    expect(RULES_BY_GAME.TACTICS).toBe(TACTICS_RULES);
    expect(RULES_BY_GAME.MICKEY_MOUSE).toBe(MICKEY_MOUSE_RULES);
  });
});

describe("marksSessionMetrics", () => {
  it("counts marks, wasted darts, rings and objectives in solo Cricket", () => {
    const m = marksSessionMetrics(
      session("CRICKET", [
        [OWNER, [T(20), T(19), T(18)]],
        [OWNER, [MISS, MISS, MISS]],
        [OWNER, [MISS, MISS, MISS]],
      ]),
    );
    expect(m.darts).toBe(9);
    expect(m.marks).toBe(9);
    expect(m.wasted).toBe(6);
    expect(m.rings).toEqual({ single: 0, double: 0, treble: 3 });
    expect(m.objectives.find((o) => o.key === "20")).toEqual({
      key: "20",
      marks: 3,
      darts: 1,
    });
    expect(m.objectives.map((o) => o.key)).toEqual([
      "20",
      "19",
      "18",
      "17",
      "16",
      "15",
      "BULL",
    ]);
    expect(m.closeOuts).toEqual({ games: 0, darts: 0 });
    expect(m.duel).toEqual({ games: 0, wins: 0, darts: 0, points: 0 });
  });

  it("counts a dart on an already-closed number as wasted in solo", () => {
    const m = marksSessionMetrics(
      session("CRICKET", [[OWNER, [T(20), dart(20, "OUTER_SINGLE"), MISS]]]),
    );
    expect(m.marks).toBe(3);
    expect(m.wasted).toBe(2);
    expect(m.objectives.find((o) => o.key === "20")).toEqual({
      key: "20",
      marks: 3,
      darts: 2,
    });
  });

  it("counts a full solo close-out at its closing dart", () => {
    const m = marksSessionMetrics(
      session("CRICKET", [
        [OWNER, [T(20), T(19), T(18)]],
        [OWNER, [MISS, T(17), T(16)]],
        [OWNER, [T(15), BULL, OUTER]],
      ]),
    );
    expect(m.closeOuts).toEqual({ games: 1, darts: 9 });
    expect(m.rings).toEqual({ single: 1, double: 1, treble: 6 });
    expect(m.objectives.find((o) => o.key === "BULL")).toEqual({
      key: "BULL",
      marks: 3,
      darts: 2,
    });
  });

  it("scores points in a Cricket duel in play order and counts the win", () => {
    const m = marksSessionMetrics(
      session(
        "CRICKET",
        [
          [OWNER, [T(20), T(20), T(19)]],
          [RIVAL, [MISS, MISS, MISS]],
          [OWNER, [T(18), T(17), T(16)]],
          [RIVAL, [MISS, MISS, MISS]],
          [OWNER, [T(15), BULL, OUTER]],
        ],
        DUEL_SEATS,
      ),
    );
    expect(m.darts).toBe(9);
    expect(m.wasted).toBe(0);
    expect(m.duel).toEqual({ games: 1, wins: 1, darts: 9, points: 60 });
    expect(m.closeOuts).toEqual({ games: 1, darts: 9 });
  });

  it("scores nothing on a number the opponent closed first", () => {
    const m = marksSessionMetrics(
      session(
        "CRICKET",
        [
          [OWNER, [T(20), MISS, MISS]],
          [RIVAL, [T(20), MISS, MISS]],
          [OWNER, [T(20), MISS, MISS]],
        ],
        DUEL_SEATS,
      ),
    );
    expect(m.duel).toEqual({ games: 0, wins: 0, darts: 6, points: 0 });
    expect(m.wasted).toBe(5);
    expect(m.marks).toBe(3);
  });

  it("counts Mickey Mouse's double-dip as two objectives marked by one dart", () => {
    const m = marksSessionMetrics(
      session("MICKEY_MOUSE", [[OWNER, [D(20), MISS, MISS]]]),
    );
    expect(m.marks).toBe(3);
    expect(m.wasted).toBe(2);
    expect(m.objectives.find((o) => o.key === "20")).toEqual({
      key: "20",
      marks: 2,
      darts: 1,
    });
    expect(m.objectives.find((o) => o.key === "DOUBLES")).toEqual({
      key: "DOUBLES",
      marks: 1,
      darts: 1,
    });
    expect(m.rings.double).toBe(1);
  });

  it("keys Tactics objectives in the engine's order", () => {
    const m = marksSessionMetrics(session("TACTICS", [[OWNER, [MISS]]]));
    expect(m.objectives.map((o) => o.key)).toEqual([
      "20",
      "19",
      "18",
      "17",
      "16",
      "15",
      "BULL",
      "DOUBLES",
      "TRIPLES",
    ]);
  });

  it("throws when a turn's participant holds no seat", () => {
    expect(() =>
      marksSessionMetrics(session("CRICKET", [["ghost", [T(20)]]])),
    ).toThrow();
  });
});

describe("foldMarksSessions", () => {
  it("skips and counts a session that cannot replay", () => {
    const result = foldMarksSessions([
      session("CRICKET", [["ghost", [T(20)]]], undefined, {
        sessionId: "bad",
      }),
      session("CRICKET", [[OWNER, [T(20)]]]),
    ]);
    expect(result.skippedSessions).toBe(1);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].metrics.marks).toBe(3);
  });

  it("skips a session whose owner holds no seat", () => {
    const result = foldMarksSessions([
      session("CRICKET", [[OWNER, [T(20)]]], undefined, { ownerRef: "x" }),
    ]);
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });
});

describe("marksBuckets", () => {
  it("sums sessions sharing a bucket and counts them as the sample", () => {
    const { sessions } = foldMarksSessions([
      session("CRICKET", [[OWNER, [T(20), MISS, MISS]]]),
      session("CRICKET", [[OWNER, [T(19), T(18), MISS]]], undefined, {
        sessionId: "session-2",
      }),
    ]);
    const buckets = marksBuckets(sessions, CTX);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].sampleSize).toBe(2);
    expect(buckets[0].metrics.marks).toBe(9);
    expect(buckets[0].metrics.darts).toBe(6);
    expect(buckets[0].metrics.objectives.find((o) => o.key === "19")).toEqual({
      key: "19",
      marks: 3,
      darts: 1,
    });
  });

  it("emits no bucket for no sessions", () => {
    expect(marksBuckets([], CTX)).toEqual([]);
  });
});

const ROOT = "01900000-0000-7000-9000-0000000000a1";

let dartNo = 0;

function foldRow(overrides: Partial<MarksFoldRow> = {}): MarksFoldRow {
  dartNo += 1;
  return {
    sessionId: "s-1",
    gameTypeKey: "CRICKET",
    rulesetVersionKey: "CRICKET_V2",
    configuration: { seats: DUEL_SEATS },
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    stageId: ROOT,
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

describe("marksSessions", () => {
  it("groups rows into sessions with both seats, the PLAYER seat as owner", () => {
    const result = marksSessions([
      foldRow({ turnSequence: 1, dartNumber: 1 }),
      foldRow({ turnSequence: 1, dartNumber: 2, hitTargetNumber: 19 }),
      foldRow({
        turnSequence: 2,
        dartNumber: 1,
        participantId: RIVAL,
        participantTypeKey: "GUEST",
      }),
      foldRow({ sessionId: "s-2", turnSequence: 1 }),
    ]);
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
    const result = marksSessions([foldRow({ kept: false })]);
    expect(result.sessions[0].facts.turns).toHaveLength(1);
  });

  it("seats a seatless snapshot's only participant as the owner", () => {
    const result = marksSessions([
      foldRow({ rulesetVersionKey: "CRICKET_V1", configuration: {} }),
    ]);
    expect(result.sessions[0].seats.map((s) => s.participantRef)).toEqual([
      OWNER,
    ]);
    expect(result.sessions[0].ownerRef).toBe(OWNER);
  });

  it("skips a seatless snapshot with two participants", () => {
    const result = marksSessions([
      foldRow({ configuration: {} }),
      foldRow({ participantId: RIVAL, turnSequence: 2 }),
    ]);
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });

  it("skips a session with no PLAYER seat", () => {
    const result = marksSessions([
      foldRow({
        configuration: {
          seats: [
            { ...DUEL_SEATS[0], participantTypeKey: "GUEST" },
            DUEL_SEATS[1],
          ],
        },
      }),
    ]);
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });

  it("skips a session whose snapshot does not decode", () => {
    const result = marksSessions([
      foldRow({ rulesetVersionKey: "NOT_A_RULESET" }),
    ]);
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });
});
