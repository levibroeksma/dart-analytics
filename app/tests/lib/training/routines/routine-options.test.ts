import { describe, it, expect } from "vitest";
import { routineSelectOptions } from "@lib/training/routines/routine-options";

const SYS = {
  routineId: "s",
  routineName: "Balanced Training",
  description: null,
  isSystemTemplate: true,
  stepCount: 4,
  totalMinutes: 30,
};
const OWN = {
  routineId: "o",
  routineName: "Mine",
  description: null,
  isSystemTemplate: false,
  stepCount: 2,
  totalMinutes: 45,
};

describe("routineSelectOptions", () => {
  it("lists default routines before the player's own, keeping load order within each", () => {
    const own2 = { ...OWN, routineId: "o2", routineName: "Second" };
    expect(routineSelectOptions([OWN, SYS, own2])).toEqual([
      { value: "s", label: "Balanced Training" },
      { value: "o", label: "Mine" },
      { value: "o2", label: "Second" },
    ]);
  });

  it("is empty for no routines", () => {
    expect(routineSelectOptions([])).toEqual([]);
  });
});
