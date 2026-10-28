import { describe, it, expect } from "vitest";
import { killerHit } from "@modules/game/elimination-policies";
import type {
  DartObservation,
  EliminationSeat,
  KillerExt,
} from "@modules/types";

function seat(
  ref: string,
  number: number,
  ext: Partial<KillerExt> = {},
): EliminationSeat<KillerExt> {
  return {
    participantRef: ref,
    sideKey: ref,
    lives: 3,
    out: false,
    ext: {
      number,
      killer: false,
      livesTaken: 0,
      dartsToKiller: null,
      dartsThrown: 0,
      ...ext,
    },
  };
}

const dart = (
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation => ({
  hitTargetNumber,
  hitZoneKey,
  locationX: null,
  locationY: null,
});

describe("killerHit", () => {
  it("own double makes a Killer and records darts to Killer", () => {
    const a = seat("A", 5, { dartsThrown: 1 });
    const changes = killerHit(a, [a, seat("B", 12)], dart(5, "DOUBLE"));
    expect(changes).toEqual([
      {
        participantRef: "A",
        ext: {
          number: 5,
          killer: true,
          livesTaken: 0,
          dartsToKiller: 2,
          dartsThrown: 2,
        },
      },
    ]);
  });

  it("own double again loses Killer status, dartsToKiller kept", () => {
    const a = seat("A", 5, { killer: true, dartsToKiller: 2, dartsThrown: 4 });
    const [change] = killerHit(a, [a, seat("B", 12)], dart(5, "DOUBLE"));
    expect(change.ext).toMatchObject({
      killer: false,
      dartsToKiller: 2,
      dartsThrown: 5,
    });
  });

  it("a Killer's hit on another seat's double takes one life", () => {
    const a = seat("A", 5, { killer: true, dartsThrown: 1 });
    const changes = killerHit(a, [a, seat("B", 12)], dart(12, "DOUBLE"));
    expect(changes).toEqual([
      { participantRef: "B", livesDelta: -1 },
      {
        participantRef: "A",
        ext: {
          number: 5,
          killer: true,
          livesTaken: 1,
          dartsToKiller: null,
          dartsThrown: 2,
        },
      },
    ]);
  });

  it("a non-Killer's hit on another seat's double does nothing", () => {
    const a = seat("A", 5);
    const changes = killerHit(a, [a, seat("B", 12)], dart(12, "DOUBLE"));
    expect(changes).toEqual([
      { participantRef: "A", ext: { ...a.ext, dartsThrown: 1 } },
    ]);
  });

  it("a Killer's hit on an out seat's double takes no life and counts none", () => {
    const a = seat("A", 5, { killer: true });
    const b = { ...seat("B", 12), lives: 0, out: true };
    expect(killerHit(a, [a, b], dart(12, "DOUBLE"))).toEqual([
      { participantRef: "A", ext: { ...a.ext, dartsThrown: 1 } },
    ]);
  });

  it.each([
    ["single", dart(12, "OUTER_SINGLE")],
    ["treble", dart(12, "TREBLE")],
    ["unowned double", dart(7, "DOUBLE")],
    ["outer bull", dart(25, "OUTER_BULL")],
    ["inner bull", dart(25, "INNER_BULL")],
    ["miss", dart(null, "MISS")],
  ])("a Killer's %s changes only dartsThrown", (_label, hit) => {
    const a = seat("A", 5, { killer: true });
    expect(killerHit(a, [a, seat("B", 12)], hit)).toEqual([
      { participantRef: "A", ext: { ...a.ext, dartsThrown: 1 } },
    ]);
  });
});
