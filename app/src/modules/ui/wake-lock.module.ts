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
