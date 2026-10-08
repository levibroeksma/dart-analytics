import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SLIDE_RESET_MS,
  SLIDE_THRESHOLD,
  dragFraction,
  shouldFire,
  slideToStartData,
} from "@lib/ui/slide-to-start.data";

describe("dragFraction / shouldFire", () => {
  it("clamps to 0–1", () => {
    expect(dragFraction(-20, 300)).toBe(0);
    expect(dragFraction(150, 300)).toBe(0.5);
    expect(dragFraction(900, 300)).toBe(1);
  });

  it("is 0 when there is no travel", () => {
    expect(dragFraction(50, 0)).toBe(0);
  });

  it("fires at the threshold, not below", () => {
    expect(SLIDE_THRESHOLD).toBe(0.85);
    expect(shouldFire(0.84)).toBe(false);
    expect(shouldFire(0.85)).toBe(true);
  });
});

describe("slideToStartData", () => {
  let requestSubmit: ReturnType<typeof vi.fn>;

  function harness() {
    requestSubmit = vi.fn();
    const watchers: Record<string, (v: boolean) => void> = {};
    const ctx = Object.assign(slideToStartData(), {
      $refs: { track: { clientWidth: 360 } as HTMLElement },
      $root: { closest: () => ({ requestSubmit }) } as unknown as HTMLElement,
      $watch(key: string, cb: (v: boolean) => void) {
        watchers[key] = cb;
      },
    });
    ctx.init();
    return { ctx, watchers };
  }

  const pointer = (clientX: number) => ({
    clientX,
    pointerId: 1,
    currentTarget: null,
  });
  const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a full drag fires once and parks at the end", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.move(pointer(10 + 300));
    ctx.end();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(ctx.fraction).toBe(1);
    expect(ctx.fired).toBe(true);
  });

  it("a short drag snaps back without firing", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.move(pointer(10 + 200));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(ctx.fraction).toBe(0);
  });

  it("a tap does not fire", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it("Enter and Space fire; other keys do not", () => {
    const { ctx } = harness();
    ctx.onKey(key("a"));
    expect(requestSubmit).not.toHaveBeenCalled();
    const enter = key("Enter");
    ctx.onKey(enter);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    const { ctx: ctx2 } = harness();
    ctx2.onKey(key(" "));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not fire twice while fired", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    ctx.onKey(key("Enter"));
    ctx.begin(pointer(10));
    ctx.move(pointer(400));
    ctx.end();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("ignores pointer and keys while disabled", () => {
    const { ctx } = harness();
    ctx.disabled = true;
    ctx.onKey(key("Enter"));
    ctx.begin(pointer(10));
    ctx.move(pointer(400));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(ctx.fraction).toBe(0);
  });

  it("resets when disabled turns false after firing (start() failed)", () => {
    const { ctx, watchers } = harness();
    ctx.onKey(key("Enter"));
    ctx.disabled = true;
    watchers.disabled(true);
    ctx.disabled = false;
    watchers.disabled(false);
    expect(ctx.fired).toBe(false);
    expect(ctx.fraction).toBe(0);
  });

  it("resets after SLIDE_RESET_MS when start() never set loading", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    vi.advanceTimersByTime(SLIDE_RESET_MS);
    expect(ctx.fired).toBe(false);
    expect(ctx.fraction).toBe(0);
  });

  it("stays fired past the timeout while still disabled (loading)", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    ctx.disabled = true;
    vi.advanceTimersByTime(SLIDE_RESET_MS);
    expect(ctx.fired).toBe(true);
  });
});
