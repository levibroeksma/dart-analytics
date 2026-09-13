// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const { MockWakeLockController, instances } = vi.hoisted(() => {
  type MockInstance = {
    acquire: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    options: { onEvent?: (event: unknown) => void };
  };

  const instances: MockInstance[] = [];

  class MockWakeLockController {
    acquire = vi.fn(async () => {});
    destroy = vi.fn();
    options: { onEvent?: (event: unknown) => void };

    constructor(options: { onEvent?: (event: unknown) => void } = {}) {
      this.options = options;
      instances.push(this as unknown as MockInstance);
    }
  }

  return { MockWakeLockController, instances };
});

vi.mock("@modules/ui/wake-lock.module", () => ({
  WakeLockController: MockWakeLockController,
}));

const { gameLayoutData } = await import("@lib/ui/game-layout.data");

const latest = () => instances[instances.length - 1];

function setLocation(search: string) {
  window.history.replaceState({}, "", `/games/501/play${search}`);
}

beforeEach(() => {
  instances.length = 0;
  sessionStorage.clear();
  setLocation("");
});

describe("gameLayoutData", () => {
  it("defaults showExitModal to false", () => {
    const ctx = gameLayoutData();
    expect(ctx.showExitModal).toBe(false);
  });

  it("acquires a wake lock on init", () => {
    const ctx = gameLayoutData();
    ctx.init();

    expect(instances).toHaveLength(1);
    expect(latest().acquire).toHaveBeenCalled();
  });

  it("tears down the wake lock on destroy", () => {
    const ctx = gameLayoutData();
    ctx.init();
    ctx.destroy();

    expect(latest().destroy).toHaveBeenCalled();
  });

  it("is safe to destroy before init", () => {
    const ctx = gameLayoutData();
    expect(() => ctx.destroy()).not.toThrow();
  });

  it("keeps the wake lock overlay off by default", () => {
    const ctx = gameLayoutData();
    ctx.init();

    expect(ctx.wakeLockDebug).toBe(false);
  });

  it("enables the overlay from ?wakelock=debug", () => {
    setLocation("?wakelock=debug");
    const ctx = gameLayoutData();
    ctx.init();

    expect(ctx.wakeLockDebug).toBe(true);
  });

  it("keeps the overlay on across navigations once enabled", () => {
    setLocation("?wakelock=debug");
    gameLayoutData().init();

    setLocation("");
    const next = gameLayoutData();
    next.init();

    expect(next.wakeLockDebug).toBe(true);
  });

  it("turns the overlay back off from ?wakelock=off", () => {
    setLocation("?wakelock=debug");
    gameLayoutData().init();

    setLocation("?wakelock=off");
    const next = gameLayoutData();
    next.init();

    expect(next.wakeLockDebug).toBe(false);
  });

  it("records wake lock events in the overlay log", () => {
    const ctx = gameLayoutData();
    ctx.init();

    latest().options.onEvent?.({
      status: "blocked",
      detail: "NotAllowedError",
      at: Date.parse("2026-09-13T10:11:12Z"),
    });

    expect(ctx.wakeLockLog).toHaveLength(1);
    expect(ctx.wakeLockLog[0]).toContain("blocked (NotAllowedError)");
  });

  it("caps the overlay log", () => {
    const ctx = gameLayoutData();
    ctx.init();

    for (let index = 0; index < 12; index += 1) {
      latest().options.onEvent?.({ status: "held", at: 1_000 + index });
    }

    expect(ctx.wakeLockLog).toHaveLength(8);
  });
});
