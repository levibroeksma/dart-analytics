import { describe, it, expect, vi, afterEach } from "vitest";
import { SCORE_TWEEN_MS, scoreTween } from "@lib/ui/score-tween.data";

type Watcher = (next: unknown, previous: unknown) => void;

function setup(initial: unknown, reduced = false) {
  let now = 0;
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  let watcher: Watcher = () => {};
  let value = initial;
  const tween = Object.assign(
    scoreTween(() => value),
    {
      $watch: (_getter: () => unknown, cb: Watcher) => {
        watcher = cb;
      },
    },
  ) as any;
  tween.init();
  const change = (next: unknown) => {
    const previous = value;
    value = next;
    watcher(next, previous);
  };
  const advance = (ms: number) => {
    now += ms;
    const due = frames.splice(0);
    due.forEach((cb) => cb(now));
  };
  return { tween, change, advance };
}

afterEach(() => vi.unstubAllGlobals());

describe("scoreTween", () => {
  it("counts down over 700ms", () => {
    expect(SCORE_TWEEN_MS).toBe(700);
    const { tween, change, advance } = setup(230);
    change(90);
    expect(tween.display).toBe(230);
    advance(350);
    expect(tween.display).toBeLessThan(230);
    expect(tween.display).toBeGreaterThan(90);
    advance(350);
    expect(tween.display).toBe(90);
  });

  it("jumps on an increase", () => {
    const { tween, change } = setup(90);
    change(230);
    expect(tween.display).toBe(230);
  });

  it("jumps under reduced motion", () => {
    const { tween, change } = setup(230, true);
    change(90);
    expect(tween.display).toBe(90);
  });

  it("counts down when matchMedia is unavailable", () => {
    const { tween, change, advance } = setup(230);
    vi.stubGlobal("matchMedia", undefined);
    change(90);
    advance(350);
    expect(tween.display).toBeGreaterThan(90);
  });

  it("shows non-numeric values as they are", () => {
    const { tween, change } = setup("—");
    expect(tween.display).toBe("—");
    change("BUST");
    expect(tween.display).toBe("BUST");
  });
});
