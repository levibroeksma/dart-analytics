import { describe, expect, it } from "vitest";
import {
  composeSeatFacts,
  rejectSeatRequest,
} from "@services/session-seats.service";

const player = { participantTypeKey: "PLAYER" as const, sideKey: "A" };
const guest = {
  participantTypeKey: "GUEST" as const,
  displayName: "Dad",
  sideKey: "B",
};

describe("rejectSeatRequest", () => {
  it("accepts an omitted participants field", () => {
    expect(rejectSeatRequest(undefined, "501_V1")).toBeNull();
  });

  it("accepts one player plus one named guest for 501", () => {
    expect(rejectSeatRequest([player, guest], "501_V1")).toBeNull();
  });

  it("accepts four seats for 501", () => {
    expect(
      rejectSeatRequest(
        [
          player,
          { ...guest, displayName: "B", sideKey: "B" },
          { ...guest, displayName: "C", sideKey: "C" },
          { ...guest, displayName: "D", sideKey: "D" },
        ],
        "501_V1",
      ),
    ).toBeNull();
  });

  it("rejects zero PLAYER entries", () => {
    expect(rejectSeatRequest([guest], "501_V1")).toMatch(/exactly one PLAYER/);
  });

  it("rejects two PLAYER entries", () => {
    expect(
      rejectSeatRequest([player, { ...player, sideKey: "B" }], "501_V1"),
    ).toMatch(/exactly one PLAYER/);
  });

  it("rejects a guest with a blank display name", () => {
    expect(
      rejectSeatRequest([player, { ...guest, displayName: "   " }], "501_V1"),
    ).toMatch(/name/i);
  });

  it("allows two guests with the same display name", () => {
    expect(
      rejectSeatRequest([player, guest, { ...guest, sideKey: "C" }], "501_V1"),
    ).toBeNull();
  });

  it("rejects an empty seat list", () => {
    expect(rejectSeatRequest([], "501_V1")).toMatch(/between 1 and 4/);
  });

  it("rejects more than four seats", () => {
    expect(
      rejectSeatRequest(
        [
          player,
          { ...guest, sideKey: "B" },
          { ...guest, sideKey: "C" },
          { ...guest, sideKey: "D" },
          { ...guest, sideKey: "E" },
        ],
        "501_V1",
      ),
    ).toMatch(/between 1 and 4/);
  });

  it("rejects two seats sharing one side, because 2v2 is not implemented", () => {
    expect(
      rejectSeatRequest([player, { ...guest, sideKey: "A" }], "501_V1"),
    ).toMatch(/one seat per side/);
  });

  it("rejects a second seat for a ruleset other than 501_V1", () => {
    expect(rejectSeatRequest([player, guest], "BOBS27_V1")).toMatch(
      /only supported by 501_V1/,
    );
  });

  it("accepts a lone player seat for any ruleset", () => {
    expect(rejectSeatRequest([player], "BOBS27_V1")).toBeNull();
  });
});

describe("composeSeatFacts", () => {
  it("projects the persisted seat plan into snapshot seats, in order", () => {
    expect(
      composeSeatFacts([
        {
          participantId: "id-a",
          participantTypeId: 1,
          playerId: "player-1",
          displayName: "Levi",
          sideKey: "A",
        },
        {
          participantId: "id-b",
          participantTypeId: 2,
          playerId: null,
          displayName: "Dad",
          sideKey: "B",
        },
      ]),
    ).toEqual([
      {
        participantRef: "id-a",
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER",
      },
      {
        participantRef: "id-b",
        displayName: "Dad",
        sideKey: "B",
        participantTypeKey: "GUEST",
      },
    ]);
  });
});
