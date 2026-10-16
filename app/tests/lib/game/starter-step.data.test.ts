import { describe, it, expect, vi } from "vitest";
import { starterStep } from "@lib/game/starter-step.data";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

function makeStep(
  opts: {
    bot?: boolean;
    random?: () => number;
    storage?: ReturnType<typeof memoryStorage>;
  } = {},
) {
  const waits: number[] = [];
  const onResolve = vi.fn();
  const onCancel = vi.fn();
  const step = starterStep({
    sides: () => ["Levi", opts.bot ? "Dartbot" : "Rosa"],
    opponentIsBot: () => opts.bot ?? false,
    onResolve,
    onCancel,
    random: opts.random ?? (() => 0),
    wait: async (ms: number) => {
      waits.push(ms);
    },
    storage: opts.storage ?? memoryStorage(),
  });
  return { step, waits, onResolve, onCancel };
}

const tapAt = (xMm: number, yMm: number) =>
  ({
    clientX: 100 + (xMm / 115) * 100,
    clientY: 100 + (yMm / 115) * 100,
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
      }),
    },
  }) as unknown as MouseEvent;

describe("starterStep", () => {
  it("defaults to bull-off", () => {
    expect(makeStep().step.method).toBe("bull");
  });

  it("remembers the last method", () => {
    const storage = memoryStorage();
    makeStep({ storage }).step.setMethod("coin");
    expect(storage.data["starter-method"]).toBe("coin");
    expect(makeStep({ storage }).step.method).toBe("coin");
  });

  it("switching method resets", () => {
    const { step } = makeStep();
    step.tap(tapAt(10, 0));
    step.setMethod("coin");
    step.setMethod("bull");
    expect(step.pending).toBeNull();
    expect(step.points).toEqual([null, null]);
    expect(step.phase).toBe("enter");
  });

  it("clamps a tap outside the crop to its edge", () => {
    const { step } = makeStep();
    step.tap(tapAt(200, 0));
    expect(step.pending!.x).toBeCloseTo(111);
  });

  it("bot bull-off runs the phase sequence and picks the closer dart", async () => {
    const { step, waits } = makeStep({ bot: true, random: () => 0.5 });
    step.tap(tapAt(60, 0));
    await step.confirm();
    expect(waits).toEqual([500, 750, 240, 70, 600, 1000]);
    expect(step.phase).toBe("result");
    expect(step.winner()).toBe(1);
    expect(step.cta()).toBe("Dartbot throws first");
  });

  it("exposes the bot dart as a flight while it is thrown", async () => {
    const { step } = makeStep({ bot: true, random: () => 0.5 });
    const seen: (string | undefined)[] = [];
    step.wait = async () => {
      seen.push(step.botFlight?.phase);
    };
    step.tap(tapAt(60, 0));
    await step.confirm();
    expect(seen).toEqual([undefined, "aim", "fly", "hit", "land", undefined]);
  });

  it("guest bull-off takes two inputs in turn", async () => {
    const { step, waits } = makeStep();
    step.tap(tapAt(30, 0));
    await step.confirm();
    expect(step.phase).toBe("enter");
    expect(step.enterSide).toBe(1);
    step.tap(tapAt(0, 5));
    await step.confirm();
    expect(waits).toEqual([1000]);
    expect(step.winner()).toBe(1);
  });

  it("confirm does nothing before a tap", async () => {
    const { step } = makeStep();
    await step.confirm();
    expect(step.points).toEqual([null, null]);
  });

  it("tie offers throw again", async () => {
    const { step } = makeStep();
    step.tap(tapAt(10, 0));
    await step.confirm();
    step.tap(tapAt(0, -10.5));
    await step.confirm();
    expect(step.tie()).toBe(true);
    expect(step.winner()).toBeNull();
    step.again();
    expect(step.phase).toBe("enter");
    expect(step.enterSide).toBe(0);
  });

  it("coin toss resolves the caller win", async () => {
    const { step, waits } = makeStep({ random: () => 0.1 });
    step.setMethod("coin");
    await step.call("heads");
    expect(waits).toEqual([750, 830]);
    expect(step.coinPhase).toBe("result");
    expect(step.outcome).toBe("heads");
    expect(step.rotation).toBe(1800);
    expect(step.winner()).toBe(0);
  });

  it("a wrong call hands the start to the other side", async () => {
    const { step } = makeStep({ random: () => 0.9 });
    step.setMethod("coin");
    await step.call("heads");
    expect(step.winner()).toBe(1);
    expect(step.cta()).toBe("Rosa throws first");
  });

  it("start resolves with the winner index", async () => {
    const { step, onResolve } = makeStep({ random: () => 0.9 });
    step.setMethod("coin");
    step.start();
    expect(onResolve).not.toHaveBeenCalled();
    await step.call("heads");
    step.start();
    expect(onResolve).toHaveBeenCalledWith(1);
  });

  it("cancel leaves no session", () => {
    const { step, onResolve, onCancel } = makeStep();
    step.cancel();
    expect(onCancel).toHaveBeenCalled();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("a reset mid-sequence stops the stale sequence", async () => {
    const { step } = makeStep({ bot: true, random: () => 0.5 });
    step.wait = async () => {
      if (step.phase === "aim") step.again();
    };
    step.tap(tapAt(60, 0));
    await step.confirm();
    expect(step.phase).toBe("enter");
  });
});
