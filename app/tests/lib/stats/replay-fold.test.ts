import { describe, expect, it } from "vitest";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  getEngineFactory,
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { foldReplay } from "@lib/stats/replay-fold";
import type { RulesetVersionKey } from "@lib/types";
import type { ReplayTurnSchemaData } from "@routes/types";
import {
  PLAYER_ONE,
  PLAYER_TWO,
  SOLO_SEATS,
  SCRIPTED_GAMES,
  playBobs27,
  playFiveOhOne,
  playScoreTraining,
  replayHeader,
} from "./replay-games";

const STAGE_ID = "01900000-0000-7000-9000-000000000001";

function scoreTurn(turnSequence: number, total: number): ReplayTurnSchemaData {
  return {
    stageId: STAGE_ID,
    turnSequence,
    participantId: PLAYER_ONE.participantId,
    turnTotalScore: total,
    darts: [],
  };
}

const BLOCK_STAGE = {
  stageId: STAGE_ID,
  parentStageId: null,
  stageTypeKey: "EXERCISE_BLOCK",
  sequence: 1,
};

function scoreTrainingHeader(configuration: Record<string, unknown> | null) {
  return replayHeader({
    gameTypeKey: "SCORE_TRAINING",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    configuration,
    participants: [PLAYER_ONE],
    stages: [BLOCK_STAGE],
  });
}

const SCORE_TRAINING_WIRE = {
  duration_type: "ROUNDS",
  duration_value: 10,
  max_darts_per_turn: 3,
  max_visit_score: 180,
};

describe("foldReplay", () => {
  it.each(SCRIPTED_GAMES)(
    "folds a %s session to the state its engine ended in",
    (_name, play) => {
      const game = play();
      const fold = foldReplay(game.header, game.turns);

      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.stateAfter(game.turns.length - 1)).toEqual(game.finalState);
    },
  );

  it("reads the state before any turn at index -1 and rejects an index outside the session", () => {
    const game = playScoreTraining();
    const fold = foldReplay(game.header, game.turns);

    if (!fold.ok) throw new Error("expected a fold");
    expect(fold.stateAfter(-1)).toEqual(
      getEngineFactory("SCORE_TRAINING_V1")!.create(game.config).state(),
    );
    expect(() => fold.stateAfter(game.turns.length)).toThrow(RangeError);
    expect(() => fold.stateAfter(-2)).toThrow(RangeError);
  });

  it("pairs every turn with the states either side of it", () => {
    const game = playBobs27();
    const fold = foldReplay(game.header, game.turns);

    if (!fold.ok) throw new Error("expected a fold");
    expect(fold.steps).toHaveLength(game.turns.length);
    fold.steps.forEach((step, index) => {
      expect(step.before).toBe(fold.stateAfter(index - 1));
      expect(step.after).toBe(fold.stateAfter(index));
      expect(step.turn.participantRef).toBe(game.turns[index]!.participantId);
    });
  });

  it("folds a 501 checkout to the leg it finished, not the next leg the engine opened", () => {
    const game = playFiveOhOne();
    const fold = foldReplay(game.header, game.turns);

    if (!fold.ok) throw new Error("expected a fold");
    const checkoutState = fold.stateAfter(4) as {
      seats: { participantRef: string; remainingScore: number }[];
    };
    expect(
      checkoutState.seats.find(
        (seat) => seat.participantRef === PLAYER_ONE.participantId,
      )!.remainingScore,
    ).toBe(0);
  });

  it("synthesizes the one seat of a seatless single-participant snapshot", () => {
    const fold = foldReplay(scoreTrainingHeader(SCORE_TRAINING_WIRE), [
      scoreTurn(1, 60),
      scoreTurn(2, 45),
    ]);

    if (!fold.ok) throw new Error("expected a fold");
    expect(fold.snapshot.seats).toEqual([
      {
        participantRef: PLAYER_ONE.participantId,
        displayName: PLAYER_ONE.displayName,
        sideKey: "A",
        participantTypeKey: PLAYER_ONE.participantTypeKey,
      },
    ]);
    expect(fold.stateAfter(1)).toMatchObject({
      seats: [{ participantRef: PLAYER_ONE.participantId, totalScore: 105 }],
    });
  });

  describe("skips rather than guesses", () => {
    it("NO_SNAPSHOT when the session stored no configuration", () => {
      expect(foldReplay(scoreTrainingHeader(null), [scoreTurn(1, 60)])).toEqual(
        { ok: false, reason: "NO_SNAPSHOT" },
      );
    });

    it("NO_SNAPSHOT when the stored configuration no longer decodes", () => {
      expect(
        foldReplay(scoreTrainingHeader({ duration_type: "LAPS" }), [
          scoreTurn(1, 60),
        ]),
      ).toEqual({ ok: false, reason: "NO_SNAPSHOT" });
    });

    it("NO_ENGINE when no engine is registered for the ruleset", () => {
      const keys = Object.keys(GAME_TYPE_BY_RULESET) as RulesetVersionKey[];
      const factories = keys.map((key) => getEngineFactory(key)!);
      resetEngineRegistry();
      try {
        expect(
          foldReplay(scoreTrainingHeader(SCORE_TRAINING_WIRE), [
            scoreTurn(1, 60),
          ]),
        ).toEqual({ ok: false, reason: "NO_ENGINE" });
      } finally {
        factories.forEach(registerEngineFactory);
      }
    });

    it("SEATLESS_MULTI when a seatless snapshot has more than one participant", () => {
      const header = {
        ...scoreTrainingHeader(SCORE_TRAINING_WIRE),
        participants: [PLAYER_ONE, PLAYER_TWO],
      };
      expect(foldReplay(header, [scoreTurn(1, 60)])).toEqual({
        ok: false,
        reason: "SEATLESS_MULTI",
      });
    });

    it("ENGINE_THREW when a turn names a participant who holds no seat", () => {
      const header = scoreTrainingHeader({
        ...SCORE_TRAINING_WIRE,
        seats: SOLO_SEATS,
      });
      const stranger = {
        ...scoreTurn(2, 45),
        participantId: PLAYER_TWO.participantId,
      };
      expect(foldReplay(header, [scoreTurn(1, 60), stranger])).toEqual({
        ok: false,
        reason: "ENGINE_THREW",
      });
    });

    it("ENGINE_THREW when a turn names a stage outside the session", () => {
      const header = scoreTrainingHeader({
        ...SCORE_TRAINING_WIRE,
        seats: SOLO_SEATS,
      });
      const astray = {
        ...scoreTurn(1, 60),
        stageId: "01900000-0000-7000-8000-00000000ffff",
      };
      expect(foldReplay(header, [astray])).toEqual({
        ok: false,
        reason: "ENGINE_THREW",
      });
    });

    it("ENGINE_THREW when the engine rejects the snapshot", () => {
      const header = replayHeader({
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        configuration: {
          starting_score: 101,
          legs_to_win: 1,
          check_in: "STRAIGHT_IN",
          check_out: "DOUBLE_OUT",
          max_darts_per_turn: 3,
          max_visit_score: 180,
        },
        participants: [],
        stages: [],
      });
      expect(foldReplay(header, [])).toEqual({
        ok: false,
        reason: "ENGINE_THREW",
      });
    });
  });

  it("folds every turn of a 600-turn Score Training session in under a second", () => {
    const header = scoreTrainingHeader({
      duration_type: "MINUTES",
      duration_value: 30,
      max_darts_per_turn: 3,
      max_visit_score: 180,
      seats: SOLO_SEATS,
    });
    const turns = Array.from({ length: 600 }, (_, index) => ({
      ...scoreTurn(index + 1, 60),
      darts: [1, 2, 3].map((dartNumber) => ({
        dartNumber,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "OUTER_SINGLE",
        score: 20,
        locationX: null,
        locationY: null,
      })),
    }));

    const started = performance.now();
    const fold = foldReplay(header, turns);
    if (!fold.ok) throw new Error("expected a fold");
    for (let index = 0; index < turns.length; index += 1) {
      fold.stateAfter(index);
    }
    const elapsed = performance.now() - started;

    expect(fold.stateAfter(599)).toMatchObject({
      seats: [{ turnCount: 600, totalScore: 36000 }],
    });
    expect(elapsed).toBeLessThan(1000);
  });
});
