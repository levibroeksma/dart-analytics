import { pickTip, tipDisplayMs } from "@lib/training/tips/tip-pick";
import { prefersReducedMotion } from "@lib/ui/motion";

/** How long the tip card slides out to the left before the next tip shows. */
export const TIP_SLIDE_MS = 440;

/**
 * Sets `inert` on every sibling along the path from `root` up to the body, so
 * keyboard focus cannot reach content the paused screen covers. Returns the
 * elements it marked; an element already `inert` is left to its owner.
 */
function isolate(root: Element): Element[] {
  const marked: Element[] = [];
  for (let node = root; node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute("inert")) continue;
      if (["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) continue;
      sibling.setAttribute("inert", "");
      marked.push(sibling);
    }
  }
  return marked;
}

/**
 * Alpine factory for the paused-screen tip: `start()` shows a tip for the
 * key `readKey()` returns and changes it after `tipDisplayMs(tip)`: the card
 * slides out to the left for `TIP_SLIDE_MS`, then the next tip slides in from
 * the right (`slide`: `rest`, `out`, `in`). With reduced motion the tip swaps
 * in place. `stop()`
 * ends the rotation; the last tip is remembered so the next one differs.
 * While started it also makes everything outside the screen `inert`; `stop()`
 * and `destroy()` lift that. The screen is not a dialog (D526), so it carries
 * no dialog role.
 */
export function pausedTipsData(readKey: () => string | null | undefined) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: string | null = null;
  let marked: Element[] = [];

  const release = () => {
    for (const element of marked) element.removeAttribute("inert");
    marked = [];
  };

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    tip: "",
    visible: false,
    entering: false,

    get slide(): "rest" | "out" | "in" {
      if (!this.visible) return "out";
      return this.entering ? "in" : "rest";
    },

    show(entering = false) {
      last = pickTip(readKey(), last);
      this.tip = last;
      this.entering = entering;
      this.visible = true;
      timer = setTimeout(() => this.change(), tipDisplayMs(last));
    },

    change() {
      if (prefersReducedMotion()) {
        this.show();
        return;
      }
      this.visible = false;
      timer = setTimeout(() => this.show(true), TIP_SLIDE_MS);
    },

    start() {
      clear();
      release();
      const root = (this as { $el?: Element }).$el;
      if (root) marked = isolate(root);
      this.show();
    },

    stop() {
      clear();
      release();
    },

    destroy() {
      clear();
      release();
    },
  };
}
