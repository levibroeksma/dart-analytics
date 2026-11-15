import { describe, expect, it } from "vitest";
import { describeDrift, driftCard } from "@lib/stats/x01/drift-card";

const row = (n: number, sumDx: number, sumDy: number) => ({
  n,
  sumDx,
  sumDy,
  sumDxDx: 1000,
  sumDyDy: 400,
  sumDxDy: 0,
});

describe("describeDrift", () => {
  it("names left and low for negative dx and positive dy", () => {
    expect(describeDrift(-4, 2)).toBe("4 mm left, 2 mm low");
  });
  it("names right and high for the opposite signs", () => {
    expect(describeDrift(4, -2)).toBe("4 mm right, 2 mm high");
  });
  it("omits an axis that rounds to zero", () => {
    expect(describeDrift(-4, 0.2)).toBe("4 mm left");
  });
  it("reads on target when both axes round to zero", () => {
    expect(describeDrift(0.2, -0.3)).toBe("on target");
  });
});

describe("driftCard", () => {
  it("headlines dart 1", () => {
    const card = driftCard({ "FINISH|DOUBLE:16|1|SOLE": row(40, -160, 80) });
    expect(card.headline).toBe("4 mm left, 2 mm low");
    expect(card.n).toBe(40);
  });

  it("flips the words with the signs", () => {
    const card = driftCard({ "FINISH|DOUBLE:16|1|SOLE": row(40, 160, -80) });
    expect(card.headline).toBe("4 mm right, 2 mm high");
  });

  it("headline is null under the card sample floor", () => {
    const card = driftCard({ "FINISH|DOUBLE:16|1|SOLE": row(10, -40, 20) });
    expect(card.headline).toBeNull();
  });

  it("spread is the root of the summed variances", () => {
    const card = driftCard({ "FINISH|DOUBLE:16|1|SOLE": row(40, -160, 80) });
    expect(card.byDart[0].spread).toBeCloseTo(Math.sqrt(15));
  });

  it("pools darts 2 and 3 separately from dart 1", () => {
    const card = driftCard({
      "FINISH|DOUBLE:16|1|SOLE": row(40, -160, 80),
      "FINISH|DOUBLE:16|2|SOLE": row(20, 40, 0),
      "SETUP|TREBLE:20|2|NEAREST": row(20, 40, 0),
      "FINISH|DOUBLE:16|3|SOLE": row(12, 0, 0),
    });
    expect(card.byDart.map((r) => r.n)).toEqual([40, 40, 12]);
    expect(card.byDart[1].meanDx).toBe(2);
  });

  it("groups by basis and dart, dropping empty combinations", () => {
    const card = driftCard({
      "FINISH|DOUBLE:16|1|SOLE": row(40, -160, 80),
      "SETUP|TREBLE:20|1|SOLE": row(15, 0, 0),
    });
    expect(card.byBasis.map((r) => [r.basis, r.dart, r.n])).toEqual([
      ["FINISH", 1, 40],
      ["SETUP", 1, 15],
    ]);
  });

  it("an AMBIGUOUS-only bucket has no headline and keeps the count", () => {
    const card = driftCard({ AMBIGUOUS: { darts: 5 } });
    expect(card.headline).toBeNull();
    expect(card.ambiguous).toBe(5);
    expect(card.byBasis).toEqual([]);
  });
});
