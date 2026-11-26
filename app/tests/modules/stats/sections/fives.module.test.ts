import { describe, it, expect } from "vitest";
import {
  FIVES_GAMES,
  addFivesMetrics,
  emptyFivesMetrics,
  fivesBuckets,
  fivesSessionMetrics,
  foldFivesSessions,
} from "@modules/stats/sections/fives.module";
import { FivesEngine } from "@modules/game/fives.engine.module";
import type { SeatFact } from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
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

const t = (n: number) => dart(n, "TREBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const miss = dart(null, "MISS");
const MISSES = [miss, miss, miss];

function session(
  facts: EngineFacts,
  seats: SeatFact[] = [OWNER, RIVAL],
  ownerRef = OWNER.participantRef,
): OwnerSession<"FIVES"> {
  return {
    sessionId: "session-1",
    gameTypeKey: "FIVES",
    bucketStart: "2026-09-01T00:00:00.000Z",
    bucketEnd: "2026-10-01T00:00:00.000Z",
    seats,
    ownerRef,
    config: { seats },
    facts,
  };
}

function fives(darts: DartObservation[]): OwnerSession<"FIVES"> {
  const engine = new FivesEngine({ seats: [OWNER, RIVAL] });
  for (const observation of darts) engine.record(observation);
  return session(engine.facts());
}

describe("FIVES_GAMES", () => {
  it("is exactly Fives", () => {
    expect(FIVES_GAMES).toEqual(["FIVES"]);
  });
});

describe("fivesSessionMetrics", () => {
  it("counts a scoring visit and a no-five visit off the owner seat", () => {
    const m = fivesSessionMetrics(
      fives([s(5), s(5), s(5), ...MISSES, s(1), s(1), s(1)]),
    );
    expect(m).toEqual({
      ...emptyFivesMetrics(),
      games: 1,
      visits: 2,
      scoringVisits: 1,
      points: 3,
    });
  });

  it("counts a win and includes the closing visit in winVisits", () => {
    const m = fivesSessionMetrics(
      fives([t(20), t(20), t(20), ...MISSES, t(20), s(10), s(5)]),
    );
    expect(m.visits).toBe(2);
    expect(m.finished).toBe(1);
    expect(m.wins).toBe(1);
    expect(m.points).toBe(51);
    expect(m.winVisits).toBe(2);
  });

  it("counts a bust, a void, and a void that would pass 51 as a void only", () => {
    const m = fivesSessionMetrics(
      fives([
        t(20),
        t(20),
        t(20),
        ...MISSES,
        s(20),
        s(20),
        s(20),
        ...MISSES,
        s(15),
        s(15),
        s(15),
        ...MISSES,
        s(5),
        s(5),
        miss,
        ...MISSES,
        t(20),
        t(20),
        miss,
      ]),
    );
    expect(m.visits).toBe(5);
    expect(m.busts).toBe(1);
    expect(m.voids).toBe(2);
    expect(m.scoringVisits).toBe(2);
    expect(m.points).toBe(48);
    expect(m.finished).toBe(0);
  });

  it("gives a loss no win and no winVisits", () => {
    const m = fivesSessionMetrics(
      fives([...MISSES, t(20), t(20), t(20), ...MISSES, t(20), s(10), s(5)]),
    );
    expect(m.finished).toBe(1);
    expect(m.wins).toBe(0);
    expect(m.winVisits).toBe(0);
    expect(m.visits).toBe(2);
    expect(m.voids).toBe(2);
  });

  it("does not count an open visit", () => {
    const m = fivesSessionMetrics(fives([s(5), s(5)]));
    expect(m.visits).toBe(0);
    expect(m.games).toBe(1);
  });
});

describe("foldFivesSessions", () => {
  it("skips and counts an unseated turn and an unseated owner", () => {
    const good = fives([s(5), s(5), s(5)]);
    const unseated = fives([s(5), s(5), s(5)]);
    unseated.facts = {
      ...unseated.facts,
      turns: [
        ...unseated.facts.turns,
        { ...unseated.facts.turns[0]!, participantRef: "p9" },
      ],
    };
    const noOwner = session(good.facts, [OWNER, RIVAL], "p9");
    const result = foldFivesSessions([good, unseated, noOwner]);
    expect(result.sessions).toHaveLength(1);
    expect(result.skippedSessions).toBe(2);
  });
});

describe("addFivesMetrics", () => {
  it("sums every field", () => {
    const a = { ...emptyFivesMetrics(), games: 1, busts: 2, winVisits: 3 };
    expect(addFivesMetrics(a, a)).toEqual({
      ...emptyFivesMetrics(),
      games: 2,
      busts: 4,
      winVisits: 6,
    });
  });
});

describe("fivesBuckets", () => {
  it("emits nothing for no sessions", () => {
    expect(fivesBuckets([], CTX)).toEqual([]);
  });

  it("sums two sessions into one bucket", () => {
    const { sessions } = foldFivesSessions([
      fives([s(5), s(5), s(5)]),
      fives([s(5), s(5), s(5)]),
    ]);
    const buckets = fivesBuckets(sessions, CTX);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.sampleSize).toBe(2);
    expect(buckets[0]!.metrics.scoringVisits).toBe(2);
  });
});
