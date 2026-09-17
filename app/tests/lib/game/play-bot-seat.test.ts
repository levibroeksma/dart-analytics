import { describe, expect, it } from "vitest";
import { botDartIndex, findBotSeat } from "@lib/game/play-bot-seat";
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
