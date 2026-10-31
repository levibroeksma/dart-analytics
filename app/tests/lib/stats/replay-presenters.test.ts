import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { describe, expect, it } from "vitest";
import { boardTargetLabel } from "@modules/game/board-progression.module";
import { foldReplay } from "@lib/stats/replay-fold";
import { legsWonIn, REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import type { GameTypeKey, ReplayCell, ReplayFold } from "@lib/types";
import {
  BaseballEngine,
  initialBaseballState,
} from "@modules/game/baseball.engine.module";
import { KillerEngine } from "@modules/game/killer.engine.module";
import {
  foldPrisonerState,
  PrisonerEngine,
} from "@modules/game/prisoner.engine.module";
import {
  foldFollowTheLeaderState,
  FollowTheLeaderEngine,
} from "@modules/game/follow-the-leader.engine.module";
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
  playBaseballDuel,
  playNineLivesDuel,
  playBobs27,
  playDoubles,
  playDoublesUnfinished,
  playFiveOhOne,
  playNineLives,
  playOneTwentyOne,
  playPrisoner,
  playScoreTraining,
  playShanghai,
  playShanghaiRange,
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

describe("REPLAY_PRESENTERS.CRICKET 1v1", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: "p2",
        displayName: "G",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const dart = (n: number | null, zone: "TREBLE" | "SINGLE" | "MISS") => ({
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  });

  function duelVisit() {
    const engine = new CricketEngine(config, undefined, "CRICKET_V2");
    for (const observation of [
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
    ]) {
      engine.record(observation);
    }
    return engine;
  }

  it("adds a Points cell for two seats", () => {
    const engine = duelVisit();
    const turn = engine.facts().turns[1];
    const cells = REPLAY_PRESENTERS.CRICKET.turn(
      { turn, before: initialCricketState(config), after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["3", "1/7", "20"]);
  });

  it("ends the two-seat session line on points", () => {
    const engine = duelVisit();
    const turn = engine.facts().turns[1];
    const line = REPLAY_PRESENTERS.CRICKET.session(
      [{ turn, before: initialCricketState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Points", value: "0" },
      { participantId: "p2", label: "Points", value: "20" },
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

describe("REPLAY_PRESENTERS.TACTICS 1v1", () => {
  const config = {
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: "p2",
        displayName: "G",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const dart = (n: number | null, zone: "TREBLE" | "SINGLE" | "MISS") => ({
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  });

  function duelVisit() {
    const engine = new TacticsEngine(config, undefined, "TACTICS_V2");
    for (const observation of [
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
    ]) {
      engine.record(observation);
    }
    return engine;
  }

  it("adds a Points cell for two seats", () => {
    const engine = duelVisit();
    const turn = engine.facts().turns[1];
    const cells = REPLAY_PRESENTERS.TACTICS.turn(
      { turn, before: initialTacticsState(config), after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["3", "1/9", "20"]);
  });

  it("ends the two-seat session line on points", () => {
    const engine = duelVisit();
    const turn = engine.facts().turns[1];
    const line = REPLAY_PRESENTERS.TACTICS.session(
      [{ turn, before: initialTacticsState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Points", value: "0" },
      { participantId: "p2", label: "Points", value: "20" },
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

  describe("Around the Clock — Nine Lives", () => {
    it("shows the lives left after each visit", () => {
      expect(valuesOf(turnCells(playNineLives()), "Lives")).toEqual([
        "3",
        "2",
        "1",
        "0",
      ]);
    });

    it("reads a seat that ran out of lives as Out", () => {
      expect(sessionLine(playNineLives()).entries[0]!.value).toBe("Out");
    });

    it("shows no Lives cell for a V1 run", () => {
      expect(valuesOf(turnCells(playAroundTheClock()), "Lives")).toEqual([
        "",
        "",
        "",
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
    expect(valuesOf(cells, "Target")).toEqual(
      [2, 3, 4].map((number) => boardTargetLabel({ kind: "NUMBER", number })),
    );
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

  it("marks Shanghai V3 hits on each round's number within an 11-20 range", () => {
    const game = playShanghaiRange();
    const cells = turnCells(game);

    expect(valuesOf(cells, "Target")).toEqual(["12", "13", "14"]);
    expect(marksOf(cells)).toEqual([
      ["hit", "hit", "miss"],
      ["hit", "miss", "miss"],
      ["miss", "miss", "miss"],
    ]);
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

describe("legsWonIn", () => {
  it("detects a leg win at a set boundary, where current-set legsWon resets", () => {
    const before = {
      sides: [{ sideKey: "A", legsWon: 1, setsWon: 0 }],
      sets: [{ legsWon: { A: 1 }, winner: null }],
    };
    const after = {
      sides: [{ sideKey: "A", legsWon: 0, setsWon: 1 }],
      sets: [
        { legsWon: { A: 2 }, winner: "A" },
        { legsWon: { A: 0 }, winner: null },
      ],
    };
    expect(legsWonIn(after)).toBeGreaterThan(legsWonIn(before));
  });
});

describe("REPLAY_PRESENTERS.BASEBALL", () => {
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
  const on = (hitTargetNumber: number, hitZoneKey: "TREBLE" | "SINGLE") => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });

  function twoInnings() {
    const engine = new BaseballEngine(config);
    for (const observation of [
      on(1, "TREBLE"),
      on(1, "SINGLE"),
      on(20, "TREBLE"),
      on(2, "SINGLE"),
      on(2, "SINGLE"),
      on(2, "SINGLE"),
    ])
      engine.record(observation);
    return engine;
  }

  it("shows the inning, its runs and the running total after each visit", () => {
    const engine = twoInnings();
    const [, second] = engine.facts().turns;
    const before = new BaseballEngine(config, {
      stages: engine.facts().stages,
      turns: engine.facts().turns.slice(0, 1),
    }).state();
    const cells = REPLAY_PRESENTERS.BASEBALL.turn(
      { turn: second, before, after: engine.state() },
      config,
    );
    expect(
      cells.map((cell) => (cell.kind === "value" ? cell.value : "")),
    ).toEqual(["2", "3", "7"]);
  });

  it("ends the session line on runs", () => {
    const engine = twoInnings();
    const [turn] = engine.facts().turns;
    const line = REPLAY_PRESENTERS.BASEBALL.session(
      [{ turn, before: initialBaseballState(config), after: engine.state() }],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Runs", value: "7" },
    ]);
  });
});

describe("REPLAY_PRESENTERS two-seat Baseball and Nine Lives", () => {
  it("reads each Baseball seat's own inning, runs and total", () => {
    const cells = turnCells(playBaseballDuel());
    expect(valuesOf(cells, "Inning")).toEqual(["1", "1", "2", "2"]);
    expect(valuesOf(cells, "Runs")).toEqual(["4", "1", "1", "3"]);
    expect(valuesOf(cells, "Total")).toEqual(["4", "1", "5", "4"]);
  });

  it("ends the Baseball session line on both seats' runs", () => {
    expect(sessionLine(playBaseballDuel()).entries).toEqual([
      { participantId: PLAYER_ONE.participantId, label: "Runs", value: "5" },
      { participantId: PLAYER_TWO.participantId, label: "Runs", value: "4" },
    ]);
  });

  it("shows each Nine Lives seat's own lives after its visit", () => {
    expect(valuesOf(turnCells(playNineLivesDuel()), "Lives")).toEqual([
      "3",
      "2",
      "2",
      "1",
      "1",
      "0",
    ]);
  });

  it("ends the Nine Lives session with the survivor's win and the other seat out", () => {
    const game = playNineLivesDuel();
    expect(game.finalState).toMatchObject({
      status: "COMPLETE",
      winningSideKey: "A",
    });
    const entries = sessionLine(game).entries;
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      participantId: PLAYER_TWO.participantId,
      value: "Out",
    });
    expect(entries[0]!.value).not.toBe("Out");
  });
});

describe("REPLAY_PRESENTERS.KILLER", () => {
  const config = {
    lives: 3 as const,
    seatNumbers: [5, 12],
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: "p2",
        displayName: "G",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const double = (hitTargetNumber: number) => ({
    hitTargetNumber,
    hitZoneKey: "DOUBLE" as const,
    locationX: null,
    locationY: null,
  });

  function oneVisit() {
    const engine = new KillerEngine(config);
    for (const n of [5, 12, 12]) engine.record(double(n));
    return engine;
  }

  it("shows the thrower's lives and the lives taken this visit", () => {
    const engine = oneVisit();
    const [turn] = engine.facts().turns;
    const before = new KillerEngine(config).state();
    const cells = REPLAY_PRESENTERS.KILLER.turn(
      { turn, before, after: engine.state() },
      config,
    );
    expect(cells).toEqual([
      { kind: "value", label: "Lives", value: "3" },
      { kind: "value", label: "Taken", value: "2" },
    ]);
  });

  it("ends the session line on lives", () => {
    const engine = oneVisit();
    const [turn] = engine.facts().turns;
    const line = REPLAY_PRESENTERS.KILLER.session(
      [
        {
          turn,
          before: new KillerEngine(config).state(),
          after: engine.state(),
        },
      ],
      config,
    );
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Lives", value: "3" },
      { participantId: "p2", label: "Lives", value: "1" },
    ]);
  });
});

describe("REPLAY_PRESENTERS.FOLLOW_THE_LEADER", () => {
  const config = {
    lives: 3 as const,
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: "p2",
        displayName: "G",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const hit = (
    hitTargetNumber: number | null,
    hitZoneKey: "TREBLE" | "OUTER_SINGLE" | "MISS",
  ) => ({ hitTargetNumber, hitZoneKey, locationX: null, locationY: null });
  const t18 = hit(18, "TREBLE");
  const s18 = hit(18, "OUTER_SINGLE");

  const miss = hit(null, "MISS");

  function stepsFor(record: (engine: FollowTheLeaderEngine) => void) {
    const engine = new FollowTheLeaderEngine(config);
    record(engine);
    const { stages, turns } = engine.facts();
    return turns.map((turn, i) => ({
      turn,
      before: foldFollowTheLeaderState(
        { stages, turns: turns.slice(0, i) },
        config,
      ),
      after: foldFollowTheLeaderState(
        { stages, turns: turns.slice(0, i + 1) },
        config,
      ),
    }));
  }

  function steps() {
    return stepsFor((engine) => {
      for (const input of [t18, s18, s18, s18, { kind: "KEEP" as const }, t18])
        engine.record(input);
      engine.record({ kind: "STOP" });
    });
  }

  it("shows Retry for a setting dart that landed off the board", () => {
    const retries = stepsFor((engine) => {
      for (const input of [miss, t18, s18, s18, s18, miss, t18])
        engine.record(input);
    }).map((step) => REPLAY_PRESENTERS.FOLLOW_THE_LEADER.turn(step, config)[1]);
    expect(retries).toEqual([
      { kind: "value", label: "Result", value: "Retry" },
      { kind: "value", label: "Result", value: "Set" },
      { kind: "value", label: "Result", value: "Fail" },
      { kind: "value", label: "Result", value: "Retry" },
      { kind: "value", label: "Result", value: "Set" },
    ]);
  });

  it("shows the thrower's lives and the visit's result", () => {
    const cells = steps().map((step) =>
      REPLAY_PRESENTERS.FOLLOW_THE_LEADER.turn(step, config),
    );
    expect(cells).toEqual([
      [
        { kind: "value", label: "Lives", value: "3" },
        { kind: "value", label: "Result", value: "Set" },
      ],
      [
        { kind: "value", label: "Lives", value: "2" },
        { kind: "value", label: "Result", value: "Fail" },
      ],
      [
        { kind: "value", label: "Lives", value: "3" },
        { kind: "value", label: "Result", value: "Keep" },
      ],
      [
        { kind: "value", label: "Lives", value: "2" },
        { kind: "value", label: "Result", value: "Match" },
      ],
    ]);
  });

  it("ends the session line on lives", () => {
    const line = REPLAY_PRESENTERS.FOLLOW_THE_LEADER.session(steps(), config);
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Lives", value: "3" },
      { participantId: "p2", label: "Lives", value: "2" },
    ]);
  });
});

describe("REPLAY_PRESENTERS.PRISONER", () => {
  const config = {
    darts: 3 as const,
    seats: [
      {
        participantRef: "p1",
        displayName: "L",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: "p2",
        displayName: "G",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const located = (
    n: number,
    zone: "OUTER_SINGLE" | "INNER_SINGLE" | "DOUBLE",
  ) => {
    const point = zoneCentroid(n, zone);
    if (!point) throw new Error("no centroid");
    return {
      hitTargetNumber: n,
      hitZoneKey: zone,
      locationX: point.x,
      locationY: point.y,
    };
  };
  const miss = {
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: null,
    locationY: null,
  };
  const bull = {
    hitTargetNumber: 25,
    hitZoneKey: "OUTER_BULL" as const,
    locationX: 10,
    locationY: 0,
  };

  function steps() {
    const engine = new PrisonerEngine(config);
    for (const input of [
      located(1, "INNER_SINGLE"),
      located(1, "OUTER_SINGLE"),
      located(2, "OUTER_SINGLE"),
      located(1, "OUTER_SINGLE"),
      miss,
      bull,
      located(3, "OUTER_SINGLE"),
      located(4, "OUTER_SINGLE"),
      located(5, "INNER_SINGLE"),
      located(5, "OUTER_SINGLE"),
    ])
      engine.record(input);
    const { stages, turns } = engine.facts();
    return turns.map((turn, i) => ({
      turn,
      before: foldPrisonerState({ stages, turns: turns.slice(0, i) }, config),
      after: foldPrisonerState(
        { stages, turns: turns.slice(0, i + 1) },
        config,
      ),
    }));
  }

  it("shows the thrower's darts held after the visit and what each dart did", () => {
    const cells = steps().map((step) =>
      REPLAY_PRESENTERS.PRISONER.turn(step, config),
    );
    expect(cells).toEqual([
      [
        { kind: "value", label: "Darts", value: "3" },
        {
          kind: "value",
          label: "Result",
          value: "Prison, Advance and capture, Advance",
        },
      ],
      [
        { kind: "value", label: "Darts", value: "2" },
        { kind: "value", label: "Result", value: "Advance, Miss, Prison" },
      ],
      [
        { kind: "value", label: "Darts", value: "2" },
        { kind: "value", label: "Result", value: "Advance, Advance, Prison" },
      ],
      [
        { kind: "value", label: "Darts", value: "3" },
        { kind: "value", label: "Result", value: "Capture" },
      ],
    ]);
  });

  it("replays a stored game to the live engine's state after every visit", () => {
    const game = playPrisoner();
    const fold = folded(game);
    expect(fold.steps.map((step) => step.after)).toEqual(game.liveStates);
    expect(valuesOf(turnCells(game), "Darts")).toEqual([
      "3",
      "2",
      "2",
      "3",
      "2",
      "3",
      "3",
    ]);
    expect(valuesOf(turnCells(game), "Result")).toEqual([
      "Prison, Advance and capture, Advance",
      "Advance, Miss, Prison",
      "Advance, Advance, Prison",
      "Capture",
      "Miss, Miss",
      "Miss, Miss, Miss",
      "Advance, Advance, Advance",
    ]);
  });

  it("ends the session line on darts held", () => {
    const line = REPLAY_PRESENTERS.PRISONER.session(steps(), config);
    expect(line.entries).toEqual([
      { participantId: "p1", label: "Darts", value: "2" },
      { participantId: "p2", label: "Darts", value: "3" },
    ]);
  });
});
