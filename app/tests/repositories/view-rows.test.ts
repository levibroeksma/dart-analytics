import { describe, it, expect } from "vitest";
import { viewRow, viewRows } from "@repositories/view-rows";

type ScheduleRow = {
  scheduleId: string;
  dayCount: number;
  configuration: unknown;
};

describe("viewRows", () => {
  it("returns the array it was given rather than a copy of it", () => {
    const rows = [{ scheduleId: "s1", dayCount: 2, configuration: null }];

    expect(viewRows<ScheduleRow>(rows)).toBe(rows);
  });

  it("narrows Drizzle's nullable column types to the row interface", () => {
    const rows: {
      scheduleId: string | null;
      dayCount: number | null;
      configuration: unknown;
    }[] = [{ scheduleId: "s1", dayCount: 2, configuration: { a: 1 } }];

    expect(viewRows<ScheduleRow>(rows)).toEqual([
      { scheduleId: "s1", dayCount: 2, configuration: { a: 1 } },
    ]);
  });

  it("passes a NULL through in a column the interface claims is never null", () => {
    const rows = [{ scheduleId: null, dayCount: 2, configuration: null }];

    expect(viewRows<ScheduleRow>(rows)[0]?.scheduleId).toBeNull();
  });

  it("rejects a column whose type disagrees with the row interface", () => {
    const rows = [{ scheduleId: "s1", dayCount: "2", configuration: null }];

    // @ts-expect-error dayCount arrives as the string an uncast bigint count(*) yields
    expect(viewRows<ScheduleRow>(rows)).toBe(rows);
  });

  it("rejects a row missing a column the interface names", () => {
    const rows = [{ dayCount: 2, configuration: null }];

    // @ts-expect-error scheduleId is not in the select
    expect(viewRows<ScheduleRow>(rows)).toBe(rows);
  });
});

describe("viewRow", () => {
  it("returns the single row it was given rather than a copy of it", () => {
    const row = { scheduleId: "s1", dayCount: 2, configuration: null };

    expect(viewRow<ScheduleRow>(row)).toBe(row);
  });

  it("rejects a single row whose type disagrees with the row interface", () => {
    const row = { scheduleId: 1, dayCount: 2, configuration: null };

    // @ts-expect-error scheduleId is a uuid column, read as a string
    expect(viewRow<ScheduleRow>(row)).toBe(row);
  });
});
