import { describe, expect, it } from "vitest";
import { CreateSessionRequest, ParticipantInput } from "@routes/sessions/types";

const config = {
  source: "inline" as const,
  config: { starting_score: 501, legs_to_win: 1, max_darts_per_turn: 3 },
};

const request = {
  gameTypeKey: "X01",
  rulesetVersionKey: "501_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config,
};

describe("ParticipantInput", () => {
  it("accepts a PLAYER seat with no display name", () => {
    expect(
      ParticipantInput.safeParse({ participantTypeKey: "PLAYER", sideKey: "A" })
        .success,
    ).toBe(true);
  });

  it("accepts a GUEST seat carrying a display name", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "GUEST",
        displayName: "Dad",
        sideKey: "B",
      }).success,
    ).toBe(true);
  });

  it("rejects a participant type outside PLAYER and GUEST", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        sideKey: "A",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty sideKey, because a seat with no side cannot be paired", () => {
    expect(
      ParticipantInput.safeParse({ participantTypeKey: "PLAYER", sideKey: "" })
        .success,
    ).toBe(false);
  });

  it("rejects a missing sideKey", () => {
    expect(
      ParticipantInput.safeParse({ participantTypeKey: "PLAYER" }).success,
    ).toBe(false);
  });
});

describe("CreateSessionRequest participants", () => {
  it("accepts a request with no participants field, preserving the solo shape", () => {
    const parsed = CreateSessionRequest.safeParse(request);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.participants).toBeUndefined();
  });

  it("keeps the participants array in the order it was sent, because order is seat order", () => {
    const parsed = CreateSessionRequest.safeParse({
      ...request,
      participants: [
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "B" },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(
      parsed.success && parsed.data.participants?.map((p) => p.sideKey),
    ).toEqual(["A", "B"]);
  });

  it("accepts an empty participants array here, leaving the seat-count rule to the service", () => {
    expect(
      CreateSessionRequest.safeParse({ ...request, participants: [] }).success,
    ).toBe(true);
  });

  it("rejects a participants entry that is not a participant", () => {
    expect(
      CreateSessionRequest.safeParse({
        ...request,
        participants: [{ sideKey: "A" }],
      }).success,
    ).toBe(false);
  });
});
