# iOS Standalone Wake Lock Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the screen awake on iOS Home Screen (standalone) installs, where the native Screen Wake Lock API can resolve without actually preventing sleep, per `docs/superpowers/specs/2026-09-13-wake-lock-ios-standalone-design.md`.

**Architecture:** Extend the existing `WakeLockController` (`app/src/modules/ui/wake-lock.module.ts`) with a canvas-captured `MediaStream` fallback: a hidden `<canvas>` → `captureStream(1)` → an off-screen, muted, `playsinline` `<video>` that autoplays. Detection (`navigator.standalone` or `matchMedia('(display-mode: standalone)')`) gates the fallback so it only ever runs in standalone mode; it runs unconditionally there, alongside the native API, since native success can't be trusted in that mode. No other file changes — `gameLayoutData()` and `GameLayout.astro` are untouched.

**Tech Stack:** TypeScript, Vitest (`@vitest-environment jsdom`).

## Global Constraints

- No `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts` — a one-line doc comment above the declaration only, only when non-obvious (`app/CLAUDE.md`).
- Every changed runtime `.ts` file needs a covering test (`scripts/check-test-coverage.sh`) — already satisfied since `wake-lock.module.ts` has `wake-lock.module.test.ts`.
- The fallback must run whenever standalone mode is detected, regardless of whether the native `wakeLock.request` also succeeds — do not gate it on native failure (spec decision).
- No embedded binary/base64 media asset — canvas + `MediaStream` only.
- `modules/ui/` classes: no Alpine import, no `@stores`/`@client/api` import (portability contract, `04-Modules-And-OOP.md`).

---

### Task 1: Video fallback in `WakeLockController`

**Files:**
- Modify: `app/src/modules/ui/wake-lock.module.ts`
- Test: `app/tests/modules/ui/wake-lock.module.test.ts`

**Interfaces:**
- No change to `WakeLockController`'s public surface: `constructor(options?: { onError?: (err: unknown) => void })`, `acquire(): Promise<void>`, `release(): Promise<void>`, `destroy(): void`. `gameLayoutData()` (consumer) needs no changes.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `app/tests/modules/ui/wake-lock.module.test.ts` with:

```typescript
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
    stubWakeLock(vi.fn(async () => sentinel), { standalone: true });
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
    stubWakeLock(vi.fn(async () => sentinel), { standalone: true });
    const { tracks } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();
    await controller.release();

    expect(tracks[0].stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("stops the video fallback on destroy", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel), { standalone: true });
    const { tracks } = stubVideoFallback();

    const controller = trackedController();
    await controller.acquire();
    controller.destroy();

    expect(tracks[0].stop).toHaveBeenCalled();
    expect(document.querySelector("video")).toBeNull();
  });

  it("resumes a paused video fallback when the tab becomes visible", async () => {
    const sentinel = makeSentinel();
    stubWakeLock(vi.fn(async () => sentinel), { standalone: true });
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts`
Expected: the 9 pre-existing tests PASS unchanged; the 6 new standalone/fallback tests FAIL (no fallback behavior implemented yet).

- [ ] **Step 3: Write the implementation**

Replace the full contents of `app/src/modules/ui/wake-lock.module.ts` with:

```typescript
type WakeLockControllerOptions = {
  onError?: (err: unknown) => void;
};

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(event: "release", handler: () => void): void;
  removeEventListener(event: "release", handler: () => void): void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
  standalone?: boolean;
};

function isStandaloneDisplayMode(): boolean {
  const nav = navigator as NavigatorWithWakeLock;
  if (nav.standalone === true) return true;
  return (
    typeof matchMedia === "function" &&
    matchMedia("(display-mode: standalone)").matches
  );
}

function createFallbackVideo(): HTMLVideoElement {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  video.style.position = "fixed";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  video.srcObject = canvas.captureStream(1);
  return video;
}

/**
 * Requests a screen wake lock and re-acquires it when the tab returns to
 * the foreground — the browser silently drops the lock on backgrounding.
 * In standalone (iOS Home Screen) mode the native API can resolve without
 * actually preventing sleep, so a canvas-captured silent video runs in
 * parallel there regardless of the native request's outcome.
 */
export class WakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private fallbackVideo: HTMLVideoElement | null = null;
  private held = false;
  private readonly onError?: (err: unknown) => void;
  private readonly handleVisibilityChange = () => {
    if (!this.held || document.visibilityState !== "visible") return;
    if (!this.sentinel) void this.requestSentinel();
    if (this.fallbackVideo?.paused) void this.fallbackVideo.play();
  };

  constructor(options: WakeLockControllerOptions = {}) {
    this.onError = options.onError;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  async acquire(): Promise<void> {
    this.held = true;
    await this.requestSentinel();
    if (isStandaloneDisplayMode()) this.startFallbackVideo();
  }

  private async requestSentinel(): Promise<void> {
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    try {
      const sentinel = await nav.wakeLock.request("screen");
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      });
    } catch (err) {
      this.onError?.(err);
    }
  }

  private startFallbackVideo(): void {
    if (this.fallbackVideo) return;
    const video = createFallbackVideo();
    document.body.appendChild(video);
    void video.play().catch((err) => this.onError?.(err));
    this.fallbackVideo = video;
  }

  private stopFallbackVideo(): void {
    if (!this.fallbackVideo) return;
    const stream = this.fallbackVideo.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    this.fallbackVideo.remove();
    this.fallbackVideo = null;
  }

  async release(): Promise<void> {
    this.held = false;
    this.stopFallbackVideo();
    if (!this.sentinel) return;
    await this.sentinel.release();
    this.sentinel = null;
  }

  destroy(): void {
    this.held = false;
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.stopFallbackVideo();
    void this.sentinel?.release();
    this.sentinel = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts`
Expected: PASS (15 tests: 9 pre-existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/ui/wake-lock.module.ts app/tests/modules/ui/wake-lock.module.test.ts
git commit -m "feat: add iOS standalone video fallback to WakeLockController"
```

---

### Task 2: Full validation + context maintenance

**Files:** none new — verification only.

- [ ] **Step 1: Run the full app validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; type gate reports 0 errors/0 warnings/0 hints.

- [ ] **Step 2: Run the full test suite**

Run: `cd app && npx vitest run`
Expected: all tests PASS, including the updated wake-lock test file.

- [ ] **Step 3: Format check**

Run: `cd app && npm run format:check`
Expected: clean. If not, run `npm run format` and re-check.

- [ ] **Step 4: Run repo gates**

Run the `run-all-gates` skill for `app/` changes (structural gates: file-locations, agent-mirrors, alias-sync, no-inline-comments, style-tokens, test-coverage, etc.).
Expected: every dispatched `check-*.sh` script passes.

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill (root `CLAUDE.md` mandatory step) — no context-map/decision-ledger changes are expected for this task (no new file locations, no architectural decision), but the skill must confirm that and log nothing stale.

- [ ] **Step 6: Commit any fixups**

```bash
git add -A
git commit -m "chore: validation fixups"
```
(Only if Steps 1–5 required changes; skip if everything was already clean.)
