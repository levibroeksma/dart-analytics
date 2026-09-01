import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { Bobs27State, DartObservation } from "@modules/types";

/** Mirrors `play-dictated-session.ts`'s own ceiling, same rationale: a real
 * infinite-loop regression should fail fast rather than hang the suite. */
const MAX_DARTS = 500;

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
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats,
};

function missDart(): DartObservation {
  return {
    hitTargetNumber: 1,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function botSeatState(state: Bobs27State) {
  return state.seats.find((seat) => seat.participantRef === BOT_REF)!;
}

/**
 * Drives the same 1v1 shape `bobs27.engine.module.test.ts`'s "Bobs27Engine —
 * 1v1" block already proves alternation for, except the human's darts are
 * fixed misses and the bot's are the real output of the throw pipeline
 * (phase 1) plus `DictatedStrategy` (phase 3) — the join point
 * `08-DartBot.md`'s §Position in the System names, exercised here for the
 * first time against a real `DARTBOT`-typed seat (phase 4).
 */
function playToCompletion() {
  const engine = bobs27EngineFactory.create(config);
  const profile = skillProfileForLevel(BOT_LEVEL);
  let dartIndex = 0;
  let state = engine.state();

  while (state.status === "IN_PROGRESS") {
    if (dartIndex >= MAX_DARTS) {
      throw new Error(`Match did not complete within ${MAX_DARTS} darts`);
    }
    if (state.activeParticipantRef === BOT_REF) {
      const target = targetAt(doublesPath(), botSeatState(state).targetIndex);
      const intent = chooseTarget({ target });
      const rng = createDartRng(BOT_SEED, dartIndex);
      const thrown = throwDart(intent, profile, rng);
      engine.record({
        hitTargetNumber: thrown.hit.targetNumber,
        hitZoneKey: thrown.hit.zoneKey,
        locationX: thrown.landing.x,
        locationY: thrown.landing.y,
      });
    } else {
      engine.record(missDart());
    }
    dartIndex++;
    state = engine.state();
  }

  return engine;
}

describe("DartBot-driven Bob's 27 1v1 — write-path attribution", () => {
  it("reaches a decided outcome with the bot throwing its own visits", () => {
    const state = playToCompletion().state();
    expect(state.status).toBe("COMPLETE");
    expect(["A", "B"]).toContain(state.winningSideKey);
  });

  it("stamps every bot visit with the bot's own participantRef and real darts", () => {
    const engine = playToCompletion();
    const botTurns = engine
      .facts()
      .turns.filter((turn) => turn.participantRef === BOT_REF);
    expect(botTurns.length).toBeGreaterThan(0);
    expect(botTurns.every((turn) => turn.darts.length > 0)).toBe(true);
    expect(
      engine
        .facts()
        .turns.some(
          (turn) =>
            turn.participantRef !== BOT_REF &&
            turn.participantRef !== HUMAN_REF,
        ),
    ).toBe(false);
  });

  it("buildEventsBatch emits the bot's participantRef unchanged for every bot turn", () => {
    const engine = playToCompletion();
    const facts = engine.facts();
    const expectedBotTurnKeys = facts.turns
      .filter((turn) => turn.participantRef === BOT_REF)
      .map((turn) => turn.clientKey);

    const batch = buildEventsBatch(facts);
    const batchBotTurns = batch.stages
      .flatMap((stage) => stage.turns)
      .filter((turn) => expectedBotTurnKeys.includes(turn.clientKey));

    expect(batchBotTurns).toHaveLength(expectedBotTurnKeys.length);
    expect(batchBotTurns.every((turn) => turn.participantRef === BOT_REF)).toBe(
      true,
    );
  });
});
