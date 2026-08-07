import { Toggle } from "@modules/ui/toggle.module";
import type { Orientation, Pill, ToggleOption } from "@modules/types";

type ToggleDataConfig = {
  options?: ToggleOption[];
  orientation?: Orientation;
  initial?: string;
};

type ToggleDataContext = {
  activeTab: string;
  options: ToggleOption[];
  orientation: Orientation;
  pill: Pill;
  $refs: { list?: HTMLElement };
  $watch(key: "activeTab", callback: (value: string) => void): void;
  $nextTick(callback: () => void): void;
  init(this: ToggleDataContext): void;
  destroy(this: ToggleDataContext): void;
  select(this: ToggleDataContext, value: string): void;
};

/**
 * Alpine factory for the setup Toggle. The Toggle instance stays in this
 * closure: Alpine deep-proxies `this.*`, and a proxied class throws on every
 * ES private field, so `mount()` / `layout()` would never run.
 */
export function toggleData(config: ToggleDataConfig = {}) {
  let toggle: Toggle | null = null;

  return {
    activeTab: config.initial ?? config.options?.[0]?.value ?? "",
    options: config.options ?? [],
    orientation: config.orientation ?? "vertical",
    pill: { w: 0, h: 0, x: 0, y: 0 },

    init(this: ToggleDataContext) {
      const resolved = this.options.some((o) => o.value === this.activeTab)
        ? this.activeTab
        : (this.options[0]?.value ?? "");
      this.activeTab = resolved;

      toggle = new Toggle({
        options: this.options,
        orientation: this.orientation,
        initial: this.activeTab,
        onPillChange: (pill) => {
          this.pill = { ...pill };
        },
      });

      this.$watch("activeTab", (value) => {
        toggle?.setValue(value);
      });

      this.$nextTick(() => {
        const list = this.$refs.list;
        if (!list || !toggle) return;
        toggle.mount(list);
        requestAnimationFrame(() => toggle?.layout());
      });
    },

    destroy(this: ToggleDataContext) {
      toggle?.unmount();
      toggle = null;
    },

    select(this: ToggleDataContext, value: string) {
      this.activeTab = value;
    },
  };
}
