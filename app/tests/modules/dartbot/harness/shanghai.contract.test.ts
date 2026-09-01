import { describe, expect, it } from "vitest";
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { ShanghaiState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

function targetForState(state: ShanghaiState) {
  return targetAt(numbersPath(), state.seats[0]!.targetIndex);
}

describe("Shanghai — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = shanghaiEngineFactory.create({ seats: SEATS });
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(["COMPLETE", "SHANGHAI"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("completes at level 15 without exceeding the 20-round dart budget", () => {
    const result = playDictatedSessionToCompletion(
      shanghaiEngineFactory.create({ seats: SEATS }),
      targetForState,
      15,
      3,
    );
    expect(["COMPLETE", "SHANGHAI"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeLessThanOrEqual(60);
  });
});
