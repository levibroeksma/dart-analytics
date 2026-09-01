import { describe, expect, it } from "vitest";
import { aroundTheClockEngineFactory } from "@modules/game/around-the-clock.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { AroundTheClockState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

function targetForState(state: AroundTheClockState) {
  return targetAt(numbersPath(), state.seats[0]!.targetIndex);
}

describe("Around the Clock — dictated strategy plays a full solo circuit", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = aroundTheClockEngineFactory.create({ seats: SEATS });
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("completes at level 15 in no more darts than level 1 needed", () => {
    const level1 = playDictatedSessionToCompletion(
      aroundTheClockEngineFactory.create({ seats: SEATS }),
      targetForState,
      1,
      2,
    );
    const level15 = playDictatedSessionToCompletion(
      aroundTheClockEngineFactory.create({ seats: SEATS }),
      targetForState,
      15,
      2,
    );
    expect(level15.state.status).toBe("COMPLETE");
    expect(level15.dartsThrown).toBeLessThanOrEqual(level1.dartsThrown);
  });
});
