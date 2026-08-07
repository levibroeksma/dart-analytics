import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Orientation, Pill, ToggleOption } from "@modules/types";

const { MockToggle, instances } = vi.hoisted(() => {
  const instances: MockToggleInstance[] = [];

  type MockToggleInstance = {
    options: ToggleOption[];
    orientation: Orientation;
    initial?: string;
    onPillChange?: (pill: Pill) => void;
    setValue: ReturnType<typeof vi.fn>;
    mount: ReturnType<typeof vi.fn>;
    unmount: ReturnType<typeof vi.fn>;
    layout: ReturnType<typeof vi.fn>;
  };

  class MockToggle {
    options: ToggleOption[];
    orientation: Orientation;
    initial?: string;
    onPillChange?: (pill: Pill) => void;
    setValue = vi.fn();
    mount = vi.fn();
    unmount = vi.fn();
    layout = vi.fn();

    constructor(opts: {
      options: ToggleOption[];
      orientation: Orientation;
      initial?: string;
      onPillChange?: (pill: Pill) => void;
    }) {
      this.options = opts.options;
      this.orientation = opts.orientation;
      this.initial = opts.initial;
      this.onPillChange = opts.onPillChange;
      instances.push(this as unknown as MockToggleInstance);
    }
  }

  return { MockToggle, instances };
});

vi.mock("@modules/ui/toggle.module", () => ({ Toggle: MockToggle }));

const { toggleData } = await import("@lib/ui/toggle.data");

const options: ToggleOption[] = [
  { value: "rounds", label: "Rounds" },
  { value: "time", label: "Time" },
];

type Harness = {
  ctx: ReturnType<typeof toggleData> & {
    $refs: { list?: HTMLElement };
    $watch(key: "activeTab", callback: (value: string) => void): void;
    $nextTick(callback: () => void): void;
  };
  watchers: Record<string, (value: string) => void>;
  ticks: Array<() => void>;
};

function harness(
  config: Parameters<typeof toggleData>[0] = {},
  list?: HTMLElement,
): Harness {
  const watchers: Record<string, (value: string) => void> = {};
  const ticks: Array<() => void> = [];

  const ctx = Object.assign(toggleData(config), {
    $refs: { list },
    $watch(key: "activeTab", callback: (value: string) => void) {
      watchers[key] = callback;
    },
    $nextTick(callback: () => void) {
      ticks.push(callback);
    },
  }) as Harness["ctx"];

  return { ctx, watchers, ticks };
}

const listEl = () => ({}) as HTMLElement;
const latest = () => instances[instances.length - 1];

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toggleData", () => {
  describe("defaults", () => {
    it("uses initial when provided", () => {
      const { ctx } = harness({ options, initial: "time" });
      expect(ctx.activeTab).toBe("time");
    });

    it("falls back to the first option when initial omitted", () => {
      const { ctx } = harness({ options });
      expect(ctx.activeTab).toBe("rounds");
    });

    it("is empty when there are no options", () => {
      const { ctx } = harness();
      expect(ctx.activeTab).toBe("");
      expect(ctx.options).toEqual([]);
    });

    it("defaults orientation to vertical and pill to zeroes", () => {
      const { ctx } = harness({ options });
      expect(ctx.orientation).toBe("vertical");
      expect(ctx.pill).toEqual({ w: 0, h: 0, x: 0, y: 0 });
    });

    it("honours an explicit orientation", () => {
      const { ctx } = harness({ options, orientation: "horizontal" });
      expect(ctx.orientation).toBe("horizontal");
    });
  });

  describe("init", () => {
    it("keeps an activeTab that matches an option", () => {
      const { ctx } = harness({ options, initial: "time" });
      ctx.init();
      expect(ctx.activeTab).toBe("time");
      expect(latest().initial).toBe("time");
    });

    it("resolves an unknown activeTab to the first option", () => {
      const { ctx } = harness({ options, initial: "nope" });
      ctx.init();
      expect(ctx.activeTab).toBe("rounds");
      expect(latest().initial).toBe("rounds");
    });

    it("constructs the Toggle with the resolved options and orientation", () => {
      const { ctx } = harness({ options, orientation: "horizontal" });
      ctx.init();
      expect(instances).toHaveLength(1);
      expect(latest().options).toEqual(options);
      expect(latest().orientation).toBe("horizontal");
    });

    it("copies pill updates onto the context rather than sharing the reference", () => {
      const { ctx } = harness({ options });
      ctx.init();

      const pill: Pill = { w: 10, h: 4, x: 2, y: 1 };
      latest().onPillChange?.(pill);

      expect(ctx.pill).toEqual(pill);
      expect(ctx.pill).not.toBe(pill);
    });

    it("forwards activeTab changes to the Toggle instance", () => {
      const { ctx, watchers } = harness({ options });
      ctx.init();

      watchers.activeTab?.("time");

      expect(latest().setValue).toHaveBeenCalledWith("time");
    });

    it("mounts the list ref and lays out on the next frame", () => {
      const list = listEl();
      const { ctx, ticks } = harness({ options }, list);
      ctx.init();

      ticks.forEach((tick) => tick());

      expect(latest().mount).toHaveBeenCalledWith(list);
      expect(latest().layout).toHaveBeenCalled();
    });

    it("does not mount when the list ref is missing", () => {
      const { ctx, ticks } = harness({ options });
      ctx.init();

      ticks.forEach((tick) => tick());

      expect(latest().mount).not.toHaveBeenCalled();
      expect(latest().layout).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("unmounts the Toggle instance", () => {
      const { ctx } = harness({ options });
      ctx.init();
      const toggle = latest();

      ctx.destroy();

      expect(toggle.unmount).toHaveBeenCalled();
    });

    it("releases the closure so later watches do not reach the old instance", () => {
      const { ctx, watchers } = harness({ options });
      ctx.init();
      const toggle = latest();

      ctx.destroy();
      watchers.activeTab?.("time");

      expect(toggle.setValue).not.toHaveBeenCalled();
    });

    it("is safe to call before init", () => {
      const { ctx } = harness({ options });
      expect(() => ctx.destroy()).not.toThrow();
    });
  });

  describe("select", () => {
    it("sets activeTab", () => {
      const { ctx } = harness({ options });
      ctx.init();

      ctx.select("time");

      expect(ctx.activeTab).toBe("time");
    });
  });
});
