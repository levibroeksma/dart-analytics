import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type { Bobs27State } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats: SEATS,
};

function targetForState(state: Bobs27State) {
  return targetAt(doublesPath(), state.seats[0]!.targetIndex);
}

describe("Bob's 27 — dictated strategy plays a full solo round", () => {
  it("reaches a decided outcome at level 1 with every dart accepted by the real engine", () => {
    const engine = bobs27EngineFactory.create(config);
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(["WON", "LOST"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("wins at level 15 — accurate-enough doubles never bust the score below zero", () => {
    const result = playDictatedSessionToCompletion(
      bobs27EngineFactory.create(config),
      targetForState,
      15,
      5,
    );
    expect(result.state.status).toBe("WON");
  });
});
