// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/schedules", () => ({
  listSchedules: vi.fn(),
  activateSchedule: vi.fn(),
  deactivateSchedule: vi.fn(),
}));
import * as api from "@client/api/schedules";
import { schedulesIndex } from "@lib/training/schedules/schedules-index.data";
import type { SchedulesIndexContext } from "@lib/types";

const A = { scheduleId: "a", name: "A", isActive: true, dayCount: 3 };
const B = { scheduleId: "b", name: "B", isActive: false, dayCount: 2 };

beforeEach(() => vi.clearAllMocks());

describe("schedulesIndex", () => {
  it("loads the list and builds edit hrefs", async () => {
    vi.mocked(api.listSchedules).mockResolvedValue({
      items: [A, B],
      nextCursor: null,
    });
    const data: SchedulesIndexContext = schedulesIndex();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.schedules).toEqual([A, B]);
    expect(data.editHref(B)).toBe("/training/schedules/edit?schedule=b");
  });

  it("activates a schedule then refreshes the list", async () => {
    vi.mocked(api.listSchedules)
      .mockResolvedValueOnce({ items: [A, B], nextCursor: null })
      .mockResolvedValueOnce({
        items: [
          { ...A, isActive: false },
          { ...B, isActive: true },
        ],
        nextCursor: null,
      });
    vi.mocked(api.activateSchedule).mockResolvedValue({
      scheduleId: "b",
      name: "B",
      isActive: true,
      days: [],
    });
    const data: SchedulesIndexContext = schedulesIndex();
    await data.init();
    await data.activate(B);
    expect(api.activateSchedule).toHaveBeenCalledWith("b");
    expect(data.schedules[1].isActive).toBe(true);
    expect(data.busyId).toBeNull();
  });

  it("deactivates a schedule then refreshes the list", async () => {
    vi.mocked(api.listSchedules).mockResolvedValue({
      items: [A],
      nextCursor: null,
    });
    vi.mocked(api.deactivateSchedule).mockResolvedValue({
      scheduleId: "a",
      name: "A",
      isActive: false,
      days: [],
    });
    const data: SchedulesIndexContext = schedulesIndex();
    await data.init();
    await data.deactivate(A);
    expect(api.deactivateSchedule).toHaveBeenCalledWith("a");
  });

  it("surfaces an activate failure as error text", async () => {
    vi.mocked(api.listSchedules).mockResolvedValue({
      items: [A],
      nextCursor: null,
    });
    vi.mocked(api.activateSchedule).mockRejectedValue(new Error("boom"));
    const data: SchedulesIndexContext = schedulesIndex();
    await data.init();
    await data.activate(A);
    expect(data.error).toContain("Could not activate");
    expect(data.busyId).toBeNull();
  });

  it("surfaces a load failure as error text", async () => {
    vi.mocked(api.listSchedules).mockRejectedValue(new Error("boom"));
    const data: SchedulesIndexContext = schedulesIndex();
    await data.init();
    expect(data.error).toContain("Could not load");
  });
});
