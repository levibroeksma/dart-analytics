// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({ listRoutines: vi.fn() }));
import { listRoutines } from "@client/api/routines";
import { trainingIndex } from "@lib/training/routines/training-index.data";
import type { TrainingIndexContext } from "@lib/types";

const SYS = {
  routineId: "s",
  routineName: "Balanced Training",
  description: "d",
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

beforeEach(() => vi.clearAllMocks());

describe("trainingIndex", () => {
  it("loads routines and exposes them with a duration label and detail href", async () => {
    vi.mocked(listRoutines).mockResolvedValue({
      items: [SYS, OWN],
      nextCursor: null,
    });
    const data: TrainingIndexContext = trainingIndex();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.routines).toEqual([SYS, OWN]);
    expect(data.durationLabel(OWN)).toBe("45 min");
    expect(data.detailHref(OWN)).toBe("/training/routines/detail?routine=o");
  });

  it("splits loaded routines into default and personal lists", async () => {
    vi.mocked(listRoutines).mockResolvedValue({
      items: [SYS, OWN],
      nextCursor: null,
    });
    const data: TrainingIndexContext = trainingIndex();
    await data.init();
    expect(data.systemRoutines()).toEqual([SYS]);
    expect(data.personalRoutines()).toEqual([OWN]);
  });

  it("reports no personal routines when only system templates load", async () => {
    vi.mocked(listRoutines).mockResolvedValue({
      items: [SYS],
      nextCursor: null,
    });
    const data: TrainingIndexContext = trainingIndex();
    await data.init();
    expect(data.personalRoutines()).toEqual([]);
  });

  it("starts with the routine-form modal closed", () => {
    const data: TrainingIndexContext = trainingIndex();
    expect(data.showModal).toBe(false);
  });

  it("starts with the schedule modal closed", () => {
    const data: TrainingIndexContext = trainingIndex();
    expect(data.showScheduleModal).toBe(false);
  });

  it("surfaces a load failure as error text", async () => {
    vi.mocked(listRoutines).mockRejectedValue(new Error("boom"));
    const data: TrainingIndexContext = trainingIndex();
    await data.init();
    expect(data.error).toContain("Could not load");
  });
});
