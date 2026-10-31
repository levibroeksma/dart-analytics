import { describe, it, expect } from "vitest";
import {
  initialPrisonerExt,
  prisonerWinner,
  resolveDart,
  resolveVisit,
} from "@modules/game/prisoner-policy";
import type {
  ClosedVisit,
  DartObservation,
  EliminationSeat,
  PrisonerExt,
  PrisonerShared,
} from "@modules/types";

type Zone = DartObservation["hitZoneKey"];

const dart = (n: number | null, zone: Zone): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: zone,
  locationX: null,
  locationY: null,
});
const outer = (n: number) => dart(n, "OUTER_SINGLE");
const inner = (n: number) => dart(n, "INNER_SINGLE");
const dbl = (n: number) => dart(n, "DOUBLE");
const trb = (n: number) => dart(n, "TREBLE");
const single = (n: number) => dart(n, "SINGLE");
const outerBull = dart(null, "OUTER_BULL");
const innerBull = dart(null, "INNER_BULL");
const miss = dart(null, "MISS");

const ext = (over: Partial<PrisonerExt> = {}): PrisonerExt => ({
  ...initialPrisonerExt(3),
  ...over,
});
const seat = (
  ref: string,
  over: Partial<PrisonerExt> = {},
  lives = 3,
): EliminationSeat<PrisonerExt> => ({
  participantRef: ref,
  sideKey: `side-${ref}`,
  lives,
  out: lives === 0,
  ext: ext(over),
});
const shared = (
  lodged: Record<number, number> = {},
  next: string | null = null,
): PrisonerShared => ({ lodged, next });

describe("initialPrisonerExt", () => {
  it("starts at target 1 with the dart budget", () => {
    expect(initialPrisonerExt(3)).toEqual({
      target: 1,
      missed: 0,
      sitting: 0,
      budget: 3,
      captured: 0,
      imprisoned: 0,
    });
  });
});

describe("resolveDart", () => {
  const A = (over: Partial<PrisonerExt> = {}) => seat("A", over);

  it("advances on an outer single of the target", () => {
    expect(resolveDart(A({ target: 5 }), shared(), outer(5))).toEqual({
      changes: [
        { participantRef: "A", livesDelta: 0, ext: ext({ target: 6 }) },
      ],
      shared: shared(),
    });
  });

  it("captures on an outer single of a lodged non-target number, no advance", () => {
    expect(resolveDart(A({ target: 5 }), shared({ 9: 2 }), outer(9))).toEqual({
      changes: [
        {
          participantRef: "A",
          livesDelta: 1,
          ext: ext({ target: 5, captured: 1 }),
        },
      ],
      shared: shared({ 9: 1 }),
    });
  });

  it("captures and advances on one dart at the target", () => {
    expect(
      resolveDart(A({ target: 5, captured: 2 }), shared({ 5: 2 }), outer(5)),
    ).toEqual({
      changes: [
        {
          participantRef: "A",
          livesDelta: 1,
          ext: ext({ target: 6, captured: 3 }),
        },
      ],
      shared: shared({ 5: 1 }),
    });
  });

  it("takes one prisoner per valid hit when several are lodged", () => {
    const out = resolveDart(A({ target: 5 }), shared({ 5: 3 }), outer(5));
    expect(out.shared.lodged[5]).toBe(2);
    expect(out.changes[0].livesDelta).toBe(1);
  });

  it("imprisons on an inner single of the target", () => {
    expect(resolveDart(A({ target: 5 }), shared(), inner(5))).toEqual({
      changes: [
        {
          participantRef: "A",
          livesDelta: -1,
          ext: ext({ target: 5, imprisoned: 1 }),
        },
      ],
      shared: shared({ 5: 1 }),
    });
  });

  it.each([
    ["outer bull", outerBull],
    ["inner bull", innerBull],
  ])("imprisons on the %s and lodges nothing", (_n, d) => {
    expect(resolveDart(A({ target: 5 }), shared({ 2: 1 }), d)).toEqual({
      changes: [
        {
          participantRef: "A",
          livesDelta: -1,
          ext: ext({ target: 5, imprisoned: 1 }),
        },
      ],
      shared: shared({ 2: 1 }),
    });
  });

  it("counts a MISS toward missed", () => {
    expect(resolveDart(A({ target: 5, missed: 1 }), shared(), miss)).toEqual({
      changes: [
        {
          participantRef: "A",
          livesDelta: 0,
          ext: ext({ target: 5, missed: 2 }),
        },
      ],
      shared: shared(),
    });
  });

  it.each([
    ["double of target", dbl(5)],
    ["treble of target", trb(5)],
    ["unbanded single of target", single(5)],
    ["off-target inner single", inner(7)],
    ["off-target outer single, nothing lodged", outer(7)],
  ])("changes nothing on %s", (_n, d) => {
    expect(resolveDart(A({ target: 5 }), shared(), d)).toEqual({
      changes: [],
      shared: shared(),
    });
  });

  it("changes nothing on a double of a number holding a prisoner", () => {
    expect(resolveDart(A({ target: 5 }), shared({ 9: 1 }), dbl(9))).toEqual({
      changes: [],
      shared: shared({ 9: 1 }),
    });
  });

  it("is a no-op for a seat already at target 21", () => {
    const won = A({ target: 21 });
    for (const d of [outer(20), inner(21), outerBull, miss, outer(9)]) {
      expect(resolveDart(won, shared({ 9: 1 }), d)).toEqual({
        changes: [],
        shared: shared({ 9: 1 }),
      });
    }
  });

  it("completing 20 sets the target to 21", () => {
    const out = resolveDart(A({ target: 20 }), shared(), outer(20));
    expect(out.changes[0].ext?.target).toBe(21);
  });

  it("S5: inner then outer of target 5 in one visit nets held 0, target 6", () => {
    const first = resolveDart(A({ target: 5 }), shared(), inner(5));
    const after = {
      ...A({ target: 5 }),
      lives: 2,
      ext: first.changes[0].ext as PrisonerExt,
    };
    const second = resolveDart(after, first.shared, outer(5));
    expect(second.changes[0].livesDelta).toBe(1);
    expect(second.changes[0].ext).toEqual(
      ext({ target: 6, imprisoned: 1, captured: 1 }),
    );
    expect(second.shared.lodged[5]).toBe(0);
  });
});

describe("resolveVisit", () => {
  const visit = (ref: string): ClosedVisit => ({
    participantRef: ref,
    darts: [],
    kept: false,
  });
  const changeOf = (
    out: ReturnType<typeof resolveVisit>,
    ref: string,
  ): PrisonerExt | undefined =>
    out.changes.find((c) => c.participantRef === ref)?.ext;

  it("sits missed darts out and passes to the next seat in", () => {
    const seats = [seat("A", { missed: 1 }), seat("B")];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(changeOf(out, "A")).toEqual(ext({ sitting: 1, budget: 2 }));
    expect(out.shared.next).toBe("B");
  });

  it("with no miss the closing seat keeps its held count as budget", () => {
    const seats = [seat("A", { budget: 3 }, 4), seat("B")];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(changeOf(out, "A")).toEqual(ext({ sitting: 0, budget: 4 }));
  });

  it("one dart held and sitting means budget 0: seat is skipped and recovers", () => {
    const out2 = resolveVisit(
      visit("A"),
      [seat("A", { missed: 1 }, 1), seat("B")],
      shared(),
    );
    expect(changeOf(out2, "A")).toEqual(ext({ sitting: 1, budget: 0 }));
    expect(out2.shared.next).toBe("B");
  });

  it("skips a sitting seat, clears its sitting and returns its darts", () => {
    const seats = [seat("A"), seat("B", { sitting: 1, budget: 0 }, 1)];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(changeOf(out, "B")).toEqual(ext({ sitting: 0, budget: 1 }));
    expect(out.shared.next).toBe("A");
  });

  it("two seats both fully sitting out: the walk skips both and returns darts", () => {
    const seats = [
      seat("A", { missed: 1 }, 1),
      seat("B", { sitting: 1, budget: 0 }, 1),
    ];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(out.shared.next).toBe("B");
    expect(changeOf(out, "A")).toEqual(ext({ sitting: 0, budget: 1 }));
    expect(changeOf(out, "B")).toEqual(ext({ sitting: 0, budget: 1 }));
  });

  it("a closing seat that went out is passed by the walk", () => {
    const seats = [seat("A", {}, 0), seat("B")];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(out.shared.next).toBe("B");
    expect(out.changes.find((c) => c.participantRef === "A")).toBeUndefined();
  });

  it("three prisons take a 3-held seat out at once", () => {
    let s = seat("A", { target: 4 });
    let sh = shared();
    for (let i = 0; i < 3; i++) {
      const out = resolveDart(s, sh, inner(4));
      const c = out.changes[0];
      s = {
        ...s,
        lives: Math.max(0, s.lives + (c.livesDelta ?? 0)),
        ext: c.ext as PrisonerExt,
      };
      s = { ...s, out: s.lives === 0 };
      sh = out.shared;
    }
    expect(s.out).toBe(true);
    expect(sh.lodged[4]).toBe(3);
  });

  it("a capture earlier in the visit keeps a seat in past a later prison", () => {
    let s = seat("A", { target: 4 }, 1);
    let sh = shared({ 9: 1 });
    const steps = [outer(9), inner(4)];
    for (const d of steps) {
      const out = resolveDart(s, sh, d);
      const c = out.changes[0];
      s = {
        ...s,
        lives: s.lives + (c.livesDelta ?? 0),
        ext: c.ext as PrisonerExt,
      };
      sh = out.shared;
    }
    expect(s.lives).toBe(1);
  });

  it("clears missed for the next visit", () => {
    const seats = [seat("A", { missed: 2 }), seat("B")];
    const out = resolveVisit(visit("A"), seats, shared());
    expect(changeOf(out, "A")?.missed).toBe(0);
  });

  it("keeps lodged and sets next", () => {
    const out = resolveVisit(
      visit("A"),
      [seat("A"), seat("B")],
      shared({ 3: 1 }),
    );
    expect(out.shared).toEqual(shared({ 3: 1 }, "B"));
  });
});

describe("prisonerWinner", () => {
  it("is null until a target is 21", () => {
    expect(prisonerWinner([seat("A", { target: 20 }), seat("B")])).toBeNull();
  });

  it("returns the side key of the seat at 21", () => {
    expect(prisonerWinner([seat("A"), seat("B", { target: 21 })])).toBe(
      "side-B",
    );
  });
});
