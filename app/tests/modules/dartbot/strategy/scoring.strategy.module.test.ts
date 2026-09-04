import { describe, expect, it } from "vitest";
import { chooseTarget } from "@modules/dartbot/strategy/scoring.strategy.module";

describe("chooseTarget", () => {
  it("always aims at treble 20 — Score Training has no checkout or decision to route on", () => {
    expect(chooseTarget()).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("is deterministic across repeated calls, since it reads no state", () => {
    expect(chooseTarget()).toEqual(chooseTarget());
  });
});
