import { pickTip, tipDisplayMs } from "@lib/training/tips/tip-pick";
import { prefersReducedMotion } from "@lib/ui/motion";

/** How long the tip card fades out before the next tip shows. */
export const TIP_FADE_MS = 300;

/**
 * Alpine factory for the paused-screen tip: `start()` shows a tip for the
 * key `readKey()` returns and changes it after `tipDisplayMs(tip)`, with a
 * `TIP_FADE_MS` fade-out unless the user prefers reduced motion. `stop()`
 * ends the rotation; the last tip is remembered so the next one differs.
 */
export function pausedTipsData(readKey: () => string | null | undefined) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: string | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    tip: "",
    visible: false,

    show() {
      last = pickTip(readKey(), last);
      this.tip = last;
      this.visible = true;
      timer = setTimeout(() => this.change(), tipDisplayMs(last));
    },

    change() {
      if (prefersReducedMotion()) {
        this.show();
        return;
      }
      this.visible = false;
      timer = setTimeout(() => this.show(), TIP_FADE_MS);
    },

    start() {
      clear();
      this.show();
    },

    stop() {
      clear();
    },

    destroy() {
      clear();
    },
  };
}
