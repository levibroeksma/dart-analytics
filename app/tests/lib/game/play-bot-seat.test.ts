import { describe, expect, it } from "vitest";
import {
  BOT_PACING,
  botDartIndex,
  botDartObservationAt,
  botQuickScoreDartIndex,
  botSeatState,
  botThrowObservation,
  findBotSeat,
  x01BotIntent,
} from "@lib/game/play-bot-seat";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import type { DartbotSeat, SeatFact } from "@lib/types";
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

describe("botThrowObservation", () => {
  const dartbot = findBotSeat([botSeat])!;
  const intent = { targetNumber: 20, zoneKey: "TREBLE" as const };

  it("is deterministic for the same seed and fact log", () => {
    const a = botThrowObservation(dartbot, [], intent);
    const b = botThrowObservation(dartbot, [], intent);
    expect(a).toEqual(b);
  });

  it("returns the shared bot pacing and a board observation", () => {
    const { observation, pacing } = botThrowObservation(dartbot, [], intent);
    expect(pacing).toBe(BOT_PACING);
    expect(observation).toHaveProperty("hitZoneKey");
    expect(typeof observation.locationX).toBe("number");
  });

  it("draws the next dart index from the bot's own darts in the log", () => {
    const first = botThrowObservation(dartbot, [], intent);
    const later = botThrowObservation(dartbot, [turn("bot1", 3)], intent);
    expect(later.observation).not.toEqual(first.observation);
  });

  it("ignores the human's darts when indexing", () => {
    expect(botThrowObservation(dartbot, [turn("p1", 3)], intent)).toEqual(
      botThrowObservation(dartbot, [], intent),
    );
  });
});

describe("botDartObservationAt", () => {
  const dartbot = findBotSeat([botSeat])!;
  const intent = { targetNumber: 20, zoneKey: "TREBLE" as const };

  it("matches botThrowObservation at the log's own dart index", () => {
    const turns = [turn("bot1", 3)];
    expect(botDartObservationAt(dartbot, 3, intent)).toEqual(
      botThrowObservation(dartbot, turns, intent).observation,
    );
  });

  it("draws a different dart at a different explicit index", () => {
    expect(botDartObservationAt(dartbot, 0, intent)).not.toEqual(
      botDartObservationAt(dartbot, 5, intent),
    );
  });
});

describe("botSeatState", () => {
  const bot = botSeat as DartbotSeat;

  it("returns the bot's own seat", () => {
    const seats = [
      { participantRef: "p1", targetIndex: 0 },
      { participantRef: "bot1", targetIndex: 4 },
    ];
    expect(botSeatState({ seats }, bot)).toBe(seats[1]);
  });

  it("throws when there is no state", () => {
    expect(() => botSeatState(null, bot)).toThrow(
      "DartBot has no seat in this session's engine state",
    );
  });

  it("throws when the state holds no seat for the bot", () => {
    expect(() =>
      botSeatState({ seats: [{ participantRef: "p1" }] }, bot),
    ).toThrow("DartBot has no seat in this session's engine state");
  });
});

describe("x01BotIntent", () => {
  it("aims the x01 strategy at the remaining score with the level's decision quality", () => {
    for (const level of [1, 5, 10]) {
      const seat = {
        ...botSeat,
        dartbot: { level, seed: 1 },
      } as unknown as DartbotSeat;
      for (const remaining of [170, 40, 501, 1]) {
        expect(x01BotIntent(remaining, seat)).toEqual(
          chooseTarget(
            { remaining, checkoutPath: checkoutPathFor(remaining) },
            skillProfileForLevel(level).decisionQuality,
          ),
        );
      }
    }
  });

  it("routes a checkout for a strong bot on a finishable score", () => {
    const seat = {
      ...botSeat,
      dartbot: { level: 10, seed: 1 },
    } as unknown as DartbotSeat;
    expect(x01BotIntent(40, seat)).not.toEqual(x01BotIntent(501, seat));
  });
});
