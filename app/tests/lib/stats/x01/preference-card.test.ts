import { describe, expect, it } from "vitest";
import { preferenceCard } from "@lib/stats/x01/preference-card";

describe("preferenceCard", () => {
  it("names the most-left double and its split-away rate", () => {
    const card = preferenceCard({
      "DOUBLE:16|STATE": { left: 40, splitAway: 12 },
      "DOUBLE:8|STATE": { left: 10, splitAway: 1 },
    });
    expect(card.headline).toBe("D16 left most · split away 30%");
    expect(card.left).toBe(50);
  });

  it("is null under the card sample floor", () => {
    const card = preferenceCard({
      "DOUBLE:16|STATE": { left: 25, splitAway: 5 },
    });
    expect(card.headline).toBeNull();
  });

  it("sums attempts and hits across resolutions", () => {
    const card = preferenceCard({
      "DOUBLE:16|STATE": { left: 40, splitAway: 12 },
      "DOUBLE:16|SOLE": { attempts: 6, hits: 2 },
      "DOUBLE:16|NEAREST": { attempts: 4, hits: 1 },
    });
    expect(card.rows[0]).toMatchObject({
      attempts: 10,
      hits: 3,
      splitRate: 0.3,
    });
  });

  it("an AMBIGUOUS-only bucket has no headline and keeps the count", () => {
    const card = preferenceCard({ AMBIGUOUS: { darts: 4 } });
    expect(card.headline).toBeNull();
    expect(card.rows).toEqual([]);
    expect(card.ambiguous).toBe(4);
  });
});
