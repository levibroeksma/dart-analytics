import { describe, it, expect } from "vitest";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import type { GuestListContext } from "@lib/types";

function context(overrides: Partial<GuestListContext> = {}): GuestListContext {
  return {
    guests: [],
    newGuestName: "",
    showAddGuestModal: true,
    bot: null,
    showOpponentChooser: true,
    ...overrides,
  };
}

describe("addTypedGuest", () => {
  it("seats the typed guest, clears the field and closes the modal", () => {
    const state = context({ newGuestName: "Rosa" });

    expect(addTypedGuest(state)).toBe(true);
    expect(state.guests).toEqual([{ displayName: "Rosa" }]);
    expect(state.newGuestName).toBe("");
    expect(state.showAddGuestModal).toBe(false);
  });

  it("trims the typed name before seating it", () => {
    const state = context({ newGuestName: "  Rosa  " });

    addTypedGuest(state);
    expect(state.guests).toEqual([{ displayName: "Rosa" }]);
  });

  it("refuses a blank name and leaves the modal open", () => {
    const state = context({ newGuestName: "   " });

    expect(addTypedGuest(state)).toBe(false);
    expect(state.guests).toEqual([]);
    expect(state.showAddGuestModal).toBe(true);
  });

  it("refuses a second guest — V1 seats at most one", () => {
    const state = context({
      guests: [{ displayName: "Rosa" }],
      newGuestName: "Sam",
    });

    expect(addTypedGuest(state)).toBe(false);
    expect(state.guests).toEqual([{ displayName: "Rosa" }]);
    expect(state.newGuestName).toBe("Sam");
    expect(state.showAddGuestModal).toBe(true);
  });

  it("refuses when a bot already occupies the opponent slot", () => {
    const state = context({ bot: { level: 8 }, newGuestName: "Rosa" });

    expect(addTypedGuest(state)).toBe(false);
    expect(state.guests).toEqual([]);
  });
});

describe("addBotOpponent", () => {
  it("seats a level-8 DartBot and closes the chooser", () => {
    const state = context();

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 8 });
    expect(state.showOpponentChooser).toBe(false);
  });

  it("refuses a second bot", () => {
    const state = context({ bot: { level: 8 } });

    expect(addBotOpponent(state)).toBe(false);
    expect(state.bot).toEqual({ level: 8 });
  });

  it("refuses when a guest already occupies the opponent slot", () => {
    const state = context({ guests: [{ displayName: "Rosa" }] });

    expect(addBotOpponent(state)).toBe(false);
    expect(state.bot).toBeNull();
  });

  it("seats the bot at the picker's chosen level", () => {
    const state = context({ pendingBotLevel: 12 });

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 12 });
  });

  it("falls back to DEFAULT_BOT_LEVEL when no level was picked", () => {
    const state = context({ pendingBotLevel: undefined });

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 8 });
  });

  it("resets the picker state on success", () => {
    const state = context({ pendingBotLevel: 12, showBotLevelPicker: true });

    addBotOpponent(state);

    expect(state.showBotLevelPicker).toBe(false);
    expect(state.pendingBotLevel).toBe(8);
  });
});
