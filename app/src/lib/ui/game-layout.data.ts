import { WakeLockController } from "@modules/ui/wake-lock.module";
import type { WakeLockEvent } from "@modules/types";

type GameLayoutContext = {
  showExitModal: boolean;
  wakeLockDebug: boolean;
  wakeLockLog: string[];
  init(this: GameLayoutContext): void;
  destroy(this: GameLayoutContext): void;
};

const DEBUG_FLAG_KEY = "wakeLockDebug";
const LOG_LIMIT = 8;

/**
 * Opt-in on-device diagnostics: `?wakelock=debug` turns the overlay on and
 * keeps it on across navigations, `?wakelock=off` turns it back off. The
 * wake lock has no observable effect in a desktop browser, so a failure on
 * an iOS Home Screen install can only be read off the device itself.
 */
function wakeLockDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const requested = new URL(window.location.href).searchParams.get(
      "wakelock",
    );
    if (requested === "debug") sessionStorage.setItem(DEBUG_FLAG_KEY, "1");
    if (requested === "off") sessionStorage.removeItem(DEBUG_FLAG_KEY);
    return sessionStorage.getItem(DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function formatWakeLockEvent(event: WakeLockEvent): string {
  const time = new Date(event.at).toTimeString().slice(0, 8);
  return event.detail
    ? `${time} ${event.status} (${event.detail})`
    : `${time} ${event.status}`;
}

/**
 * Alpine factory for GameLayout's root. The WakeLockController stays in
 * this closure: Alpine deep-proxies `this.*`, and a proxied class throws
 * on every ES private field, so its lifecycle would never run.
 */
export function gameLayoutData() {
  let wakeLock: WakeLockController | null = null;

  return {
    showExitModal: false,
    wakeLockDebug: false,
    wakeLockLog: [] as string[],

    init(this: GameLayoutContext) {
      this.wakeLockDebug = wakeLockDebugEnabled();
      const context = this;
      wakeLock = new WakeLockController({
        onEvent(event) {
          context.wakeLockLog = [
            ...context.wakeLockLog,
            formatWakeLockEvent(event),
          ].slice(-LOG_LIMIT);
        },
      });
      void wakeLock.acquire();
    },

    destroy(this: GameLayoutContext) {
      wakeLock?.destroy();
      wakeLock = null;
    },
  };
}
