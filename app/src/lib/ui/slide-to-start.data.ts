/** Fraction of thumb travel at which a release starts the game. */
export const SLIDE_THRESHOLD = 0.85;
/** Thumb width (50px) plus both 5px insets: track width minus this = travel. */
export const SLIDE_THUMB_SPAN = 60;
/** Grace period before a fired slide resets if the submit never set loading. */
export const SLIDE_RESET_MS = 600;

type SlidePointer = {
  clientX: number;
  pointerId: number;
  currentTarget: EventTarget | null;
};
type SlideKey = Pick<KeyboardEvent, "key" | "preventDefault">;

type SlideToStartContext = {
  fraction: number;
  dragging: boolean;
  fired: boolean;
  disabled: boolean;
  $refs: { track?: HTMLElement };
  $root: HTMLElement;
  $watch(key: "disabled", callback: (value: boolean) => void): void;
  fire(this: SlideToStartContext): void;
  reset(this: SlideToStartContext): void;
};

/** Horizontal drag `dx` as a 0–1 fraction of `travel`. */
export function dragFraction(dx: number, travel: number): number {
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, dx / travel));
}

/** Whether a release at `fraction` starts the game. */
export function shouldFire(fraction: number): boolean {
  return fraction >= SLIDE_THRESHOLD;
}

/**
 * Alpine factory for `SlideToStart.astro`. Drag past `SLIDE_THRESHOLD` or
 * press Enter/Space to `requestSubmit()` the enclosing form. `disabled` is
 * driven by the component's `x-effect`. A fired slide resets when
 * `disabled` drops back to false (the submit failed), or after
 * `SLIDE_RESET_MS` if it never became disabled (`start()` returned early).
 */
export function slideToStartData() {
  let startX = 0;
  let travel = 0;
  return {
    fraction: 0,
    dragging: false,
    fired: false,
    disabled: false,

    init(this: SlideToStartContext) {
      this.$watch("disabled", (value) => {
        if (!value && this.fired) this.reset();
      });
    },

    begin(this: SlideToStartContext, event: SlidePointer) {
      if (this.disabled || this.fired) return;
      travel = (this.$refs.track?.clientWidth ?? 0) - SLIDE_THUMB_SPAN;
      startX = event.clientX;
      this.dragging = true;
      (event.currentTarget as Element | null)?.setPointerCapture?.(
        event.pointerId,
      );
    },

    move(this: SlideToStartContext, event: SlidePointer) {
      if (!this.dragging) return;
      this.fraction = dragFraction(event.clientX - startX, travel);
    },

    end(this: SlideToStartContext) {
      if (!this.dragging) return;
      this.dragging = false;
      if (shouldFire(this.fraction)) {
        this.fire();
        return;
      }
      this.fraction = 0;
    },

    onKey(this: SlideToStartContext, event: SlideKey) {
      if (this.disabled || this.fired) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.fire();
    },

    fire(this: SlideToStartContext) {
      this.fraction = 1;
      this.fired = true;
      this.$root.closest("form")?.requestSubmit();
      setTimeout(() => {
        if (!this.disabled && this.fired) this.reset();
      }, SLIDE_RESET_MS);
    },

    reset(this: SlideToStartContext) {
      this.fired = false;
      this.fraction = 0;
    },
  };
}
