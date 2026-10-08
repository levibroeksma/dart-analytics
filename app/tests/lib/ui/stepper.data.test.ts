import { describe, it, expect, vi } from "vitest";
import { stepValue, stepperData } from "@lib/ui/stepper.data";

describe("stepValue", () => {
  it("adds the delta inside bounds", () => {
    expect(stepValue(3, 1, 1, 20)).toBe(4);
    expect(stepValue(3, -1, 1, 20)).toBe(2);
  });

  it("clamps at max and min", () => {
    expect(stepValue(20, 1, 1, 20)).toBe(20);
    expect(stepValue(1, -1, 1, 20)).toBe(1);
  });

  it("coerces numeric strings", () => {
    expect(stepValue("5", 1, 1, 20)).toBe(6);
  });

  it("treats null, empty and non-numeric as min", () => {
    expect(stepValue(null, 0, 1, 20)).toBe(1);
    expect(stepValue("", 0, 1, 20)).toBe(1);
    expect(stepValue("abc", 1, 1, 20)).toBe(2);
  });

  it("clamps an out-of-range start with zero delta", () => {
    expect(stepValue(99, 0, 1, 20)).toBe(20);
  });
});

describe("stepperData", () => {
  const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

  it("current() reflects a string model as a clamped number", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = "7";
    expect(ctx.current()).toBe(7);
  });

  it("step() writes a number back to value", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = null;
    ctx.step(1);
    expect(ctx.value).toBe(2);
  });

  it("ArrowUp and ArrowDown step and prevent default", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = 5;
    const up = key("ArrowUp");
    ctx.onKey(up);
    expect(ctx.value).toBe(6);
    expect(up.preventDefault).toHaveBeenCalled();
    ctx.onKey(key("ArrowDown"));
    expect(ctx.value).toBe(5);
  });

  it("ignores other keys", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = 5;
    const other = key("a");
    ctx.onKey(other);
    expect(ctx.value).toBe(5);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });
});
