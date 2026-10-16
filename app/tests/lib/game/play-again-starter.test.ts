import { describe, it, expect, vi } from "vitest";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import type { SeatFact } from "@lib/types";

const PLAYER: SeatFact = {
  participantRef: "p1",
  displayName: "Levi",
  sideKey: "A",
  participantTypeKey: "PLAYER",
};
const BOT = {
  participantRef: "p2",
  displayName: "Dartbot",
  sideKey: "B",
  participantTypeKey: "DARTBOT",
  dartbot: { level: 5 },
} as SeatFact;

function make(seats: SeatFact[]) {
  return Object.assign(playAgainStarterData(), {
    $store: { game: { seats } },
    playAgain: vi.fn(),
  });
}

describe("playAgainStarterData", () => {
  it("play again on one seat skips the step", () => {
    const ctx = make([PLAYER]);
    ctx.requestPlayAgain();
    expect(ctx.playAgain).toHaveBeenCalled();
    expect(ctx.starterOpen).toBe(false);
  });

  it("play again on two seats opens the starter step", () => {
    const ctx = make([PLAYER, BOT]);
    ctx.requestPlayAgain();
    expect(ctx.playAgain).not.toHaveBeenCalled();
    expect(ctx.starterOpen).toBe(true);
  });

  it("always offers the player as side 0, whichever seat they hold", () => {
    const options = make([BOT, PLAYER]).playAgainStarterOptions();
    expect(options.sides()).toEqual(["Levi", "Dartbot"]);
    expect(options.opponentIsBot()).toBe(true);
  });

  it("maps the winning side back to its seat and plays again", () => {
    const ctx = make([BOT, PLAYER]);
    ctx.requestPlayAgain();
    ctx.playAgainStarterOptions().onResolve(0);
    expect(ctx.playAgainStarter).toBe(1);
    expect(ctx.starterOpen).toBe(false);
    expect(ctx.playAgain).toHaveBeenCalled();
  });

  it("cancel closes the step and keeps the results", () => {
    const ctx = make([PLAYER, BOT]);
    ctx.requestPlayAgain();
    ctx.playAgainStarterOptions().onCancel();
    expect(ctx.starterOpen).toBe(false);
    expect(ctx.playAgain).not.toHaveBeenCalled();
  });
});
