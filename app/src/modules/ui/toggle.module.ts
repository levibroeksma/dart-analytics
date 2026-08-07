import type { Orientation, Pill, ToggleOption, ToggleOpts } from "./types";

export class Toggle {
  readonly options: ToggleOption[];
  readonly orientation: Orientation;
  #value: string;
  #pill: Pill = { w: 0, h: 0, x: 0, y: 0 };
  #listEl: HTMLElement | null = null;
  #ro: ResizeObserver | null = null;
  #onPillChange?: (pill: Pill) => void;

  constructor(opts: ToggleOpts) {
    if (!opts.options.length) {
      throw new Error("Toggle requires at least one option");
    }
    this.options = opts.options;
    this.orientation = opts.orientation;
    this.#onPillChange = opts.onPillChange;
    this.#value = this.#resolveValue(opts.initial);
  }

  get value(): string {
    return this.#value;
  }

  set value(v: string) {
    this.setValue(v);
  }

  get pill(): Pill {
    return { ...this.#pill };
  }

  #resolveValue(candidate?: string): string {
    if (candidate && this.options.some((o) => o.value === candidate)) {
      return candidate;
    }
    return this.options[0].value;
  }

  setValue(value: string): void {
    if (!this.options.some((o) => o.value === value)) return;
    this.#value = value;
    this.layout();
  }

  /**
   * @param listEl - Positioned container that wraps the option list (and pill).
   */
  mount(listEl: HTMLElement): void {
    this.unmount();
    this.#listEl = listEl;
    this.#ro = new ResizeObserver(() => this.layout());
    this.#ro.observe(listEl);
    this.layout();
  }

  unmount(): void {
    this.#ro?.disconnect();
    this.#ro = null;
    this.#listEl = null;
  }

  layout(): void {
    this.#syncPill();
    this.#onPillChange?.(this.pill);
  }

  #activeItem(): HTMLElement | undefined {
    if (!this.#listEl) return undefined;
    return (
      this.#listEl.querySelector<HTMLElement>(
        `[data-toggle-value="${CSS.escape(this.#value)}"]`,
      ) ?? undefined
    );
  }

  #syncPill(): void {
    const el = this.#activeItem();
    if (!el || !this.#listEl) return;

    const listBox = this.#listEl.getBoundingClientRect();
    const itemBox = el.getBoundingClientRect();
    this.#pill = {
      w: el.offsetWidth,
      h: el.offsetHeight,
      x: itemBox.left - listBox.left + this.#listEl.scrollLeft,
      y: itemBox.top - listBox.top + this.#listEl.scrollTop,
    };
  }
}
