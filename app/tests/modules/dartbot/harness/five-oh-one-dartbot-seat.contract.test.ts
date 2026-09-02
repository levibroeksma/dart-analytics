import { describe, expect, it } from "vitest";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import type { DartObservation, FiveOhOneState } from "@modules/types";

const MAX_VISITS = 500;
const HUMAN_REF = "human-1";
const BOT_REF = "bot-1";
const BOT_LEVEL = 8;
const BOT_SEED = 424242;

const seats = [
  {
    participantRef: HUMAN_REF,
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: BOT_REF,
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: {
      level: BOT_LEVEL,
      seed: BOT_SEED,
      levelSource: "MANUAL" as const,
    },
  },
];

const config = {
  startingScore: 501,
  legsToWin: 1,
  checkIn: "STRAIGHT_IN" as const,
  checkOut: "DOUBLE_OUT" as const,
  maxVisitScore: 180,
  maxDartsPerTurn: 3,
  seats,
};

function botRemaining(state: FiveOhOneState): number {
  return state.seats.find((s) => s.participantRef === BOT_REF)!.remainingScore;
}

function botDart(remaining: number, dartIndex: number): DartObservation {
  const profile = skillProfileForLevel(BOT_LEVEL);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const rng = createDartRng(BOT_SEED, dartIndex);
  const thrown = throwDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** Human always records a fixed 26 (a common, deliberately unglamorous
 * quick-score visit) via the keypad shape; the bot always throws real darts
 * via VISUAL_BOARD's per-dart shape — proving both `FiveOhOneInput` variants
 * coexist correctly inside one SHARED leg, which is this phase's own gate. */
function playToCompletion() {
  const engine = fiveOhOneEngineFactory.create(config);
  let dartIndex = 0;
  let state = engine.state();

  while (state.status === "IN_PROGRESS") {
    if (dartIndex >= MAX_VISITS) {
      throw new Error(
        `Match did not complete within ${MAX_VISITS} darts/visits`,
      );
    }
    if (state.activeParticipantRef === BOT_REF) {
      engine.record(botDart(botRemaining(state), dartIndex));
    } else {
      engine.record({ scoreAttempted: 26, finishedOnDouble: false });
    }
    dartIndex++;
    state = engine.state();
  }

  return engine;
}

describe("DartBot-driven 501 1v1 — SHARED leg alternation", () => {
  it("reaches a decided outcome with the bot throwing its own visits", () => {
    const state = playToCompletion().state();
    expect(state.status).toBe("WON");
    expect(["A", "B"]).toContain(state.winningSideKey);
  });

  it("every bot turn is attributed to the bot's own participantRef", () => {
    const engine = playToCompletion();
    const botTurns = engine
      .facts()
      .turns.filter((t) => t.participantRef === BOT_REF);
    expect(botTurns.length).toBeGreaterThan(0);
    expect(
      engine
        .facts()
        .turns.every(
          (t) => t.participantRef === BOT_REF || t.participantRef === HUMAN_REF,
        ),
    ).toBe(true);
  });

  it("the bot eventually finishes a leg on a double when it reaches checkout range", () => {
    // A dedicated low-noise fixture: bot starts already in range (40), so a
    // decision-quality-8 bot (above the routing threshold) should check out
    // within a small, bounded number of visits rather than never.
    const nearFinishConfig = { ...config, startingScore: 40 };
    const engine = fiveOhOneEngineFactory.create(nearFinishConfig);
    let dartIndex = 0;
    let state = engine.state();
    let visits = 0;
    while (state.status === "IN_PROGRESS" && visits < 50) {
      if (state.activeParticipantRef === BOT_REF) {
        engine.record(botDart(botRemaining(state), dartIndex));
      } else {
        engine.record({ scoreAttempted: 0, finishedOnDouble: false }); // human always leaves it to the bot
      }
      dartIndex++;
      if (state.activeParticipantRef !== engine.state().activeParticipantRef)
        visits++;
      state = engine.state();
    }
    expect(state.status).toBe("WON");
    expect(state.winningSideKey).toBe("B");
  });
});
