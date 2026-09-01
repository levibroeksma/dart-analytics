import { describe, expect, it } from "vitest";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { SinglesTrainingState } from "@modules/types";
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
  orderMode: "LOW_TO_HIGH" as const,
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY" as const,
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  seats: SEATS,
};

function targetForState(state: SinglesTrainingState) {
  return targetAt(numbersPath(config.targetOrder), state.seats[0]!.targetIndex);
}

describe("Singles Training — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBe(63);
  });

  it("completes at level 15 in exactly the same dart count — every round always throws all 3", () => {
    const result = playDictatedSessionToCompletion(
      singlesTrainingEngineFactory.create(config),
      targetForState,
      15,
      4,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBe(63);
  });
});
