import { describe, it, expect } from "vitest";
import { nonNull } from "@repositories/row-helpers";

describe("nonNull", () => {
  it("returns the value unchanged when it is not null", () => {
    expect(nonNull("sch-1", "schedule_id")).toBe("sch-1");
    expect(nonNull(0, "day_count")).toBe(0);
    expect(nonNull(false, "is_active")).toBe(false);
  });

  it("throws, naming the column, when the value is null", () => {
    expect(() => nonNull(null, "schedule_id")).toThrow(
      'expected view column "schedule_id" to be non-null',
    );
  });
});
