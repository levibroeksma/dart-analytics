// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({ listRoutines: vi.fn() }));
import { listRoutines } from "@client/api/routines";
import { statisticsRoutines } from "@lib/training/routines/statistics-routines.data";
import type { StatisticsRoutinesContext } from "@lib/types";

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

beforeEach(() => vi.clearAllMocks());

describe("statisticsRoutines", () => {
  it("loads routines as options, default first, and selects the first", async () => {
    vi.mocked(listRoutines).mockResolvedValue({
      items: [OWN, SYS],
      nextCursor: null,
    });
    const data: StatisticsRoutinesContext = statisticsRoutines();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.routineOptions()).toEqual([
      { value: "s", label: "Balanced Training" },
      { value: "o", label: "Mine" },
    ]);
    expect(data.routine).toBe("s");
    expect(data.routineName()).toBe("Balanced Training");
  });

  it("names the picked routine", async () => {
    vi.mocked(listRoutines).mockResolvedValue({
      items: [SYS, OWN],
      nextCursor: null,
    });
    const data: StatisticsRoutinesContext = statisticsRoutines();
    await data.init();
    data.routine = "o";
    expect(data.routineName()).toBe("Mine");
  });

  it("selects nothing when no routines load", async () => {
    vi.mocked(listRoutines).mockResolvedValue({ items: [], nextCursor: null });
    const data: StatisticsRoutinesContext = statisticsRoutines();
    await data.init();
    expect(data.routine).toBe("");
    expect(data.routineName()).toBe("");
  });

  it("surfaces a load failure as error text", async () => {
    vi.mocked(listRoutines).mockRejectedValue(new Error("boom"));
    const data: StatisticsRoutinesContext = statisticsRoutines();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.error).toContain("Could not load");
  });
});
