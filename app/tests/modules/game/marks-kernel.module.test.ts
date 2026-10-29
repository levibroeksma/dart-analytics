import { describe, expect, it } from "vitest";
import {
  foldMarks,
  foldMarksDuel,
  marksGameSpec,
  marksWouldComplete,
} from "@modules/game/marks-kernel.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "@modules/game/dart-engine-shell.module";
import { CRICKET_RULES } from "@modules/game/cricket.engine.module";
import { TACTICS_RULES } from "@modules/game/tactics.engine.module";
import {
  initialMarksSeat,
  NUMBER_RING_MARKS,
} from "@modules/game/marks-close.module";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  MarksDuelSeat,
  MarksRules,
  TurnFact,
} from "@modules/types";
import type { SeatFact } from "@lib/types";

const A: SeatFact = {
  participantRef: "a",
  displayName: "A",
  sideKey: "A",
  participantTypeKey: "PLAYER",
};
const B: SeatFact = {
  participantRef: "b",
  displayName: "B",
  sideKey: "B",
  participantTypeKey: "PLAYER",
};
const seats = [A, B] as const;
const NUMBERS = [20, 19, 0];

const spec: MarksRules<MarksDuelSeat> = {
  initialSeat: (seat) => ({ ...initialMarksSeat(seat, 3), points: 0 }),
  hitOf: (_seat, _opponent, observation) => {
    const index = NUMBERS.indexOf(observation.hitTargetNumber ?? -1);
    const marks = NUMBER_RING_MARKS[observation.hitZoneKey];
    return index === -1 || !marks ? null : { objectiveIndex: index, marks };
  },
  valueOf: (index) => [20, 19, null][index],
};

function dartFact(
  number: number | null,
  zone: DartFact["hitZoneKey"],
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: number,
    hitZoneKey: zone,
    score: 0,
    locationX: null,
    locationY: null,
  };
}

let key = 0;
function visit(
  ref: string,
  ...darts: [number | null, DartFact["hitZoneKey"]][]
): TurnFact {
  key += 1;
  return {
    clientKey: `t${key}`,
    stageClientKey: "s",
    participantRef: ref,
    sequence: key,
    completedAt: null,
    totalScore: 0,
    darts: darts.map(([n, z], i) => ({ ...dartFact(n, z), sequence: i + 1 })),
  };
}

describe("foldMarksDuel", () => {
  it("scores spare marks on a number the opponent has open", () => {
    const fold = foldMarksDuel(
      [visit("a", [20, "TREBLE"], [20, "SINGLE"])],
      seats,
      spec,
    );
    expect(fold.seats[0].points).toBe(20);
    expect(fold.winnerParticipantRef).toBeNull();
  });

  it("scores the spare marks of the closing dart", () => {
    const fold = foldMarksDuel(
      [
        visit("a", [20, "DOUBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [20, "TREBLE"]),
      ],
      seats,
      spec,
    );
    expect(fold.seats[0].marks[0]).toBe(3);
    expect(fold.seats[0].points).toBe(40);
  });

  it("scores nothing once the opponent has closed the number", () => {
    const fold = foldMarksDuel(
      [
        visit("a", [20, "TREBLE"]),
        visit("b", [20, "TREBLE"]),
        visit("a", [20, "SINGLE"]),
      ],
      seats,
      spec,
    );
    expect(fold.seats[0].points).toBe(0);
  });

  it("never scores on a category objective", () => {
    const fold = foldMarksDuel(
      [visit("a", [0, "TREBLE"], [0, "SINGLE"])],
      seats,
      spec,
    );
    expect(fold.seats[0].marks[2]).toBe(3);
    expect(fold.seats[0].points).toBe(0);
  });

  it("ends the game on the dart that closes out level or ahead and refuses later darts", () => {
    const won = [visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"])];
    const fold = foldMarksDuel(won, seats, spec);
    expect(fold.winnerParticipantRef).toBe("a");
    expect(fold.seats[0].dartsThisVisit).toBe(0);
    expect(() =>
      foldMarksDuel([...won, visit("b", [null, "MISS"])], seats, spec),
    ).toThrow("game has ended");
  });

  it("lets a closed-out seat that is behind keep throwing and win on catching up", () => {
    const behind = [
      visit("a", [null, "MISS"]),
      visit("b", [20, "TREBLE"], [20, "SINGLE"]),
      visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"]),
      visit("b", [null, "MISS"]),
      visit("a", [19, "SINGLE"]),
    ];
    const fold = foldMarksDuel(behind, seats, spec);
    expect(fold.seats[0].status).toBe("COMPLETE");
    expect(fold.seats[0].points).toBe(19);
    expect(fold.winnerParticipantRef).toBeNull();
    const caught = foldMarksDuel(
      [...behind.slice(0, 4), visit("a", [19, "SINGLE"], [19, "SINGLE"])],
      seats,
      spec,
    );
    expect(caught.winnerParticipantRef).toBe("a");
  });

  it("lets the other seat win by closing out ahead of a closed-out opponent", () => {
    const fold = foldMarksDuel(
      [
        visit("a", [null, "MISS"]),
        visit("b", [20, "TREBLE"], [20, "SINGLE"]),
        visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"]),
        visit("b", [19, "TREBLE"], [0, "TREBLE"]),
      ],
      seats,
      spec,
    );
    expect(fold.winnerParticipantRef).toBe("b");
  });
});

describe("foldMarks", () => {
  const facts = (turns: TurnFact[]) => ({ stages: [], turns });
  const done = (turn: TurnFact): TurnFact => ({
    ...turn,
    completedAt: "2026-10-24T10:00:00.000Z",
  });

  it("folds one seat with no opponent and completes once closed out", () => {
    const open = foldMarks(facts([visit("a", [20, "TREBLE"])]), [A], spec);
    expect(open.status).toBe("IN_PROGRESS");
    expect(open.seats[0].marks[0]).toBe(3);
    expect(open.winnerParticipantRef).toBeNull();
    const closed = foldMarks(
      facts([visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"])]),
      [A],
      spec,
    );
    expect(closed.status).toBe("COMPLETE");
    expect(closed.winnerParticipantRef).toBeNull();
    expect(closed.activeParticipantRef).toBe("a");
  });

  it("takes the active seat from the rota for two seats in progress", () => {
    const state = foldMarks(
      facts([done(visit("a", [20, "SINGLE"]))]),
      [A, B],
      spec,
    );
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.activeParticipantRef).toBe("b");
    expect(state.seats.map((seat) => seat.participantRef)).toEqual(["a", "b"]);
  });

  it("maps the duel fold and pins the active seat to the winner", () => {
    const state = foldMarks(
      facts([done(visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"]))]),
      [A, B],
      spec,
    );
    expect(state.status).toBe("COMPLETE");
    expect(state.winnerParticipantRef).toBe("a");
    expect(state.activeParticipantRef).toBe("a");
  });
});

const obs = (
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation => ({
  hitTargetNumber,
  hitZoneKey,
  locationX: null,
  locationY: null,
});

const factsOf = (...turns: TurnFact[]): EngineFacts => ({
  stages: [],
  turns,
});

describe("marksWouldComplete", () => {
  it("solo: true on the dart that closes the last objective", () => {
    const state = foldMarks(
      factsOf(visit("a", [20, "TREBLE"], [19, "TREBLE"])),
      [A],
      spec,
    );
    expect(marksWouldComplete(state, obs(0, "TREBLE"), spec)).toBe(true);
  });

  it("solo: false on a dart that leaves an objective open", () => {
    const state = foldMarks(factsOf(visit("a", [20, "TREBLE"])), [A], spec);
    expect(marksWouldComplete(state, obs(19, "TREBLE"), spec)).toBe(false);
  });

  it("1v1: true when the closing-out dart leaves points level or ahead", () => {
    const state = foldMarks(
      factsOf(visit("a", [20, "TREBLE"], [19, "TREBLE"])),
      [A, B],
      spec,
    );
    expect(marksWouldComplete(state, obs(0, "TREBLE"), spec)).toBe(true);
  });

  it("1v1: false when the closing-out dart leaves the thrower behind", () => {
    const state = foldMarks(
      factsOf(
        visit("a", [null, "MISS"]),
        visit("b", [20, "TREBLE"], [20, "SINGLE"]),
        visit("a", [20, "TREBLE"], [19, "TREBLE"]),
      ),
      [A, B],
      spec,
    );
    expect(marksWouldComplete(state, obs(0, "TREBLE"), spec)).toBe(false);
  });

  it("1v1: true on the scoring dart of a closed-out seat that catches up", () => {
    const behind = foldMarks(
      factsOf(
        visit("a", [null, "MISS"]),
        visit("b", [20, "TREBLE"], [20, "SINGLE"]),
        visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [19, "SINGLE"]),
      ),
      [A, B],
      spec,
    );
    expect(behind.status).toBe("IN_PROGRESS");
    expect(marksWouldComplete(behind, obs(19, "SINGLE"), spec)).toBe(true);
    expect(marksWouldComplete(behind, obs(null, "MISS"), spec)).toBe(false);
  });

  it("Tactics 1v1: a hit on a number the opponent has open scores, not a category", () => {
    const tactics = foldMarks(
      factsOf(
        visit("a", [20, "TREBLE"], [19, "TREBLE"], [18, "TREBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [17, "TREBLE"], [16, "TREBLE"], [15, "TREBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [25, "INNER_BULL"], [25, "OUTER_BULL"], [1, "TREBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [1, "TREBLE"], [1, "TREBLE"]),
        visit("b", [null, "MISS"]),
        visit("a", [1, "DOUBLE"], [1, "DOUBLE"]),
      ),
      [A, B],
      TACTICS_RULES,
    );
    expect(tactics.status).toBe("IN_PROGRESS");
    expect(tactics.seats[0].marks).toEqual([3, 3, 3, 3, 3, 3, 3, 2, 3]);
    expect(marksWouldComplete(tactics, obs(20, "DOUBLE"), TACTICS_RULES)).toBe(
      false,
    );
    expect(marksWouldComplete(tactics, obs(1, "DOUBLE"), TACTICS_RULES)).toBe(
      true,
    );
  });

  it("false once the game is COMPLETE", () => {
    const state = foldMarks(
      factsOf(visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"])),
      [A],
      spec,
    );
    expect(state.status).toBe("COMPLETE");
    expect(marksWouldComplete(state, obs(20, "TREBLE"), spec)).toBe(false);
  });
});

describe("marksGameSpec", () => {
  const config = { seats: [A, B] };
  const cricketSpec = marksGameSpec<{ seats: SeatFact[] }, MarksDuelSeat>({
    rulesetVersionKey: "CRICKET_V1",
    rulesetVersionKeys: ["CRICKET_V2"],
    rules: spec,
  });
  const Engine = dartGameEngineClass(cricketSpec);

  it("refuses with 'game has ended' once COMPLETE, else null", () => {
    const done = cricketSpec.fold(
      factsOf(visit("a", [20, "TREBLE"], [19, "TREBLE"], [0, "TREBLE"])),
      config,
      false,
    );
    expect(cricketSpec.refusal(done)).toContain("game has ended");
    expect(
      cricketSpec.refusal(cricketSpec.fold(factsOf(), config, false)),
    ).toBeNull();
  });

  it("keeps a visit open below three darts while IN_PROGRESS", () => {
    const engine = new Engine(config);
    engine.record(obs(20, "SINGLE"));
    engine.record(obs(20, "SINGLE"));
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(obs(20, "SINGLE"));
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    engine.record(obs(19, "SINGLE"));
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[1].participantRef).toBe("b");
  });

  it("closes the visit on the winning dart", () => {
    const engine = new Engine(config);
    engine.record(obs(20, "TREBLE"));
    engine.record(obs(19, "TREBLE"));
    expect(engine.wouldComplete(obs(0, "TREBLE"))).toBe(true);
    engine.record(obs(0, "TREBLE"));
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(obs(20, "SINGLE"))).toThrow("game has ended");
    expect(engine.wouldComplete(obs(20, "SINGLE"))).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.isComplete()).toBe(false);
  });

  it("closes a stamped turn", () => {
    const state = cricketSpec.fold(factsOf(), config, false);
    const turn = {
      ...visit("a", [20, "SINGLE"]),
      completedAt: "2026-10-24T10:00:00.000Z",
    };
    expect(cricketSpec.isVisitOpen(turn, state, config)).toBe(false);
    expect(
      cricketSpec.isVisitOpen(visit("a", [20, "SINGLE"]), state, config),
    ).toBe(true);
  });

  it("serves both keys; dartGameEngineFactory throws for a key it does not serve", () => {
    expect(cricketSpec.stageOwnership).toBe("PER_SEAT");
    expect(
      dartGameEngineFactory(cricketSpec, Engine, "CRICKET_V2")
        .rulesetVersionKey,
    ).toBe("CRICKET_V2");
    expect(() =>
      dartGameEngineFactory(cricketSpec, Engine, "TACTICS_V1"),
    ).toThrow("TACTICS_V1 is not served by this spec");
  });

  it("Cricket and Tactics rules value only their numbers and the bull", () => {
    expect(CRICKET_RULES.valueOf(0)).toBe(20);
    expect(TACTICS_RULES.valueOf(7)).toBeNull();
  });
});
