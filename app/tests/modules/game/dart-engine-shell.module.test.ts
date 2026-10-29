import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "@modules/game/dart-engine-shell.module";
import type { DartGameSpec } from "@modules/interfaces";
import type { DartObservation, EngineFacts } from "@modules/types";

type Toy = { activeParticipantRef: string; status: string; darts: number };

const spec: DartGameSpec<{ limit: number }, Toy> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts, config) => {
    const darts = facts.turns.reduce((n, t) => n + t.darts.length, 0);
    return {
      activeParticipantRef: "p1",
      status: darts >= config.limit ? "COMPLETE" : "IN_PROGRESS",
      darts,
    };
  },
  refusal: (s) => (s.status === "IN_PROGRESS" ? null : "toy is over"),
  intent: () => ({ intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }),
  isVisitOpen: (t) => t.darts.length < 3,
  wouldComplete: (s, _o, c) => s.darts + 1 >= c.limit,
};

const T20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: null,
  locationY: null,
};

const Toy = dartGameEngineClass(spec);

afterEach(() => vi.useRealTimers());

describe("dartGameEngineClass", () => {
  it("records into one visit until it closes, stamping completedAt on the closing dart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).toBe(
      "2026-11-01T10:00:00.000Z",
    );
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[0].darts[0]).toMatchObject({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      score: 60,
    });
  });

  it("refuses with the spec's message and leaves facts untouched", () => {
    const engine = new Toy({ limit: 1 });
    engine.record(T20);
    const before = engine.facts();
    expect(() => engine.record(T20)).toThrow("toy is over");
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(true);
  });

  it("undo reopens a closed visit and empties to false", () => {
    const engine = new Toy({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rehydrates mid-visit and keeps appending to the open turn", () => {
    const first = new Toy({ limit: 10 });
    first.record(T20);
    const prior: EngineFacts = first.facts();
    const second = new Toy({ limit: 10 }, prior);
    second.record(T20);
    expect(second.facts().turns).toHaveLength(1);
    expect(second.facts().turns[0].darts).toHaveLength(2);
  });

  it("returns detached copies from state() and facts()", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.facts().turns.pop();
    (engine.state() as Toy).darts = 99;
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state().darts).toBe(1);
  });

  it("keeps facts() darts detached from the engine's live log", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.facts().turns[0].darts[0].hitZoneKey = "MISS";
    expect(engine.facts().turns[0].darts[0].hitZoneKey).toBe("TREBLE");
  });

  it("delegates wouldComplete to the spec without mutating", () => {
    const engine = new Toy({ limit: 2 });
    engine.record(T20);
    expect(engine.wouldComplete(T20)).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("dartGameEngineFactory", () => {
  it("carries the spec's key and ownership and builds the class", () => {
    const factory = dartGameEngineFactory(spec, Toy);
    expect(factory.rulesetVersionKey).toBe("BOBS27_V1");
    expect(factory.stageOwnership).toBe("PER_SEAT");
    expect(factory.create({ limit: 3 })).toBeInstanceOf(Toy);
  });
});

describe("multi-key specs", () => {
  const multi: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    rulesetVersionKey: "SINGLES_V1",
    rulesetVersionKeys: ["SINGLES_V2", "SINGLES_V3"],
  };
  const Multi = dartGameEngineClass(multi);

  it("defaults an instance to the spec's own key", () => {
    expect(new Multi({ limit: 3 }).rulesetVersionKey).toBe("SINGLES_V1");
  });

  it("builds one factory per served key over the one class", () => {
    const v2 = dartGameEngineFactory(multi, Multi, "SINGLES_V2");
    expect(v2.rulesetVersionKey).toBe("SINGLES_V2");
    const engine = v2.create({ limit: 10 });
    expect(engine).toBeInstanceOf(Multi);
    expect(engine.rulesetVersionKey).toBe("SINGLES_V2");
  });

  it("keeps the key across rehydration", () => {
    const v3 = dartGameEngineFactory(multi, Multi, "SINGLES_V3");
    const first = v3.create({ limit: 10 });
    first.record(T20);
    expect(v3.create({ limit: 10 }, first.facts()).rulesetVersionKey).toBe(
      "SINGLES_V3",
    );
  });

  it("refuses a key the spec does not serve", () => {
    expect(() => dartGameEngineFactory(spec, Toy, "SINGLES_V2")).toThrow(
      "SINGLES_V2 is not served by this spec",
    );
  });
});

describe("timer and state-aware visits", () => {
  const timedSpec: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    fold: (facts, config, timerExpired) => {
      const state = spec.fold(facts, config, timerExpired);
      return timerExpired ? { ...state, status: "COMPLETE" } : state;
    },
  };
  const Timed = dartGameEngineClass(timedSpec);

  it("threads expireTimer() into fold, and undo leaves it set", () => {
    const engine = new Timed({ limit: 10 });
    engine.record(T20);
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(true);
  });

  it("starts unexpired when rehydrated", () => {
    const engine = new Timed({ limit: 10 });
    engine.record(T20);
    engine.expireTimer();
    expect(new Timed({ limit: 10 }, engine.facts()).isComplete()).toBe(false);
  });

  it("closes a visit short when isVisitOpen reads the folded state", () => {
    const Short = dartGameEngineClass<{ limit: number }, Toy>({
      ...spec,
      isVisitOpen: (t, s) => t.darts.length < 3 && s.darts !== 2,
    });
    const engine = new Short({ limit: 10 });
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[1].completedAt).toBeNull();
  });
});

describe("closed visit totals", () => {
  const calls: [number, number, string][] = [];
  const Totalled = dartGameEngineClass<{ limit: number }, Toy>({
    ...spec,
    closedVisitTotal: (opened, closed, participantRef) => {
      calls.push([opened.darts, closed.darts, participantRef]);
      return closed.darts - opened.darts;
    },
  });

  it("writes the spec's total on the closing dart, from the state the visit opened on", () => {
    calls.length = 0;
    const engine = new Totalled({ limit: 10 });
    [T20, T20, T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.facts().turns[0].totalScore).toBe(3);
    expect(engine.facts().turns[1].totalScore).toBe(120);
    engine.record(T20);
    expect(engine.facts().turns[1].totalScore).toBe(3);
    expect(calls).toEqual([
      [0, 3, "p1"],
      [3, 6, "p1"],
    ]);
  });

  it("undo of the closing dart restores the board-score sum", () => {
    const engine = new Totalled({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    engine.undo();
    expect(engine.facts().turns[0]).toMatchObject({
      completedAt: null,
      totalScore: 120,
    });
  });

  it("leaves the board-score sum without the hook", () => {
    const engine = new Toy({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.facts().turns[0].totalScore).toBe(180);
  });
});

type Keypad = { total: number };

type Pad = Toy & { open: boolean };

const padSpec: DartGameSpec<{ limit: number }, Pad, Keypad> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts, config) => {
    const turns = facts.turns.length;
    return {
      activeParticipantRef: "p1",
      status: turns >= config.limit ? "COMPLETE" : "IN_PROGRESS",
      darts: facts.turns.reduce((n, t) => n + t.darts.length, 0),
      open: facts.turns.at(-1)?.completedAt === null,
    };
  },
  refusal: () => null,
  intent: () => ({ intendedTargetNumber: null, intendedZoneKey: null }),
  isVisitOpen: (turn, _state, config) =>
    turn.completedAt === null && turn.darts.length < config.limit,
  wouldComplete: (state, input, _config, open) =>
    "total" in input
      ? open === null
      : (open?.darts.length ?? 0) + 1 >= 2 && state.darts >= 0,
  visitInput: {
    isVisit: (input): input is Keypad => "total" in input,
    refusal: (_state, _input, _config, open) =>
      open === null ? null : "board visit open",
    total: (_state, input) => input.total,
  },
  coordinateCapture: true,
  closedVisitTotal: (_opened, _closed, _ref, turn, config) =>
    turn.darts.length * 100 + config.limit * 0,
  complete: (state) => state.darts >= 4,
};

const Pad = dartGameEngineClass(padSpec);

describe("dartGameEngineClass — visit input hooks", () => {
  it("writes a keypad total as one closed dartless turn", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const engine = new Pad({ limit: 2 });
    engine.record({ total: 41 });
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0]).toMatchObject({
      darts: [],
      totalScore: 41,
      completedAt: "2026-11-01T10:00:00.000Z",
    });
  });

  it("refuses a keypad total while a dart visit is open, with the spec's message", () => {
    const engine = new Pad({ limit: 2 });
    engine.record(T20);
    expect(() => engine.record({ total: 1 })).toThrow("board visit open");
    expect(engine.facts().turns).toHaveLength(1);
  });

  it("leaves an open turn's totalScore unwritten and settles it through closedVisitTotal(…, turn)", () => {
    const engine = new Pad({ limit: 2 });
    engine.record(T20);
    expect(engine.facts().turns[0].totalScore).toBe(0);
    engine.record(T20);
    expect(engine.facts().turns[0]).toMatchObject({
      totalScore: 200,
    });
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("undo pops a whole keypad turn, then a dart", () => {
    const engine = new Pad({ limit: 5 });
    engine.record({ total: 7 });
    engine.record(T20);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.undo()).toBe(false);
  });

  it("answers wouldComplete with the open turn, for both input shapes", () => {
    const engine = new Pad({ limit: 5 });
    expect(engine.wouldComplete({ total: 1 })).toBe(true);
    engine.record(T20);
    expect(engine.wouldComplete({ total: 1 })).toBe(false);
    expect(engine.wouldComplete(T20)).toBe(true);
  });

  it("reads isComplete from the spec's complete hook when declared", () => {
    const engine = new Pad({ limit: 99 });
    engine.record(T20);
    engine.record(T20);
    engine.record(T20);
    engine.record(T20);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.isComplete()).toBe(true);
  });
});

describe("dartGameEngineClass — specs without the hooks", () => {
  it("still sums a dart visit's total while open and undoes with undoLastDart", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    expect(engine.facts().turns[0].totalScore).toBe(60);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);
  });
});

describe("dartGameEngineClass — coordinate capture", () => {
  const coordSpec: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    coordinateCapture: true,
  };
  const Coord = dartGameEngineClass(coordSpec);
  const trebleTwentyAt = {
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: 0,
    locationY: -102,
  };

  it("resolves a located dart from its coordinates, with no intent", () => {
    const engine = new Coord({ limit: 10 });
    engine.record(trebleTwentyAt);
    expect(engine.facts().turns[0].darts[0]).toMatchObject({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      intendedTargetNumber: null,
      intendedZoneKey: null,
    });
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("scores an unlocated dart as a scoreless hit on its own zone", () => {
    const engine = new Coord({ limit: 10 });
    engine.record({ ...T20, locationX: null, locationY: null });
    expect(engine.facts().turns[0].darts[0]).toMatchObject({
      hitTargetNumber: null,
      hitZoneKey: "TREBLE",
      score: 0,
    });
  });
});

type Staged = Toy & { closed: number };

const stagedSpec: DartGameSpec<{ limit: number }, Staged, Keypad> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts) => ({
    activeParticipantRef: "p1",
    status: "IN_PROGRESS",
    darts: facts.turns.reduce((n, t) => n + t.darts.length, 0),
    closed: facts.turns.filter((t) => t.completedAt !== null).length,
  }),
  refusal: () => null,
  intent: () => ({ intendedTargetNumber: null, intendedZoneKey: null }),
  isVisitOpen: (turn) => turn.completedAt === null && turn.darts.length < 2,
  wouldComplete: () => false,
  visitInput: {
    isVisit: (input): input is Keypad => "total" in input,
    refusal: () => null,
    total: (_state, input) => input.total,
  },
  coordinateCapture: true,
  liveTotal: true,
  stageFor: (state) => ({
    clientKey: `round-${state.closed + 1}`,
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence: state.closed + 1,
  }),
  complete: (state, _config, expiredAt) =>
    expiredAt !== null && state.closed > expiredAt.closed,
};

const Staged = dartGameEngineClass(stagedSpec);

const T20_AT: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: 0,
  locationY: -102,
};

const stageKeys = (facts: EngineFacts) => facts.stages.map((s) => s.clientKey);

describe("dartGameEngineClass — stage, live total and expiry hooks", () => {
  it("opens the stage stageFor names after a visit closes, counting turn sequence within it", () => {
    const engine = new Staged({ limit: 0 });
    expect(stageKeys(engine.facts())).toEqual(["round-1"]);
    [T20_AT, T20_AT, T20_AT, T20_AT].forEach((o) => engine.record(o));
    const facts = engine.facts();
    expect(stageKeys(facts)).toEqual(["round-1", "round-2", "round-3"]);
    expect(facts.stages[1]).toMatchObject({
      stageTypeKey: "ROUND",
      sequence: 2,
    });
    expect(facts.turns.map((t) => [t.stageClientKey, t.sequence])).toEqual([
      ["round-1", 1],
      ["round-2", 1],
    ]);
  });

  it("opens a stage after a keypad total and places the total in the open stage", () => {
    const engine = new Staged({ limit: 0 });
    engine.record({ total: 9 });
    engine.record({ total: 5 });
    const facts = engine.facts();
    expect(stageKeys(facts)).toEqual(["round-1", "round-2", "round-3"]);
    expect(facts.turns.map((t) => t.stageClientKey)).toEqual([
      "round-1",
      "round-2",
    ]);
  });

  it("undo pops the stage the undone visit opened, down to the first", () => {
    const engine = new Staged({ limit: 0 });
    [T20_AT, T20_AT, T20_AT, T20_AT].forEach((o) => engine.record(o));
    expect(engine.undo()).toBe(true);
    expect(stageKeys(engine.facts())).toEqual(["round-1", "round-2"]);
    while (engine.undo());
    expect(stageKeys(engine.facts())).toEqual(["round-1"]);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rehydrates with its stages", () => {
    const engine = new Staged({ limit: 0 });
    [T20_AT, T20_AT, T20_AT].forEach((o) => engine.record(o));
    const again = new Staged({ limit: 0 }, engine.facts());
    expect(again.facts()).toEqual(engine.facts());
    again.record(T20_AT);
    expect(stageKeys(again.facts())).toEqual(["round-1", "round-2", "round-3"]);
  });

  it("writes an open turn's live dart sum under liveTotal, also after undo reopens it", () => {
    const engine = new Staged({ limit: 0 });
    engine.record(T20_AT);
    expect(engine.facts().turns[0].totalScore).toBe(60);
    engine.record(T20_AT);
    engine.undo();
    expect(engine.facts().turns[0]).toMatchObject({
      completedAt: null,
      totalScore: 60,
    });
  });

  it("passes complete the state at the latest expireTimer() call", () => {
    const engine = new Staged({ limit: 0 });
    engine.record(T20_AT);
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(false);
    engine.record(T20_AT);
    expect(engine.isComplete()).toBe(true);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(false);
  });
});

describe("dartGameEngineClass — live total", () => {
  const liveSpec: DartGameSpec<{ limit: number }, Toy> = {
    ...spec,
    coordinateCapture: true,
    liveTotal: true,
  };
  const Live = dartGameEngineClass(liveSpec);
  const at = (x: number, y: number) => ({
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: x,
    locationY: y,
  });

  it("writes the open turn's totalScore as its darts' sum after every dart", () => {
    const engine = new Live({ limit: 10 });
    engine.record(at(0, -102));
    expect(engine.facts().turns[0].totalScore).toBe(60);
    engine.record(at(0, -102));
    expect(engine.facts().turns[0].totalScore).toBe(120);
  });

  it("leaves the total unwritten without the flag", () => {
    const Coord = dartGameEngineClass({ ...spec, coordinateCapture: true });
    const engine = new Coord({ limit: 10 });
    engine.record(at(0, -102));
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("an undo that reopens a visit rewrites the total to the remaining darts", () => {
    const engine = new Live({ limit: 10 });
    engine.record(at(0, -102));
    engine.record(at(0, -102));
    engine.undo();
    expect(engine.facts().turns[0].totalScore).toBe(60);
  });
});

describe("visit actions", () => {
  type Act = { action: "STOP" | "KEEP" };
  type Seen = Toy & { closedTurns: number };
  const actSpec: DartGameSpec<{ limit: number }, Seen, Act> = {
    ...spec,
    fold: (facts, config) => ({
      ...(spec.fold(facts, config, false) as Toy),
      closedTurns: facts.turns.filter((t) => t.completedAt !== null).length,
    }),
    isVisitOpen: (t) => t.completedAt === null && t.darts.length < 3,
    wouldComplete: () => false,
    visitActions: {
      isAction: (input): input is Act => "action" in input,
      refusal: (_s, a, _c, open) =>
        a.action === "STOP" && open === null ? "nothing to stop" : null,
      effect: (a) => (a.action === "STOP" ? "CLOSE_VISIT" : "KEEP_TURN"),
      closedByAction: (turn) =>
        turn.completedAt !== null && turn.darts.length < 3,
    },
  };
  const Act = dartGameEngineClass(actSpec);

  it("STOP closes an open turn and the state sees it closed", () => {
    const engine = new Act({ limit: 10 });
    engine.record(T20);
    const state = engine.record({ action: "STOP" });
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    expect(state.closedTurns).toBe(1);
  });

  it("KEEP appends a closed dartless kept turn", () => {
    const engine = new Act({ limit: 10 });
    engine.record({ action: "KEEP" });
    expect(engine.facts().turns[0]).toMatchObject({
      darts: [],
      kept: true,
      totalScore: 0,
      participantRef: "p1",
    });
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("throws the action's refusal", () => {
    const engine = new Act({ limit: 10 });
    expect(() => engine.record({ action: "STOP" })).toThrow("nothing to stop");
  });

  it("undo reopens a stopped turn and keeps its dart", () => {
    const engine = new Act({ limit: 10 });
    engine.record(T20);
    engine.record({ action: "STOP" });
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });

  it("undo pops a kept turn", () => {
    const engine = new Act({ limit: 10 });
    engine.record({ action: "KEEP" });
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("undo of a dart-closed turn still pops the dart", () => {
    const engine = new Act({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(2);
    expect(engine.facts().turns[0].completedAt).toBeNull();
  });

  it("rehydrating after STOP equals the live state", () => {
    const engine = new Act({ limit: 10 });
    engine.record(T20);
    const live = engine.record({ action: "STOP" });
    expect(new Act({ limit: 10 }, engine.facts()).state()).toEqual(live);
  });
});
