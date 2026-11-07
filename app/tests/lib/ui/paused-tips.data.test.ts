// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Alpine from "alpinejs";
import { TIP_SLIDE_MS, pausedTipsData } from "@lib/ui/paused-tips.data";
import { GENERAL_TIPS } from "@lib/training/tips/tips";
import { tipDisplayMs, tipsFor } from "@lib/training/tips/tip-pick";

const KEY = "TUOD_V1";

function setup(reduced = false) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  return pausedTipsData(() => KEY);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pausedTipsData", () => {
  it("start shows a tip", () => {
    const tips = setup();
    tips.start();
    expect([...tipsFor(KEY), ...GENERAL_TIPS]).toContain(tips.tip);
    expect(tips.visible).toBe(true);
  });

  it("rotates after the display time", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first) + TIP_SLIDE_MS);
    expect(tips.tip).not.toBe(first);
    expect(tips.visible).toBe(true);
  });

  it("does not rotate early", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first) - 1);
    expect(tips.tip).toBe(first);
    expect(tips.visible).toBe(true);
  });

  it("slides out to the left before the change", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first));
    expect(tips.visible).toBe(false);
    expect(tips.slide).toBe("out");
    expect(tips.tip).toBe(first);
  });

  it("slides the next tip in from the right, not the first", () => {
    const tips = setup();
    tips.start();
    expect(tips.slide).toBe("rest");
    vi.advanceTimersByTime(tipDisplayMs(tips.tip) + TIP_SLIDE_MS);
    expect(tips.slide).toBe("in");
  });

  it("stop clears the timer", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    tips.stop();
    vi.advanceTimersByTime(60_000);
    expect(tips.tip).toBe(first);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("start twice keeps one timer", () => {
    const tips = setup();
    tips.start();
    tips.start();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("start does not repeat the last tip", () => {
    const tips = setup();
    tips.start();
    const first = tips.tip;
    tips.stop();
    tips.start();
    expect(tips.tip).not.toBe(first);
  });

  it("reduced motion swaps without sliding", () => {
    const tips = setup(true);
    tips.start();
    const first = tips.tip;
    vi.advanceTimersByTime(tipDisplayMs(first));
    expect(tips.visible).toBe(true);
    expect(tips.slide).toBe("rest");
    expect(tips.tip).not.toBe(first);
  });

  it("destroy stops the rotation", () => {
    const tips = setup();
    tips.start();
    tips.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("picks once per rotation under an Alpine effect", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const tips = Alpine.reactive(pausedTipsData(() => KEY));
    const paused = Alpine.reactive({ value: true });
    Alpine.effect(() => (paused.value ? tips.start() : tips.stop()));
    const first = tips.tip;
    const callsAfterStart = random.mock.calls.length;
    await vi.advanceTimersByTimeAsync(tipDisplayMs(first) + TIP_SLIDE_MS);
    expect(random.mock.calls.length - callsAfterStart).toBe(2);
    expect(tips.tip).not.toBe(first);
    expect(vi.getTimerCount()).toBe(1);
  });

  describe("focus isolation", () => {
    function page() {
      document.body.innerHTML = `
        <header id="bar"><button>menu</button></header>
        <main id="play"><section id="board"></section>
          <div id="wrap"><div id="overlay"><button id="resume">go</button></div><p id="aside">x</p></div>
        </main>`;
      const overlay = document.getElementById("overlay")!;
      const tips = Object.assign(setup(), { $el: overlay });
      return { overlay, tips };
    }
    const inert = (id: string) =>
      document.getElementById(id)!.hasAttribute("inert");

    it("start makes everything outside the overlay inert", () => {
      const { tips } = page();
      tips.start();
      expect(inert("bar")).toBe(true);
      expect(inert("board")).toBe(true);
      expect(inert("aside")).toBe(true);
      expect(inert("overlay")).toBe(false);
      expect(inert("wrap")).toBe(false);
      expect(inert("play")).toBe(false);
    });

    it("stop lifts only what start marked", () => {
      const { tips } = page();
      document.getElementById("board")!.setAttribute("inert", "");
      tips.start();
      tips.stop();
      expect(inert("bar")).toBe(false);
      expect(inert("aside")).toBe(false);
      expect(inert("board")).toBe(true);
    });

    it("destroy lifts the isolation", () => {
      const { tips } = page();
      tips.start();
      tips.destroy();
      expect(inert("bar")).toBe(false);
    });

    it("start twice does not mark the first pass's elements as owned by others", () => {
      const { tips } = page();
      tips.start();
      tips.start();
      tips.stop();
      expect(inert("bar")).toBe(false);
    });
  });
});
