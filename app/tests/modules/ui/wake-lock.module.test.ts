// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WakeLockController } from "@modules/ui/wake-lock.module";
import type { WakeLockEvent } from "@modules/types";

type MockSentinel = {
  released: boolean;
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _fireRelease(): void;
};

function makeSentinel(): MockSentinel {
  let releaseHandler: (() => void) | undefined;
  const sentinel: MockSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
    }),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === "release") releaseHandler = handler;
    }),
    removeEventListener: vi.fn(),
    _fireRelease() {
      sentinel.released = true;
      releaseHandler?.();
    },
  };
  return sentinel;
}

function stubWakeLock(request: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("navigator", { wakeLock: { request } });
}

function stubVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

function fireGesture() {
  document.dispatchEvent(new Event("pointerdown"));
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

let controllers: WakeLockController[] = [];

function trackedController(
  ...args: ConstructorParameters<typeof WakeLockController>
): WakeLockController {
  const controller = new WakeLockController(...args);
  controllers.push(controller);
  return controller;
}

beforeEach(() => {
  stubVisibility("visible");
});

afterEach(() => {
  controllers.forEach((controller) => controller.destroy());
  controllers = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WakeLockController", () => {
  it("requests a screen wake lock immediately on acquire", async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();

    expect(request).toHaveBeenCalledWith("screen");
    expect(controller.status).toBe("held");
  });

  it("does not request again while the lock is held", async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    fireGesture();
    fireGesture();
    await settle();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retries on a later gesture after a blocked request", async () => {
    const request = vi
      .fn<() => Promise<MockSentinel>>()
      .mockRejectedValueOnce(new DOMException("nope", "NotAllowedError"))
      .mockResolvedValue(makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    expect(controller.status).toBe("blocked");

    fireGesture();
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
    expect(controller.status).toBe("held");
  });

  it("re-acquires when the platform revokes the sentinel with no visibility change", async () => {
    const first = makeSentinel();
    const request = vi
      .fn<() => Promise<MockSentinel>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    first._fireRelease();
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
    expect(controller.status).toBe("held");
  });

  it("re-acquires when the tab becomes visible again", async () => {
    const first = makeSentinel();
    const request = vi
      .fn<() => Promise<MockSentinel>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();

    stubVisibility("hidden");
    first._fireRelease();
    await settle();
    expect(request).toHaveBeenCalledTimes(1);

    stubVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("re-acquires on pageshow", async () => {
    const first = makeSentinel();
    const request = vi
      .fn<() => Promise<MockSentinel>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();

    stubVisibility("hidden");
    first._fireRelease();
    await settle();
    stubVisibility("visible");
    window.dispatchEvent(new Event("pageshow"));
    await settle();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("re-acquires from the watchdog sweep when no event fires", async () => {
    vi.useFakeTimers();
    const first = makeSentinel();
    const request = vi
      .fn<() => Promise<MockSentinel>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 1000 });
    await controller.acquire();
    first.released = true;

    await vi.advanceTimersByTimeAsync(1000);

    expect(request).toHaveBeenCalledTimes(2);
    controller.destroy();
    vi.useRealTimers();
  });

  it("does not request while the document is hidden", async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);
    stubVisibility("hidden");

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();

    expect(request).not.toHaveBeenCalled();
  });

  it("reports an unsupported platform once", async () => {
    vi.stubGlobal("navigator", {});
    const events: WakeLockEvent[] = [];

    const controller = trackedController({
      watchdogIntervalMs: 0,
      onEvent: (event) => events.push(event),
    });
    await controller.acquire();
    fireGesture();
    await settle();

    expect(events.map((event) => event.status)).toEqual(["unsupported"]);
  });

  it("reports a rejected request with its error name instead of throwing", async () => {
    const request = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    stubWakeLock(request);
    const events: WakeLockEvent[] = [];

    const controller = trackedController({
      watchdogIntervalMs: 0,
      onEvent: (event) => events.push(event),
    });
    await controller.acquire();

    expect(events.at(-1)).toMatchObject({
      status: "blocked",
      detail: "NotAllowedError",
    });
  });

  it("releases the held sentinel", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel));

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    await controller.release();

    expect(sentinel.release).toHaveBeenCalled();
    expect(controller.status).toBe("idle");
  });

  it("stops retrying after release", async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    await controller.release();
    fireGesture();
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("stops retrying after destroy", async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    controller.destroy();
    fireGesture();
    await settle();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases a sentinel that resolves after release was called", async () => {
    const sentinel = makeSentinel();
    let resolveRequest: ((value: MockSentinel) => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise<MockSentinel>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    stubWakeLock(request);

    const controller = trackedController({ watchdogIntervalMs: 0 });
    const pending = controller.acquire();
    await controller.release();
    resolveRequest?.(sentinel);
    await pending;
    await settle();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("is safe to release before acquire", async () => {
    stubWakeLock(vi.fn(async () => makeSentinel()));
    const controller = trackedController({ watchdogIntervalMs: 0 });

    await expect(controller.release()).resolves.toBeUndefined();
  });

  it("never plays a media element as a fallback", async () => {
    stubWakeLock(vi.fn(async () => makeSentinel()));

    const controller = trackedController({ watchdogIntervalMs: 0 });
    await controller.acquire();
    fireGesture();
    await settle();

    expect(document.querySelector("video")).toBeNull();
  });
});
