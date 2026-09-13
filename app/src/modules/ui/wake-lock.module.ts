import type { WakeLockEvent, WakeLockStatus } from "./types";

type WakeLockControllerOptions = {
  onEvent?: (event: WakeLockEvent) => void;
  /** Watchdog sweep period in ms; `0` disables the sweep (tests). */
  watchdogIntervalMs?: number;
};

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(event: "release", handler: () => void): void;
  removeEventListener(event: "release", handler: () => void): void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
};

/**
 * Event types after which iOS may grant a lock it refused earlier. Listened
 * to in capture phase for the whole controller lifetime, not once: a
 * one-shot listener cannot recover from a request that failed on the first
 * tap.
 */
const RETRY_EVENTS = [
  "pointerdown",
  "touchend",
  "click",
  "keyup",
] as const satisfies readonly (keyof DocumentEventMap)[];

const DEFAULT_WATCHDOG_INTERVAL_MS = 15_000;

function describeError(err: unknown): string {
  if (err instanceof DOMException) return err.name;
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Holds a screen wake lock for as long as `acquire()`..`release()` spans,
 * re-requesting it whenever the platform takes it away.
 *
 * The native Screen Wake Lock API is the only mechanism: the silent-video
 * trick (NoSleep.js and its canvas variants) has never worked in an iOS
 * Home Screen web app, and the native API works there from iOS 18.4
 * (WebKit bug 254545). iOS also revokes a held lock with no
 * `visibilitychange` — under Low Power Mode it refuses one outright — so
 * every re-entry point (sentinel release, visibility, page show, focus,
 * user gesture, watchdog sweep) funnels into one idempotent `ensureHeld()`
 * rather than a single acquisition at mount (D-WL1).
 */
export class WakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private active = false;
  private requesting = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastEvent: WakeLockEvent | null = null;
  private readonly onEvent?: (event: WakeLockEvent) => void;
  private readonly watchdogIntervalMs: number;
  private readonly revive = () => {
    void this.ensureHeld();
  };

  constructor(options: WakeLockControllerOptions = {}) {
    this.onEvent = options.onEvent;
    this.watchdogIntervalMs =
      options.watchdogIntervalMs ?? DEFAULT_WATCHDOG_INTERVAL_MS;
  }

  get status(): WakeLockStatus {
    return this.lastEvent?.status ?? "idle";
  }

  async acquire(): Promise<void> {
    if (this.active) return;
    this.active = true;
    for (const event of RETRY_EVENTS) {
      document.addEventListener(event, this.revive, true);
    }
    document.addEventListener("visibilitychange", this.revive);
    window.addEventListener("pageshow", this.revive);
    window.addEventListener("focus", this.revive);
    if (this.watchdogIntervalMs > 0) {
      this.watchdog = setInterval(this.revive, this.watchdogIntervalMs);
    }
    await this.ensureHeld();
  }

  async release(): Promise<void> {
    if (!this.active && !this.sentinel) return;
    this.active = false;
    this.teardownListeners();
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.emit("idle");
    if (sentinel && !sentinel.released) await sentinel.release();
  }

  destroy(): void {
    this.active = false;
    this.teardownListeners();
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.emit("idle");
    if (sentinel && !sentinel.released) void sentinel.release();
  }

  private teardownListeners(): void {
    for (const event of RETRY_EVENTS) {
      document.removeEventListener(event, this.revive, true);
    }
    document.removeEventListener("visibilitychange", this.revive);
    window.removeEventListener("pageshow", this.revive);
    window.removeEventListener("focus", this.revive);
    if (this.watchdog !== null) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  private async ensureHeld(): Promise<void> {
    if (!this.active || this.requesting) return;
    if (this.sentinel && !this.sentinel.released) return;
    if (document.visibilityState !== "visible") return;

    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) {
      this.emit("unsupported");
      return;
    }

    this.requesting = true;
    this.emit("requesting");
    try {
      const sentinel = await nav.wakeLock.request("screen");
      this.requesting = false;
      if (!this.active) {
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this.emit("released");
        void this.ensureHeld();
      });
      this.emit("held");
    } catch (err) {
      this.requesting = false;
      this.sentinel = null;
      this.emit("blocked", describeError(err));
    }
  }

  private emit(status: WakeLockStatus, detail?: string): void {
    if (this.lastEvent?.status === status && this.lastEvent.detail === detail) {
      return;
    }
    const event: WakeLockEvent = { status, detail, at: Date.now() };
    this.lastEvent = event;
    this.onEvent?.(event);
  }
}
