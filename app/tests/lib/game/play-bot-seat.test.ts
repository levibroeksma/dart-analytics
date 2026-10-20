import { describe, expect, it } from "vitest";
import {
  BOT_PACING,
  botDartIndex,
  botQuickScoreDartIndex,
  findBotSeat,
} from "@lib/game/play-bot-seat";
import type { SeatFact } from "@lib/types";
import type { TurnFact } from "@modules/types";

const humanSeat = {
  participantRef: "p1",
  participantTypeKey: "PLAYER",
  sideKey: "A",
} as unknown as SeatFact;

const botSeat = {
  participantRef: "bot1",
  participantTypeKey: "DARTBOT",
  sideKey: "B",
  dartbot: { level: 8, seed: 42 },
} as unknown as SeatFact;

function turn(participantRef: string, dartCount: number): TurnFact {
  return {
    participantRef,
    darts: Array.from({ length: dartCount }, () => ({})),
  } as unknown as TurnFact;
}

describe("findBotSeat", () => {
  it("returns the DARTBOT seat when one is present", () => {
    expect(findBotSeat([humanSeat, botSeat])?.participantRef).toBe("bot1");
  });

  it("returns undefined for an all-human seat list", () => {
    expect(findBotSeat([humanSeat])).toBeUndefined();
  });
});

describe("botDartIndex", () => {
  it("counts only the bot's own darts", () => {
    const turns = [turn("p1", 3), turn("bot1", 3), turn("bot1", 2)];
    expect(botDartIndex(turns, "bot1")).toBe(5);
  });

  it("returns 0 when the bot has not thrown", () => {
    expect(botDartIndex([turn("p1", 3)], "bot1")).toBe(0);
  });
});

describe("botQuickScoreDartIndex", () => {
  it("advances a full visit per bot turn, though QUICK_SCORE turns carry no darts", () => {
    const turns = [
      turn("p1", 0),
      turn("bot1", 0),
      turn("p1", 0),
      turn("bot1", 0),
    ];
    expect(botQuickScoreDartIndex(turns, "bot1", 3)).toBe(6);
  });

  it("returns 0 when the bot has not thrown", () => {
    expect(botQuickScoreDartIndex([turn("p1", 0)], "bot1", 3)).toBe(0);
  });
});

describe("BOT_PACING", () => {
  it("is the shared bot pacing: 900 ms before each dart, 250 ms after it lands", () => {
    expect(BOT_PACING).toEqual({ preThrowMs: 900, postThrowMs: 250 });
  });

  it("is frozen, so no game can change another game's pacing", () => {
    expect(Object.isFrozen(BOT_PACING)).toBe(true);
  });
});
