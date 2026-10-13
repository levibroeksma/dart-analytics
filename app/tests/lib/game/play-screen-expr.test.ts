import { describe, expect, it } from "vitest";
import { seatCall, seatRef, soloCall } from "@lib/game/play-screen-expr";
import type { Tile } from "@lib/interfaces";

describe("play-screen-expr", () => {
  it("seatRef points at the seat's participantRef", () => {
    expect(seatRef(0)).toBe("state()?.seats[0]?.participantRef");
    expect(seatRef(1)).toBe("state()?.seats[1]?.participantRef");
  });

  it("soloCall expands fn to a bare call", () => {
    const c = soloCall();
    expect(c("average")).toBe("average()");
    expect(c.solo).toBe(true);
  });

  it("seatCall expands fn to its For variant on the seat ref", () => {
    const c = seatCall(1);
    expect(c("average")).toBe("averageFor(state()?.seats[1]?.participantRef)");
    expect(c.solo).toBe(false);
  });

  it("one tile expands to matching solo and seat expressions", () => {
    const tile: Tile = {
      label: "Visit",
      value: (c) => `(${c("visitsThisAttempt")} + 1) + ' / 3'`,
      showWhen: (c) => c("hitsToGo"),
    };
    expect(tile.value(soloCall())).toBe("(visitsThisAttempt() + 1) + ' / 3'");
    expect(tile.value(seatCall(0))).toBe(
      "(visitsThisAttemptFor(state()?.seats[0]?.participantRef) + 1) + ' / 3'",
    );
    expect(tile.showWhen?.(seatCall(0))).toBe(
      "hitsToGoFor(state()?.seats[0]?.participantRef)",
    );
  });

  it("c.solo lets a tile keep a non-conforming solo expression", () => {
    const value = (c: ReturnType<typeof soloCall>) =>
      c.solo ? "custom()" : c("total");
    expect(value(soloCall())).toBe("custom()");
    expect(value(seatCall(0))).toBe(
      "totalFor(state()?.seats[0]?.participantRef)",
    );
  });
});
