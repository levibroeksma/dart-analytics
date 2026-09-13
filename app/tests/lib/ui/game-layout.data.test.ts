import { describe, it, expect, vi, beforeEach } from "vitest";

const { MockWakeLockController, instances } = vi.hoisted(() => {
  type MockInstance = {
    acquire: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  const instances: MockInstance[] = [];

  class MockWakeLockController {
    acquire = vi.fn(async () => {});
    destroy = vi.fn();

    constructor() {
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

beforeEach(() => {
  instances.length = 0;
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
});
