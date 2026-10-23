import { describe, expect, it } from "vitest";
import { foldMarksDuel } from "@modules/game/marks-duel.module";
import {
  initialMarksSeat,
  NUMBER_RING_MARKS,
} from "@modules/game/marks-close.module";
import type {
  DartFact,
  MarksDuelSeat,
  MarksDuelSpec,
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

const spec: MarksDuelSpec<MarksDuelSeat> = {
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
