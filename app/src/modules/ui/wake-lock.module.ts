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
};

/**
 * Requests a screen wake lock and re-acquires it when the tab returns to
 * the foreground — the browser silently drops the lock on backgrounding.
 */
export class WakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private held = false;
  private readonly onError?: (err: unknown) => void;
  private readonly handleVisibilityChange = () => {
    if (this.held && document.visibilityState === "visible" && !this.sentinel) {
      void this.requestSentinel();
    }
  };

  constructor(options: WakeLockControllerOptions = {}) {
    this.onError = options.onError;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  async acquire(): Promise<void> {
    this.held = true;
    await this.requestSentinel();
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

  async release(): Promise<void> {
    this.held = false;
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
    void this.sentinel?.release();
    this.sentinel = null;
  }
}
