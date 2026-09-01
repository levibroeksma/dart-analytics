import { describe, expect, it } from "vitest";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type { DoublesTrainingState } from "@modules/types";
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
  mode: "EASY" as const,
  orderMode: "LOW_TO_HIGH" as const,
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  seats: SEATS,
};

function targetForState(state: DoublesTrainingState) {
  return targetAt(doublesPath(config.targetOrder), state.seats[0]!.targetIndex);
}

describe("Doubles Training — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = doublesTrainingEngineFactory.create(config);
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
      doublesTrainingEngineFactory.create(config),
      targetForState,
      1,
      6,
    );
    const level15 = playDictatedSessionToCompletion(
      doublesTrainingEngineFactory.create(config),
      targetForState,
      15,
      6,
    );
    expect(level15.state.status).toBe("COMPLETE");
    expect(level15.dartsThrown).toBeLessThanOrEqual(level1.dartsThrown);
  });
});
