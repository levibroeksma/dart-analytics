import { describe, expect, it } from "vitest";
import {
  addEliminationMetrics,
  eliminationBuckets,
  eliminationSessionMetrics,
  emptyEliminationMetrics,
  foldEliminationSessions,
  prisonerResultField,
} from "@modules/stats/sections/elimination.module";
import { addMetricCounts } from "@modules/stats/sections/series.module";
import { KillerEngine } from "@modules/game/killer.engine.module";
import { FollowTheLeaderEngine } from "@modules/game/follow-the-leader.engine.module";
import { PrisonerEngine } from "@modules/game/prisoner.engine.module";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { SeatFact } from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  EliminationGameKey,
  EngineFacts,
  FollowTheLeaderAction,
  OwnerSession,
} from "@modules/types";

const CTX = {
  to: "2026-10-01T00:00:00.000Z",
  now: new Date("2026-11-01T00:00:00.000Z"),
};

const OWNER: SeatFact = {
  participantRef: "p1",
  displayName: "Owner",
  sideKey: "A",
  participantTypeKey: "PLAYER",
};
const RIVAL: SeatFact = {
  participantRef: "p2",
  displayName: "Guest",
  sideKey: "B",
  participantTypeKey: "GUEST",
};

function dart(n: number | null, zone: DartZoneKey): DartObservation {
  return {
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

const d = (n: number) => dart(n, "DOUBLE");
const t = (n: number) => dart(n, "TREBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const miss = dart(null, "MISS");
const STOP: FollowTheLeaderAction = { kind: "STOP" };
const KEEP: FollowTheLeaderAction = { kind: "KEEP" };

function session(
  gameTypeKey: EliminationGameKey,
  snapshot: Record<string, unknown>,
  seats: SeatFact[],
  facts: EngineFacts,
): OwnerSession<EliminationGameKey> {
  return {
    sessionId: "session-1",
    gameTypeKey,
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    seats,
    ownerRef: OWNER.participantRef,
    config: { ...snapshot, seats },
    facts,
  };
}

const KILLER = { lives: 3 as const, seatNumbers: [5, 12] };

function killer(darts: DartObservation[]) {
  const engine = new KillerEngine({ ...KILLER, seats: [OWNER, RIVAL] });
  for (const observation of darts) engine.record(observation);
  return session("KILLER", KILLER, [OWNER, RIVAL], engine.facts());
}

function followTheLeader(
  seats: SeatFact[],
  inputs: (DartObservation | FollowTheLeaderAction)[],
) {
  const engine = new FollowTheLeaderEngine({ lives: 3, seats });
  for (const input of inputs) engine.record(input);
  return session("FOLLOW_THE_LEADER", { lives: 3 }, seats, engine.facts());
}

function at(n: number, zone: DartZoneKey): DartObservation {
  const point = zoneCentroid(n, zone)!;
  return {
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: point.x,
    locationY: point.y,
  };
}

const OUTER_BULL: DartObservation = {
  hitTargetNumber: 25,
  hitZoneKey: "OUTER_BULL",
  locationX: 10,
  locationY: 0,
};

function prisoner(darts: DartObservation[]) {
  const engine = new PrisonerEngine({ darts: 3, seats: [OWNER, RIVAL] });
  for (const observation of darts) engine.record(observation);
  return session("PRISONER", { darts: 3 }, [OWNER, RIVAL], engine.facts());
}

describe("eliminationSessionMetrics: Killer", () => {
  it("reads darts to Killer, lives taken and the win off the owner seat", () => {
    const m = eliminationSessionMetrics(
      killer([miss, miss, miss, miss, miss, miss, d(5), d(12), d(12)]),
    );
    const done = eliminationSessionMetrics(
      killer([
        miss,
        miss,
        miss,
        miss,
        miss,
        miss,
        d(5),
        d(12),
        d(12),
        miss,
        miss,
        miss,
        d(12),
      ]),
    );
    expect(m.killer).toEqual({
      killerGames: 1,
      dartsToKiller: 4,
      livesTaken: 2,
    });
    expect(m.finished).toBe(0);
    expect(done).toMatchObject({
      games: 1,
      finished: 1,
      wins: 1,
      darts: 7,
      livesLost: 0,
      killer: { killerGames: 1, dartsToKiller: 4, livesTaken: 3 },
    });
  });

  it("keeps the first darts to Killer when status is lost and re-earned", () => {
    const m = eliminationSessionMetrics(killer([d(5), d(5), d(5)]));
    expect(m.killer).toEqual({
      killerGames: 1,
      dartsToKiller: 1,
      livesTaken: 0,
    });
  });

  it("counts no Killer game for an owner who never became one", () => {
    const m = eliminationSessionMetrics(killer([miss, miss, miss, d(12)]));
    expect(m.killer).toEqual({
      killerGames: 0,
      dartsToKiller: 0,
      livesTaken: 0,
    });
    expect(m.darts).toBe(3);
  });
});

describe("eliminationSessionMetrics: Follow the Leader", () => {
  it("counts a matched visit, its darts to the match and the bed", () => {
    const m = eliminationSessionMetrics(
      followTheLeader([RIVAL, OWNER], [t(20), miss, t(20), STOP]),
    );
    expect(m.followTheLeader).toMatchObject({
      matchVisits: 1,
      matched: 1,
      matchDarts: 2,
    });
    expect(m.followTheLeader.byBed.TREBLE).toEqual({ visits: 1, matched: 1 });
    expect(m.darts).toBe(2);
  });

  it("counts a failed match by bed and the life it cost", () => {
    const m = eliminationSessionMetrics(
      followTheLeader([RIVAL, OWNER], [d(5), miss, miss, miss]),
    );
    expect(m.followTheLeader).toMatchObject({ matchVisits: 1, matched: 0 });
    expect(m.followTheLeader.byBed.DOUBLE).toEqual({ visits: 1, matched: 0 });
    expect(m.livesLost).toBe(1);
  });

  it("counts no match visit for the owner's setting and keep turns", () => {
    const m = eliminationSessionMetrics(
      followTheLeader([OWNER, RIVAL], [t(18), s(18), s(18), s(18), KEEP]),
    );
    expect(m.followTheLeader.matchVisits).toBe(0);
    expect(m.darts).toBe(1);
  });

  it("keeps a match whose spare dart set a new target", () => {
    const m = eliminationSessionMetrics(
      followTheLeader([RIVAL, OWNER], [t(20), t(20), s(1), STOP]),
    );
    expect(m.followTheLeader).toMatchObject({
      matchVisits: 1,
      matched: 1,
      matchDarts: 1,
    });
  });

  it("joins outer and inner bull targets in the Bull row", () => {
    const m = eliminationSessionMetrics(
      followTheLeader(
        [RIVAL, OWNER],
        [dart(25, "OUTER_BULL"), miss, miss, miss],
      ),
    );
    expect(m.followTheLeader.byBed.BULL).toEqual({ visits: 1, matched: 0 });
  });
});

describe("eliminationSessionMetrics: Prisoner", () => {
  it("counts each owner dart by its result and the number reached", () => {
    const m = eliminationSessionMetrics(
      prisoner([at(1, "OUTER_SINGLE"), OUTER_BULL, miss]),
    );
    expect(m.prisoner).toEqual({
      advance: 1,
      advanceAndCapture: 0,
      capture: 0,
      prison: 1,
      miss: 1,
      reached: 1,
    });
    expect(m.darts).toBe(3);
    expect(m.livesLost).toBe(0);
  });
});

describe("foldEliminationSessions", () => {
  it("skips and counts a session with an unseated turn", () => {
    const good = killer([miss]);
    const bad = killer([miss]);
    bad.facts.turns[0] = { ...bad.facts.turns[0]!, participantRef: "ghost" };
    const result = foldEliminationSessions([good, bad]);
    expect(result.skippedSessions).toBe(1);
    expect(result.sessions).toHaveLength(1);
    expect(eliminationBuckets(result.sessions, CTX)).toHaveLength(1);
  });

  it("skips and counts a session whose owner holds no seat", () => {
    const result = foldEliminationSessions([
      { ...killer([miss]), ownerRef: "nobody" },
    ]);
    expect(result).toEqual({ sessions: [], skippedSessions: 1 });
  });

  it("throws the shared owner-seat error for an unseated owner", () => {
    expect(() =>
      eliminationSessionMetrics({ ...killer([]), ownerRef: "nobody" }),
    ).toThrow("Owner nobody holds no seat.");
  });
});

describe("eliminationBuckets", () => {
  it("sums sessions into one bucket, one sample per session", () => {
    const folded = foldEliminationSessions([
      killer([d(5)]),
      killer([miss, d(5)]),
    ]).sessions;
    const [bucket] = eliminationBuckets(folded, CTX);
    expect(bucket.sampleSize).toBe(2);
    expect(bucket.metrics.killer).toEqual({
      killerGames: 2,
      dartsToKiller: 3,
      livesTaken: 0,
    });
  });

  it("emits no bucket for no sessions", () => {
    expect(eliminationBuckets([], CTX)).toEqual([]);
  });
});

describe("addEliminationMetrics", () => {
  it("sums nested fields", () => {
    const a = emptyEliminationMetrics();
    a.games = 1;
    a.followTheLeader.byBed.SINGLE = { visits: 2, matched: 1 };
    a.prisoner.reached = 4;
    const sum = addEliminationMetrics(a, a);
    expect(sum.games).toBe(2);
    expect(sum.followTheLeader.byBed.SINGLE).toEqual({ visits: 4, matched: 2 });
    expect(sum.prisoner.reached).toBe(8);
    expect(a.games).toBe(1);
  });

  it("equals the shared addMetricCounts sum", () => {
    const a = emptyEliminationMetrics();
    a.killer.livesTaken = 3;
    expect(addEliminationMetrics(a, a)).toEqual(addMetricCounts(a, a));
  });
});

describe("prisonerResultField", () => {
  it("maps each engine result to its metrics field", () => {
    expect(prisonerResultField("Advance and capture")).toBe(
      "advanceAndCapture",
    );
    expect(prisonerResultField("Miss")).toBe("miss");
  });

  it("throws on a result it does not know, so the session is skipped", () => {
    expect(() => prisonerResultField("Bogus")).toThrow();
  });
});
