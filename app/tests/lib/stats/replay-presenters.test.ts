import { describe, expect, it } from "vitest";
import { foldReplay } from "@lib/stats/replay-fold";
import { REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import type { GameTypeKey, ReplayCell, ReplayFold } from "@lib/types";
import {
  CricketEngine,
  initialCricketState,
} from "@modules/game/cricket.engine.module";
import {
  initialTacticsState,
  TacticsEngine,
} from "@modules/game/tactics.engine.module";
import type { Bobs27State } from "@modules/types";
import {
  PLAYER_ONE,
  PLAYER_TWO,
  playAroundTheClock,
  playBobs27,
  playDoubles,
  playDoublesUnfinished,
  playFiveOhOne,
  playOneTwentyOne,
  playScoreTraining,
  playShanghai,
  playSingles,
  playTuod,
  type ScriptedGame,
} from "./replay-games";

type OkFold = Extract<ReplayFold, { ok: true }>;

function folded(game: ScriptedGame): OkFold {
  const fold = foldReplay(game.header, game.turns);
  if (!fold.ok) throw new Error(`fold skipped: ${fold.reason}`);
  return fold;
}

function presenterFor(game: ScriptedGame) {
  return REPLAY_PRESENTERS[game.header.gameTypeKey as GameTypeKey];
}

function turnCells(game: ScriptedGame): ReplayCell[][] {
  const fold = folded(game);
  return fold.steps.map((step) => presenterFor(game).turn(step, fold.snapshot));
}

function valuesOf(cells: ReplayCell[][], label: string): string[] {
  return cells.map((row) => {
    const cell = row.find((candidate) => candidate.label === label);
    return cell?.kind === "value" ? cell.value : "";
  });
}

function marksOf(cells: ReplayCell[][]): string[][] {
  return cells.map((row) => {
    const cell = row.find((candidate) => candidate.kind === "marks");
    return cell?.kind === "marks" ? [...cell.marks] : [];
  });
}

function sessionLine(game: ScriptedGame) {
  const fold = folded(game);
  return presenterFor(game).session(fold.steps, fold.snapshot);
}

describe("REPLAY_PRESENTERS.CRICKET", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
    ],
  };
  const t20 = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE" as const,
    locationX: null,
    locationY: null,
  };
  const miss = {
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: null,
    locationY: null,
  };

  function playedVisit() {
    const engine = new CricketEngine(config);
    engine.record(t20);
    engine.record(t20);
    engine.record(miss);
    return engine;
  }

  it("shows capped marks and closed count after a visit", () => {
    const engine = playedVisit();
    const [turn] = engine.facts().turns;
    const cells = REPLAY_PRESENTERS.CRICKET.turn(
      { turn, before: initialCricketState(config), after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["3", "1/7"]);
  });

  it("ends the session line on darts thrown", () => {
    const engine = playedVisit();
    const [turn] = engine.facts().turns;
    const line = REPLAY_PRESENTERS.CRICKET.session(
      [{ turn, before: initialCricketState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Darts", value: "3" },
    ]);
  });
});

describe("REPLAY_PRESENTERS.TACTICS", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
    ],
  };
  const t20 = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE" as const,
    locationX: null,
    locationY: null,
  };
  const miss = {
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: null,
    locationY: null,
  };

  function playedVisit() {
    const engine = new TacticsEngine(config);
    engine.record(t20);
    engine.record(t20);
    engine.record(miss);
    return engine;
  }

  it("shows capped marks and closed count after a visit", () => {
    const engine = playedVisit();
    const [turn] = engine.facts().turns;
    const cells = REPLAY_PRESENTERS.TACTICS.turn(
      { turn, before: initialTacticsState(config), after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["4", "1/9"]);
  });

  it("ends the session line on darts thrown", () => {
    const engine = playedVisit();
    const [turn] = engine.facts().turns;
    const line = REPLAY_PRESENTERS.TACTICS.session(
      [{ turn, before: initialTacticsState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Darts", value: "3" },
    ]);
  });
});

describe("REPLAY_PRESENTERS", () => {
  describe("501", () => {
    it("shows each seat's remaining after the visit, a checkout at zero", () => {
      expect(valuesOf(turnCells(playFiveOhOne()), "Remaining")).toEqual([
        "20",
        "98",
        "20",
        "95",
        "0",
        "101",
        "0",
      ]);
    });

    it("flags the busted visits only", () => {
      const flagged = turnCells(playFiveOhOne()).map((row) =>
        row.some((cell) => cell.kind === "flag" && cell.label === "Bust"),
      );
      expect(flagged).toEqual([false, false, true, false, false, true, false]);
    });

    it("names the winner of each leg", () => {
      expect(sessionLine(playFiveOhOne()).entries).toEqual([
        {
          participantId: PLAYER_ONE.participantId,
          label: "Leg 1",
          value: "Won",
        },
        {
          participantId: PLAYER_ONE.participantId,
          label: "Leg 2",
          value: "Won",
        },
      ]);
    });
  });

  describe("Bob's 27", () => {
    it("shows the running score the engine held after each visit", () => {
      const game = playBobs27();
      const engineScores = game.liveStates.map((state) =>
        String((state as Bobs27State).seats[0]!.score),
      );

      expect(valuesOf(turnCells(game), "Score")).toEqual(engineScores);
      expect(engineScores).toEqual(["29", "25", "37"]);
    });

    it("draws one curve point per visit, each the engine's seat score", () => {
      const game = playBobs27();
      const { curves, entries } = sessionLine(game);

      expect(curves).toEqual([
        { participantId: PLAYER_ONE.participantId, points: [29, 25, 37] },
      ]);
      expect(curves[0]!.points).toHaveLength(game.turns.length);
      expect(entries).toEqual([
        {
          participantId: PLAYER_ONE.participantId,
          label: "Score",
          value: "37",
        },
      ]);
    });
  });

  describe("Around the Clock", () => {
    it("advances the active target on a hit and holds it on a miss", () => {
      const cells = turnCells(playAroundTheClock());

      expect(valuesOf(cells, "Target")).toEqual(["3", "4", "4"]);
      expect(marksOf(cells)).toEqual([
        ["hit", "hit", "miss"],
        ["miss", "miss", "hit"],
        ["miss", "miss", "miss"],
      ]);
    });

    it("reports where the seat finished", () => {
      expect(sessionLine(playAroundTheClock()).entries).toEqual([
        {
          participantId: PLAYER_ONE.participantId,
          label: "Progress",
          value: "4",
        },
      ]);
    });
  });

  it("shows 121's target and remaining, and the final target", () => {
    const game = playOneTwentyOne();
    const cells = turnCells(game);

    expect(valuesOf(cells, "Target")).toEqual(["121", "121", "122", "122"]);
    expect(valuesOf(cells, "Remaining")).toEqual(["61", "40", "122", "22"]);
    expect(sessionLine(game).entries).toEqual([
      {
        participantId: PLAYER_ONE.participantId,
        label: "Final target",
        value: "122",
      },
    ]);
  });

  it("shows TUOD's target after each attempt", () => {
    const game = playTuod();

    expect(valuesOf(turnCells(game), "Target")).toEqual(["51", "50", "60"]);
    expect(sessionLine(game).entries[0]!.value).toBe("60");
  });

  it("shows each Score Training seat's running total", () => {
    const game = playScoreTraining();

    expect(valuesOf(turnCells(game), "Total")).toEqual([
      "60",
      "45",
      "160",
      "71",
      "241",
      "211",
    ]);
    expect(sessionLine(game).entries).toEqual([
      { participantId: PLAYER_ONE.participantId, label: "Total", value: "241" },
      { participantId: PLAYER_TWO.participantId, label: "Total", value: "211" },
    ]);
  });

  it("marks Singles hits against the target each visit was thrown at", () => {
    const cells = turnCells(playSingles());

    expect(valuesOf(cells, "Target")).toEqual(["2", "3", "4"]);
    expect(marksOf(cells)).toEqual([
      ["hit", "hit", "miss"],
      ["miss", "hit", "miss"],
      ["miss", "miss", "miss"],
    ]);
  });

  it("marks the dart that hit each Doubles target", () => {
    const cells = turnCells(playDoubles());

    expect(valuesOf(cells, "Target")).toEqual(["D2", "D3", "D4"]);
    expect(marksOf(cells)).toEqual([
      ["miss", "hit"],
      ["miss", "miss", "miss"],
      ["hit"],
    ]);
  });

  it("marks every dart of a Doubles visit that recorded no outcome a miss", () => {
    const game = playDoublesUnfinished();
    const cells = turnCells(game);

    expect(game.turns.map((turn) => turn.darts.length)).toEqual([2, 2]);
    expect(valuesOf(cells, "Target")).toEqual(["D2", "D2"]);
    expect(marksOf(cells)).toEqual([
      ["miss", "hit"],
      ["miss", "miss"],
    ]);
  });

  it("marks Shanghai hits on each round's number", () => {
    const game = playShanghai();
    const cells = turnCells(game);

    expect(valuesOf(cells, "Target")).toEqual(["2", "3", "4"]);
    expect(marksOf(cells)).toEqual([
      ["hit", "hit", "miss"],
      ["hit", "miss", "miss"],
      ["miss", "miss", "miss"],
    ]);
    expect(sessionLine(game).entries[0]!.value).toBe("4");
  });

  it("gives an empty session line to a session with no turns", () => {
    const game = playBobs27();
    const fold = folded(game);

    expect(REPLAY_PRESENTERS.BOBS27.session([], fold.snapshot)).toEqual({
      entries: [],
      curves: [],
    });
  });
});
