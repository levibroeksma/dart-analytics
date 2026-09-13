// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WakeLockController } from "@modules/ui/wake-lock.module";

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

function stubWakeLock(
  request: ReturnType<typeof vi.fn>,
  extra: Record<string, unknown> = {},
) {
  vi.stubGlobal("navigator", { wakeLock: { request }, ...extra });
}

function stubVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches })) as unknown as typeof matchMedia,
  );
}

function stubVideoFallback() {
  const tracks = [{ stop: vi.fn() }];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  const captureStream = vi.fn(() => stream);
  HTMLCanvasElement.prototype.captureStream =
    captureStream as unknown as HTMLCanvasElement["captureStream"];

  const playSpy = vi.fn(async function (this: HTMLVideoElement) {
    Object.defineProperty(this, "paused", {
      value: false,
      configurable: true,
    });
  });
  HTMLMediaElement.prototype.play =
    playSpy as unknown as HTMLMediaElement["play"];

  return { captureStream, playSpy, tracks };
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
  document.querySelectorAll("video").forEach((video) => video.remove());
  delete (HTMLCanvasElement.prototype as { captureStream?: unknown })
    .captureStream;
  delete (HTMLMediaElement.prototype as { play?: unknown }).play;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WakeLockController", () => {
  it("requests a screen wake lock on acquire", async () => {
    const sentinel = makeSentinel();
    const request = vi.fn(async () => sentinel);
    stubWakeLock(request);

    const controller = trackedController();
    await controller.acquire();

    expect(request).toHaveBeenCalledWith("screen");
  });

  it("does nothing when the Wake Lock API is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    const onError = vi.fn();

    const controller = trackedController({ onError });
    await expect(controller.acquire()).resolves.toBeUndefined();

    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a rejected request via onError instead of throwing", async () => {
    const request = vi.fn(async () => {
      throw new Error("denied");
    });
    stubWakeLock(request);
    const onError = vi.fn();

    const controller = trackedController({ onError });
    await expect(controller.acquire()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("releases the held sentinel", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel));

    const controller = trackedController();
    await controller.acquire();
    await controller.release();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("is safe to release before acquire", async () => {
    stubWakeLock(vi.fn(async () => makeSentinel()));
    const controller = trackedController();

    await expect(controller.release()).resolves.toBeUndefined();
  });

  it("re-acquires when the tab becomes visible after the sentinel released", async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi.fn(async () => first);
    stubWakeLock(request);

    const controller = trackedController();
    await controller.acquire();

    first._fireRelease();
    request.mockImplementation(async () => second);
    stubVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    await Promise.resolve();

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not re-acquire on visibilitychange once destroyed", async () => {
    const sentinel = makeSentinel();
    const request = vi.fn(async () => sentinel);
    stubWakeLock(request);

    const controller = trackedController();
    await controller.acquire();
    controller.destroy();

    sentinel._fireRelease();
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("releases the sentinel on destroy", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel));

    const controller = trackedController();
    await controller.acquire();
    controller.destroy();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("starts a video fallback when navigator.standalone is true", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(
      vi.fn(async () => sentinel),
      { standalone: true },
    );
    const { captureStream, playSpy } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();

    expect(captureStream).toHaveBeenCalledWith(1);
    expect(playSpy).toHaveBeenCalled();
    expect(document.querySelector("video")).not.toBeNull();
  });

  it("starts a video fallback when matchMedia reports standalone display-mode", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel));
    stubMatchMedia(true);
    const { playSpy } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();

    expect(playSpy).toHaveBeenCalled();
  });

  it("does not start a video fallback outside standalone mode", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel));
    const { playSpy } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();

    expect(playSpy).not.toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("stops the video fallback and its tracks on release", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(
      vi.fn(async () => sentinel),
      { standalone: true },
    );
    const { tracks } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();
    await controller.release();

    expect(tracks[0].stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("stops the video fallback on destroy", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(
      vi.fn(async () => sentinel),
      { standalone: true },
    );
    const { tracks } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();
    controller.destroy();

    expect(tracks[0].stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("resumes a paused video fallback when the tab becomes visible", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(
      vi.fn(async () => sentinel),
      { standalone: true },
    );
    const { playSpy } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();
    playSpy.mockClear();

    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "paused", {
      value: true,
      configurable: true,
    });

    stubVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(playSpy).toHaveBeenCalled();
  });
});
