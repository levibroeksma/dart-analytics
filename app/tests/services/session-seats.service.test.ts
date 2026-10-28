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
const bot = {
  participantTypeKey: "DARTBOT" as const,
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
    expect(rejectSeatRequest([player, guest], "SOME_OTHER_RULESET_V1")).toMatch(
      /supports at most 1 seat/,
    );
  });

  it("accepts a lone player seat for any ruleset", () => {
    expect(rejectSeatRequest([player], "BOBS27_V1")).toBeNull();
  });
});

describe("rejectSeatRequest with the seven new rulesets", () => {
  const twoPlayers = [
    { participantTypeKey: "PLAYER" as const, sideKey: "A", displayName: "Me" },
    {
      participantTypeKey: "GUEST" as const,
      sideKey: "B",
      displayName: "Guest",
    },
  ];
  const threePlayers = [
    ...twoPlayers,
    {
      participantTypeKey: "GUEST" as const,
      sideKey: "C",
      displayName: "Guest 2",
    },
  ];

  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "AROUND_THE_CLOCK_V2",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "SHANGHAI_V3",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "SINGLES_V3",
    "DOUBLES_TRAINING_V1",
  ])("accepts exactly 2 seats for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(twoPlayers, rulesetVersionKey)).toBeNull();
  });

  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "AROUND_THE_CLOCK_V2",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "SHANGHAI_V3",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "SINGLES_V3",
    "DOUBLES_TRAINING_V1",
  ])("rejects a 3rd seat for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(threePlayers, rulesetVersionKey)).toContain(
      "supports at most 2 seat",
    );
  });

  it("still rejects a 2nd seat for a ruleset not in SEAT_CAPS", () => {
    expect(rejectSeatRequest(twoPlayers, "SOME_FUTURE_RULESET_V1")).toContain(
      "supports at most 1 seat",
    );
  });

  it("still accepts 4 seats for 501", () => {
    const four = [
      ...twoPlayers,
      {
        participantTypeKey: "GUEST" as const,
        sideKey: "C",
        displayName: "Guest 2",
      },
      {
        participantTypeKey: "GUEST" as const,
        sideKey: "D",
        displayName: "Guest 3",
      },
    ];
    expect(rejectSeatRequest(four, "501_V1")).toBeNull();
  });

  it("admits four seats on 501_V2, matching 501_V1", () => {
    const four = [
      player,
      { participantTypeKey: "GUEST" as const, sideKey: "B", displayName: "G1" },
      { participantTypeKey: "GUEST" as const, sideKey: "C", displayName: "G2" },
      { participantTypeKey: "GUEST" as const, sideKey: "D", displayName: "G3" },
    ];
    expect(rejectSeatRequest(four, "501_V2")).toBeNull();
  });
});

describe("rejectSeatRequest with a DARTBOT seat", () => {
  it("accepts a DARTBOT seat for a ruleset RULESET_DARTBOT admits", () => {
    expect(rejectSeatRequest([player, bot], "BOBS27_V1")).toBeNull();
  });

  it("rejects a DARTBOT seat for a ruleset RULESET_DARTBOT does not admit", () => {
    expect(rejectSeatRequest([player, bot], "121_V2")).toMatch(
      /does not support a DartBot opponent/,
    );
  });

  it.each(["SHANGHAI_V2", "SHANGHAI_V3"])(
    "accepts a DARTBOT seat for %s, now that it's wired (D259)",
    (rulesetVersionKey) => {
      expect(rejectSeatRequest([player, bot], rulesetVersionKey)).toBeNull();
    },
  );

  it("accepts a DARTBOT seat for Singles Training V3, now that it's wired (#290)", () => {
    expect(rejectSeatRequest([player, bot], "SINGLES_V3")).toBeNull();
  });

  it("counts a DARTBOT seat toward the ruleset's own SEAT_CAPS entry", () => {
    const threeSeats = [player, bot, { ...guest, sideKey: "C" }];
    expect(rejectSeatRequest(threeSeats, "BOBS27_V1")).toContain(
      "supports at most 2 seat",
    );
  });
});

describe("rejectSeatRequest for Bob's 27 V2", () => {
  it("accepts two seats", () => {
    expect(rejectSeatRequest([player, guest], "BOBS27_V2")).toBeNull();
  });

  it("refuses a third seat", () => {
    expect(
      rejectSeatRequest(
        [player, guest, { ...guest, sideKey: "C" }],
        "BOBS27_V2",
      ),
    ).toContain("supports at most 2 seats");
  });
});

describe("rejectSeatRequest for Tactics", () => {
  it("accepts two seats under V2", () => {
    expect(rejectSeatRequest([player, guest], "TACTICS_V2")).toBeNull();
  });

  it("refuses a third seat under V2", () => {
    expect(
      rejectSeatRequest(
        [player, guest, { ...guest, sideKey: "C" }],
        "TACTICS_V2",
      ),
    ).toContain("supports at most 2 seats");
  });

  it("still refuses a second seat under V1", () => {
    expect(rejectSeatRequest([player, guest], "TACTICS_V1")).toContain(
      "supports at most 1 seat",
    );
  });
});

describe("rejectSeatRequest for Cricket", () => {
  it("accepts two seats under V2", () => {
    expect(rejectSeatRequest([player, guest], "CRICKET_V2")).toBeNull();
  });

  it("refuses a third seat under V2", () => {
    expect(
      rejectSeatRequest(
        [player, guest, { ...guest, sideKey: "C" }],
        "CRICKET_V2",
      ),
    ).toContain("supports at most 2 seats");
  });

  it("still refuses a second seat under V1", () => {
    expect(rejectSeatRequest([player, guest], "CRICKET_V1")).toContain(
      "supports at most 1 seat",
    );
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

  it("projects a DARTBOT seat's level/seed/levelSource into the snapshot seat", () => {
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
          participantTypeId: 3,
          playerId: null,
          displayName: "DartBot",
          sideKey: "B",
          dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
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
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      },
    ]);
  });

  it("throws when a DARTBOT-typed seat's dartbot payload is unexpectedly absent", () => {
    expect(() =>
      composeSeatFacts([
        {
          participantId: "id-b",
          participantTypeId: 3,
          playerId: null,
          displayName: "DartBot",
          sideKey: "B",
        },
      ]),
    ).toThrow();
  });
});

describe("rejectSeatRequest for Around the Clock V3", () => {
  const solo = {
    participantTypeKey: "PLAYER" as const,
    sideKey: "A",
    displayName: "Me",
  };
  const guest = {
    participantTypeKey: "GUEST" as const,
    sideKey: "B",
    displayName: "Guest",
  };

  it("accepts one seat", () => {
    expect(rejectSeatRequest([solo], "AROUND_THE_CLOCK_V3")).toBeNull();
  });

  it("accepts a second seat", () => {
    expect(rejectSeatRequest([solo, guest], "AROUND_THE_CLOCK_V3")).toBeNull();
  });

  it("refuses a third seat", () => {
    const third = { ...guest, sideKey: "C" };
    expect(
      rejectSeatRequest([solo, guest, third], "AROUND_THE_CLOCK_V3"),
    ).toContain("supports at most 2 seats");
  });
});

describe("rejectSeatRequest for Baseball", () => {
  const solo = {
    participantTypeKey: "PLAYER" as const,
    sideKey: "A",
    displayName: "Levi",
  };
  const guest = {
    participantTypeKey: "GUEST" as const,
    sideKey: "B",
    displayName: "Guest",
  };

  it("accepts one or two seats", () => {
    expect(rejectSeatRequest([solo], "BASEBALL_V1")).toBeNull();
    expect(rejectSeatRequest([solo, guest], "BASEBALL_V1")).toBeNull();
  });

  it("refuses a third seat", () => {
    expect(
      rejectSeatRequest(
        [solo, guest, { ...guest, sideKey: "C" }],
        "BASEBALL_V1",
      ),
    ).toContain("supports at most 2 seats");
  });
});

describe("rejectSeatRequest — KILLER_V1", () => {
  const seat = (sideKey: string) => ({
    participantTypeKey: "GUEST" as const,
    sideKey,
    displayName: `Seat ${sideKey}`,
  });

  it("accepts two seats and refuses a third", () => {
    const owner = { ...seat("A"), participantTypeKey: "PLAYER" as const };
    expect(rejectSeatRequest([owner, seat("B")], "KILLER_V1")).toBeNull();
    expect(
      rejectSeatRequest([owner, seat("B"), seat("C")], "KILLER_V1"),
    ).toContain("supports at most 2 seats");
  });
});
