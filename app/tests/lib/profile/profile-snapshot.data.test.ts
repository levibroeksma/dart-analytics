import { describe, it, expect } from "vitest";
import {
  formatStatsLine,
  initials,
  profileSnapshot,
} from "@lib/profile/profile-snapshot.data";

describe("formatStatsLine", () => {
  it("groups thousands and splits minutes into hours", () => {
    expect(formatStatsLine({ games: 412, darts: 18342, minutes: 3680 })).toBe(
      "412 games · 18,342 darts · 61h 20m",
    );
  });

  it("keeps zero minutes", () => {
    expect(formatStatsLine({ games: 1, darts: 3, minutes: 0 })).toBe(
      "1 games · 3 darts · 0h 0m",
    );
  });
});

describe("initials", () => {
  it("takes one letter from a single word", () => {
    expect(initials("levi")).toBe("L");
  });

  it("takes the first letters of the first two words", () => {
    expect(initials("Levi Broeksma")).toBe("LB");
    expect(initials("  ada   b  lovelace ")).toBe("AB");
  });

  it("is empty for blank names", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });
});

describe("profileSnapshot", () => {
  it("returns the fixture stats and their line", () => {
    const snap = profileSnapshot();
    expect(snap.stats).toEqual({ games: 412, darts: 18342, minutes: 3680 });
    expect(snap.statsLine).toBe("412 games · 18,342 darts · 61h 20m");
    expect(snap.initials("Levi")).toBe("L");
  });
});
