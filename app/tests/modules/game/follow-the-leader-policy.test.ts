import { describe, it, expect } from "vitest";
import {
  bedOf,
  keepAllowed,
  resolveVisit,
  sameBed,
} from "@modules/game/follow-the-leader-policy";
import type {
  BedFact,
  ClosedVisit,
  DartObservation,
  EliminationSeat,
  FollowTheLeaderExt,
  FollowTheLeaderShared,
} from "@modules/types";

type Zone = DartObservation["hitZoneKey"];

const dart = (n: number | null, zone: Zone): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: zone,
  locationX: null,
  locationY: null,
});
const s = (n: number) => dart(n, "SINGLE");
const d = (n: number) => dart(n, "DOUBLE");
const t = (n: number) => dart(n, "TREBLE");
const miss = dart(null, "MISS");

const seat = (
  ref: string,
  out = false,
): EliminationSeat<FollowTheLeaderExt> => ({
  participantRef: ref,
  sideKey: ref,
  lives: out ? 0 : 3,
  out,
  ext: {},
});
const seats = [seat("A"), seat("B"), seat("C")];

const bed = (number: number | null, ring: BedFact["ring"]): BedFact => ({
  number,
  ring,
});
const shared = (
  over: Partial<FollowTheLeaderShared> = {},
): FollowTheLeaderShared => ({
  target: bed(18, "TREBLE"),
  leaderRef: "A",
  failed: [],
  retryRef: null,
  ...over,
});
const visit = (
  participantRef: string,
  darts: DartObservation[],
  kept = false,
): ClosedVisit => ({ participantRef, darts, kept });
const lose = (ref: string) => [{ participantRef: ref, livesDelta: -1 }];

describe("bedOf", () => {
  it("maps rings, folds single beds, drops bull numbers", () => {
    expect(bedOf(dart(18, "INNER_SINGLE"))).toEqual(bed(18, "SINGLE"));
    expect(bedOf(dart(18, "OUTER_SINGLE"))).toEqual(bed(18, "SINGLE"));
    expect(bedOf(t(18))).toEqual(bed(18, "TREBLE"));
    expect(bedOf(d(20))).toEqual(bed(20, "DOUBLE"));
    expect(bedOf(dart(25, "OUTER_BULL"))).toEqual(bed(null, "OUTER_BULL"));
    expect(bedOf(dart(null, "INNER_BULL"))).toEqual(bed(null, "INNER_BULL"));
  });
  it("is null off the board", () => {
    expect(bedOf(miss)).toBeNull();
    expect(bedOf(dart(null, "SINGLE"))).toBeNull();
  });
});

describe("sameBed", () => {
  it("treats both single beds as one", () => {
    expect(
      sameBed(
        bedOf(dart(18, "INNER_SINGLE"))!,
        bedOf(dart(18, "OUTER_SINGLE"))!,
      ),
    ).toBe(true);
  });
  it("separates ring, bull and number", () => {
    expect(sameBed(bed(18, "TREBLE"), bed(18, "SINGLE"))).toBe(false);
    expect(sameBed(bed(null, "OUTER_BULL"), bed(null, "INNER_BULL"))).toBe(
      false,
    );
    expect(sameBed(bed(18, "TREBLE"), bed(17, "TREBLE"))).toBe(false);
    expect(sameBed(bed(null, "INNER_BULL"), bed(null, "INNER_BULL"))).toBe(
      true,
    );
  });
});

type Row = {
  name: string;
  visit: ClosedVisit;
  shared: FollowTheLeaderShared;
  changes: { participantRef: string; livesDelta: number }[];
  expected: FollowTheLeaderShared;
};

const rows: Row[] = [
  {
    name: "kept clears failed, no changes",
    visit: visit("A", [], true),
    shared: shared({ failed: ["B", "C"] }),
    changes: [],
    expected: shared({ failed: [] }),
  },
  {
    name: "opening dart on board sets target and leader",
    visit: visit("A", [t(20)]),
    shared: shared({ target: null, leaderRef: null, failed: ["B"] }),
    changes: [],
    expected: shared({ target: bed(20, "TREBLE"), leaderRef: "A", failed: [] }),
  },
  {
    name: "opening dart off board asks a retry",
    visit: visit("A", [miss]),
    shared: shared({ target: null, leaderRef: null }),
    changes: [],
    expected: shared({ target: null, leaderRef: null, retryRef: "A" }),
  },
  {
    name: "opening retry on board clears retryRef",
    visit: visit("A", [s(5)]),
    shared: shared({ target: null, leaderRef: null, retryRef: "A" }),
    changes: [],
    expected: shared({
      target: bed(5, "SINGLE"),
      leaderRef: "A",
      retryRef: null,
    }),
  },
  {
    name: "leader turn on board sets new target",
    visit: visit("A", [d(7)]),
    shared: shared({ failed: ["B", "C"] }),
    changes: [],
    expected: shared({ target: bed(7, "DOUBLE"), failed: [] }),
  },
  {
    name: "leader turn off board keeps state, asks retry",
    visit: visit("A", [miss]),
    shared: shared({ failed: ["B"] }),
    changes: [],
    expected: shared({ failed: ["B"], retryRef: "A" }),
  },
  {
    name: "fail: three darts none match, last on board",
    visit: visit("B", [s(18), t(17), d(18)]),
    shared: shared(),
    changes: lose("B"),
    expected: shared({ failed: ["B"] }),
  },
  {
    name: "fail: single dart off board, no match",
    visit: visit("B", [miss]),
    shared: shared({ failed: ["C"] }),
    changes: lose("B"),
    expected: shared({ failed: ["C", "B"] }),
  },
  {
    name: "fail: already in failed is not duplicated",
    visit: visit("B", [miss, miss, miss]),
    shared: shared({ failed: ["B"] }),
    changes: lose("B"),
    expected: shared({ failed: ["B"] }),
  },
  {
    name: "Review Focus 1: match dart 1, spare off board",
    visit: visit("B", [t(18), miss]),
    shared: shared({ failed: ["B", "C"] }),
    changes: lose("B"),
    expected: shared({ failed: ["C"] }),
  },
  {
    name: "match, spare on board sets target and leader",
    visit: visit("B", [t(18), d(4)]),
    shared: shared({ failed: ["C"] }),
    changes: [],
    expected: shared({ target: bed(4, "DOUBLE"), leaderRef: "B", failed: [] }),
  },
  {
    name: "match, two spares, last on board counts",
    visit: visit("B", [t(18), miss, s(9)]),
    shared: shared(),
    changes: [],
    expected: shared({ target: bed(9, "SINGLE"), leaderRef: "B" }),
  },
  {
    name: "Review Focus 3: spare in target's own bed makes matcher leader",
    visit: visit("B", [t(18), t(18)]),
    shared: shared({ failed: ["C"] }),
    changes: [],
    expected: shared({ target: bed(18, "TREBLE"), leaderRef: "B", failed: [] }),
  },
  {
    name: "match then stop: no loss, failed drops thrower",
    visit: visit("B", [t(18)]),
    shared: shared({ failed: ["B", "C"] }),
    changes: [],
    expected: shared({ failed: ["C"] }),
  },
  {
    name: "Review Focus 2: match on dart 3 leaves target and leader",
    visit: visit("B", [s(1), s(2), t(18)]),
    shared: shared({ failed: ["B"] }),
    changes: [],
    expected: shared({ failed: [] }),
  },
  {
    name: "match on dart 2 after a miss, then stop",
    visit: visit("B", [miss, t(18)]),
    shared: shared(),
    changes: [],
    expected: shared(),
  },
];

describe("resolveVisit", () => {
  it.each(rows)("$name", (row) => {
    const out = resolveVisit(row.visit, seats, row.shared);
    expect(out.changes).toEqual(row.changes);
    expect(out.shared).toEqual(row.expected);
  });

  it("does not mutate its input", () => {
    const input = shared({ failed: ["C"] });
    resolveVisit(visit("B", [miss]), seats, input);
    expect(input.failed).toEqual(["C"]);
  });
});

describe("keepAllowed", () => {
  it("true when leader is active and every other live seat failed", () => {
    expect(keepAllowed(seats, shared({ failed: ["B", "C"] }), "A")).toBe(true);
  });
  it("ignores seats that are out", () => {
    const withOut = [seat("A"), seat("B"), seat("C", true)];
    expect(keepAllowed(withOut, shared({ failed: ["B"] }), "A")).toBe(true);
  });
  it("false after one matcher matched", () => {
    expect(keepAllowed(seats, shared({ failed: ["C"] }), "A")).toBe(false);
  });
  it("false when active is not the leader", () => {
    expect(keepAllowed(seats, shared({ failed: ["A", "C"] }), "B")).toBe(false);
  });
  it("false with no target", () => {
    expect(
      keepAllowed(seats, shared({ target: null, failed: ["B", "C"] }), "A"),
    ).toBe(false);
  });
  it("Review Focus 7: refused after a match, offered after a full pass of failures", () => {
    let sh = shared();
    sh = resolveVisit(visit("B", [miss]), seats, sh).shared;
    sh = resolveVisit(visit("C", [t(18)]), seats, sh).shared;
    expect(keepAllowed(seats, sh, "A")).toBe(false);
    sh = resolveVisit(visit("A", [], true), seats, sh).shared;
    sh = resolveVisit(visit("B", [miss]), seats, sh).shared;
    sh = resolveVisit(visit("C", [s(1), s(2), s(3)]), seats, sh).shared;
    expect(keepAllowed(seats, sh, "A")).toBe(true);
  });
});
