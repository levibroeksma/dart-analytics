import { describe, expect, it } from "vitest";
import {
  CricketEngine,
  cricketV2EngineFactory,
} from "@modules/game/cricket.engine.module";
import { botThrowObservation } from "@lib/game/play-bot-seat";
import { cricketMarksView } from "@lib/game/cricket-play.data";
import { chooseTarget } from "@modules/dartbot/strategy/marks.strategy.module";
import type { DartbotSeat, Seated, CricketSnapshot } from "@lib/types";

const MAX_DARTS = 2000;
const GAMES_PER_SIDE = 40;

function seat(
  ref: string,
  sideKey: string,
  level: number,
  seed: number,
): DartbotSeat {
  return {
    participantRef: ref,
    displayName: ref,
    sideKey,
    participantTypeKey: "DARTBOT",
    dartbot: { level, seed, levelSource: "MANUAL" },
  };
}

function playGame(seats: readonly [DartbotSeat, DartbotSeat]): string {
  const engine = cricketV2EngineFactory.create({
    seats,
  } as Seated<CricketSnapshot>) as CricketEngine;
  for (let darts = 0; darts < MAX_DARTS; darts += 1) {
    const state = engine.state();
    const active = seats.find(
      (s) => s.participantRef === state.activeParticipantRef,
    )!;
    const intent = chooseTarget(cricketMarksView(state, active.participantRef));
    const { observation } = botThrowObservation(
      active,
      engine.facts().turns,
      intent,
    );
    engine.record(observation);
    if (engine.isComplete()) {
      return engine.state().winnerParticipantRef!;
    }
  }
  throw new Error("game did not terminate");
}

describe("Cricket DartBot seat contract", () => {
  it("terminates every game with a winner", () => {
    const winner = playGame([seat("a", "A", 8, 1), seat("b", "B", 8, 2)]);
    expect(["a", "b"]).toContain(winner);
  });

  it("is deterministic for the same seeds", () => {
    const run = () => playGame([seat("a", "A", 8, 7), seat("b", "B", 8, 9)]);
    expect(run()).toBe(run());
  });

  it("a level-12 bot beats a level-4 bot in a clear majority of games", () => {
    let strongWins = 0;
    let games = 0;
    for (let i = 0; i < GAMES_PER_SIDE; i += 1) {
      const strongFirst = playGame([
        seat("strong", "A", 12, 100 + i),
        seat("weak", "B", 4, 500 + i),
      ]);
      const weakFirst = playGame([
        seat("weak", "A", 4, 900 + i),
        seat("strong", "B", 12, 1300 + i),
      ]);
      strongWins += Number(strongFirst === "strong");
      strongWins += Number(weakFirst === "strong");
      games += 2;
    }
    expect(strongWins / games).toBeGreaterThan(0.6);
  });
});
