import { WakeLockController } from "@modules/ui/wake-lock.module";

type GameLayoutContext = {
  showExitModal: boolean;
  init(this: GameLayoutContext): void;
  destroy(this: GameLayoutContext): void;
};

/**
 * Alpine factory for GameLayout's root. The WakeLockController stays in
 * this closure: Alpine deep-proxies `this.*`, and a proxied class throws
 * on every ES private field, so its lifecycle would never run.
 */
export function gameLayoutData() {
  let wakeLock: WakeLockController | null = null;

  return {
    showExitModal: false,

    init(this: GameLayoutContext) {
      wakeLock = new WakeLockController();
      void wakeLock.acquire();
    },

    destroy(this: GameLayoutContext) {
      wakeLock?.destroy();
      wakeLock = null;
    },
  };
}
