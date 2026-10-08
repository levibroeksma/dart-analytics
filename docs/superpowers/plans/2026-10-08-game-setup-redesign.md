# Game Setup Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 11 game setup pages to the Claude Design `Game Setup.dc.html` look, with new bounded primitives (`Stepper`, `RangeSlider`, `SlideToStart`) replacing the free numeric inputs and the Start button.

**Architecture:** The shared setup components (`SetupShell`, `UserSection` and avatars, `InfoSection`, `SettingSectionShell`, `Toggle`, `Switch`) are restyled once, and every form inherits the change. The new primitives follow the existing `Toggle` pattern:
- a `.astro` component with `x-data="<name>(config)"` and `x-modelable="value"`;
- a factory in `app/src/lib/ui/<name>.data.ts`, registered in `register-ui-data.ts`;
- pure helpers exported from that file and unit-tested.

Setup data factories, `setup-controller.ts` and every `start()` stay unchanged.

**Tech Stack:** Astro 5, Alpine.js, Tailwind v4 (`@utility` in `global.css`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-game-setup-redesign-design.md`

## Global Constraints

- Branch is `feat/game-setup-redesign`. Commit per task.
- No domain, config or API change. The only adjacent lib edits are exports: `FIVE_OH_ONE_LEGS_MAX` and `AROUND_THE_CLOCK_DEFAULT_MINUTES`.
- No new icon files. Use `@icons/chevron-down.svg`, `@icons/plus.svg`, `@icons/play-rounded.svg` and `@icons/target.svg`, coloured through `currentColor`.
- Slider bounds come from the domain helpers (`*DurationBounds`), never from the design's 5–30.
- `SLIDE_THRESHOLD = 0.85`. A tap alone never starts. Enter or Space starts.
- 501's "Best of" and "Sets" render locked (`disabled: true`). "First to" and "Legs" stay selected.
- Components:
  - no raw `oklch` and no palette utilities (`bg-white`, `bg-black/…`, `sky-*`); new values go into `app/src/styles/global.css` as `@utility`
  - `cn()` for class composition
  - every `x-show` pairs with `x-cloak`
  - no HTML comments in templates
  - no `//` comments inside function bodies
  - JSDoc header on every component and exported function
- Typography:
  - `font-display` (Michroma) for titles and big values
  - `font-mono` only for labels, counts and numbers
  - never `font-medium`
- Greys snap to tokens (D429): 70 → `text-muted-foreground`, 55 → `text-muted`, 80/82 → `text-soft-foreground`.
- Rules copy (`infoSection.description`) and page titles are unchanged. Only control labels change, as listed per task.
- Tests: from `app/`, run `npm test -- <path>` for one file and `npm test` for the full suite. Write the failing test first (app/CLAUDE.md §TDD).

## Review Focus

1. **A slider receives a `null` or string model.** ATC starts with `durationValue: null`, and presets can carry strings. The slider shows `fallback` (or the clamped number) and writes back a number. Owned by Task 4: `normaliseSliderValue` tests plus the write-back on `$nextTick`.
2. **`start()` returns early without touching `loading`** (the "no preset" path). The slide thumb must not stay stuck at the end. Owned by Task 5: the fake-timer reset test.
3. **Double fire.** A drag release followed by Enter while already fired must call `requestSubmit` exactly once. Owned by Task 5.
4. **Interaction during reconciliation.** While `disabled` (loading or reconciliation), pointer and key input does nothing. Owned by Task 5.
5. **`legsToWin` arrives as a string or `null`** from a preset. The Stepper shows a clamped number, and stepping starts from there. Owned by Task 3: the `stepValue` coercion tests.

---

### Task 1: Toggle — disabled options + restyle

**Files:**
- Modify: `app/src/modules/ui/types.ts:2` (`ToggleOption`)
- Modify: `app/src/lib/ui/toggle.data.ts` (`select`)
- Modify: `app/src/components/layout/games/setup/Toggle.astro`
- Modify: `app/src/components/layout/games/setup/ToggleListItem.astro`
- Test: `app/tests/lib/ui/toggle.data.test.ts`

**Interfaces:**
- Produces: `ToggleOption = { value: string; label: string; disabled?: boolean }`. `select(value)` ignores disabled options. Toggle's props are otherwise unchanged.
- Note: `src/pages/statistics/index.astro` and `trivia/QuickSubtract.astro` also use `Toggle` and inherit the restyle. Check both visually in Task 11.

- [ ] **Step 1: Write the failing test.** Append inside `describe("toggleData", …)` in `toggle.data.test.ts`:

```ts
  describe("disabled options", () => {
    const withLocked: ToggleOption[] = [
      { value: "FIRST_TO", label: "First to" },
      { value: "BEST_OF", label: "Best of", disabled: true },
    ];

    it("ignores select() on a disabled option", () => {
      const { ctx } = harness({ options: withLocked });
      ctx.select("BEST_OF");
      expect(ctx.activeTab).toBe("FIRST_TO");
    });

    it("still selects an enabled option", () => {
      const { ctx } = harness({ options: withLocked, initial: "FIRST_TO" });
      ctx.select("FIRST_TO");
      expect(ctx.activeTab).toBe("FIRST_TO");
    });
  });
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/ui/toggle.data.test.ts`. Expected: FAIL, because `activeTab` becomes `"BEST_OF"`. A type error on `disabled` is also acceptable.

- [ ] **Step 3: Implement.**
  - In `app/src/modules/ui/types.ts`:

    ```ts
    export type ToggleOption = { value: string; label: string; disabled?: boolean };
    ```

  - In `toggle.data.ts`, replace `select`:

    ```ts
    select(this: ToggleDataContext, value: string) {
      if (this.options.find((o) => o.value === value)?.disabled) return;
      this.activeTab = value;
    },
    ```

- [ ] **Step 4:** Run the same test file. Expected: PASS.

- [ ] **Step 5: Restyle `Toggle.astro`.**
  - Local interface: `interface ToggleOption { value: string; label: string; disabled?: boolean; }`.
  - Styles block:

    ```ts
    const shellClass = cn(
      "relative grow w-full h-full inset-well p-1",
      orientation === "horizontal" ? "rounded-full" : "rounded-[26px]",
    );
    const listClass = "relative z-1 grid h-full w-full items-stretch gap-1";
    ```

  - Pill element class: `"pointer-events-none absolute left-0 top-0 z-0 rounded-full glass-blue transition-transform duration-500 ease-out"`.
  - Map items with `disabled={opt.disabled}` and `tall={orientation === "vertical"}`.
  - Hint block: `<div class="px-0.5 text-xs text-muted"><span x-text={`${hint}`} /></div>` (no italic).
  - JSDoc: add `options[].disabled` — "rendered dimmed, unclickable, `aria-disabled`".

- [ ] **Step 6: Restyle `ToggleListItem.astro`.**
  - Props: `value`, `label`, `disabled?: boolean`, `tall?: boolean`.
  - Markup:

    ```astro
    <li
      class={cn("min-w-0 w-full h-full rounded-full flex items-center justify-center", tall ? "min-h-11" : "min-h-10")}
      data-toggle-value={value}
      :class={`activeTab === '${value}' ? 'text-foreground' : 'text-muted-foreground'`}
      {...props}
    >
      <button
        type="button"
        class="w-full h-full px-2 text-[13px] font-semibold text-center whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        @click={`select('${value}')`}
      >
        {label}
      </button>
    </li>
    ```

  - Import `cn` from `@client/cn`.

- [ ] **Step 7:** Run `cd app && npx astro check && npm test -- tests/lib/ui/toggle.data.test.ts`. Expected: 0 errors, PASS.

- [ ] **Step 8: Commit.**

```bash
git add app/src/modules/ui/types.ts app/src/lib/ui/toggle.data.ts app/src/components/layout/games/setup/Toggle.astro app/src/components/layout/games/setup/ToggleListItem.astro app/tests/lib/ui/toggle.data.test.ts
git commit -m "feat(setup): toggle disabled options + design restyle"
```

---

### Task 2: Settings card — `SettingLabel`, `SettingSectionShell`, `Switch`

**Files:**
- Create: `app/src/components/layout/games/setup/SettingLabel.astro`
- Modify: `app/src/components/layout/games/setup/SettingSectionShell.astro`
- Modify: `app/src/components/forms/Switch.astro`
- Modify: `app/src/styles/global.css` (add `@utility setting-badge` after `glass-sheet`)

**Interfaces:**
- Produces: `<SettingLabel text="DIRECTION" badge?="ANALYTICS" />`. `Switch` keeps its props (`label`, `hint?`, `class?`, rest onto the input); `hint` now renders on its own line.

No unit test: markup only (D101). The gates and `astro check` verify it.

- [ ] **Step 1: Add the utility** to `global.css`:

```css
@utility setting-badge {
  @apply rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-accent-bright;
  background: var(--accent-muted);
}
```

- [ ] **Step 2: Create `SettingLabel.astro`.**

```astro
---
/**
 * Mono caps label above one setup control, with an optional chip
 * (e.g. `ANALYTICS` for capture-mode-only settings).
 * @param {string} text Label text, rendered as-is (pass caps)
 * @param {string} [badge] Chip text after the label
 * @param {string} [class] Extra classes
 */
interface Props {
  text: string;
  badge?: string;
  class?: string;
}

// Props
const { text, badge, class: classNameProp }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("flex items-center gap-2 px-0.5", classNameProp);
---

<div class={className}>
  <span class="font-mono text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
    {text}
  </span>
  {badge && <span class="setting-badge">{badge}</span>}
</div>
```

- [ ] **Step 3: Rewrite the `SettingSectionShell.astro` body.**

```astro
<div
  class="glass flex flex-col gap-4 rounded-2xl p-4"
  {...props}
>
  <h2 class="font-display text-[13px] tracking-[0.06em]">Settings</h2>
  <fieldset class="flex flex-col gap-4">
    <slot />
  </fieldset>
</div>
```

- [ ] **Step 4: Restyle `Switch.astro`.** The `<label>` wraps the text column first, then the track, so the switch sits on the right as in the design.

```ts
const className = cn("flex w-full items-center justify-between gap-3 pt-0.5 cursor-pointer", classNameProp);
const trackClass =
  "relative w-[38px] h-[22px] shrink-0 rounded-full bg-foreground/12 transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent-muted after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:size-[18px] after:rounded-full after:bg-foreground after:shadow-sm after:transition-transform after:duration-150 peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4";
```

```astro
<label class={className}>
  <span class="flex flex-col gap-0.5 select-none">
    <span class="text-sm font-semibold text-foreground">{label}</span>
    {hint && <span class="text-xs text-muted">{hint}</span>}
  </span>
  <input type="checkbox" class="sr-only peer" {...props} />
  <div class={trackClass}></div>
</label>
```

  Update the JSDoc: `hint` is "muted caption under the label".

- [ ] **Step 5:** Run `cd app && npx astro check && bash ../scripts/check-style-tokens.sh && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, OK.
  - If the `bg-foreground/12` opacity modifier is flagged, add `@utility switch-off { background: oklch(100% 0 0 / 0.12); }` and use `switch-off peer-checked:bg-accent`.

- [ ] **Step 6: Commit.**

```bash
git add app/src/components/layout/games/setup/SettingLabel.astro app/src/components/layout/games/setup/SettingSectionShell.astro app/src/components/forms/Switch.astro app/src/styles/global.css
git commit -m "feat(setup): settings card, mono labels, switch restyle"
```

---

### Task 3: `Stepper` primitive

**Files:**
- Create: `app/src/lib/ui/stepper.data.ts`
- Create: `app/src/components/forms/Stepper.astro`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`
- Test: `app/tests/lib/ui/stepper.data.test.ts`

**Interfaces:**
- Produces:
  - `stepValue(value: unknown, delta: number, min: number, max: number): number`
  - `stepperData(config: { min: number; max: number })`, registered as `"stepper"`, with `value`, `current()`, `step(delta)` and `onKey(event)`
  - `<Stepper min={1} max={20} ariaLabel="Legs to win" x-model="legsToWin" />`

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/ui/stepper.data.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { stepValue, stepperData } from "@lib/ui/stepper.data";

describe("stepValue", () => {
  it("adds the delta inside bounds", () => {
    expect(stepValue(3, 1, 1, 20)).toBe(4);
    expect(stepValue(3, -1, 1, 20)).toBe(2);
  });

  it("clamps at max and min", () => {
    expect(stepValue(20, 1, 1, 20)).toBe(20);
    expect(stepValue(1, -1, 1, 20)).toBe(1);
  });

  it("coerces numeric strings", () => {
    expect(stepValue("5", 1, 1, 20)).toBe(6);
  });

  it("treats null, empty and non-numeric as min", () => {
    expect(stepValue(null, 0, 1, 20)).toBe(1);
    expect(stepValue("", 0, 1, 20)).toBe(1);
    expect(stepValue("abc", 1, 1, 20)).toBe(2);
  });

  it("clamps an out-of-range start with zero delta", () => {
    expect(stepValue(99, 0, 1, 20)).toBe(20);
  });
});

describe("stepperData", () => {
  const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

  it("current() reflects a string model as a clamped number", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = "7";
    expect(ctx.current()).toBe(7);
  });

  it("step() writes a number back to value", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = null;
    ctx.step(1);
    expect(ctx.value).toBe(2);
  });

  it("ArrowUp and ArrowDown step and prevent default", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = 5;
    const up = key("ArrowUp");
    ctx.onKey(up);
    expect(ctx.value).toBe(6);
    expect(up.preventDefault).toHaveBeenCalled();
    ctx.onKey(key("ArrowDown"));
    expect(ctx.value).toBe(5);
  });

  it("ignores other keys", () => {
    const ctx = stepperData({ min: 1, max: 20 });
    ctx.value = 5;
    const other = key("a");
    ctx.onKey(other);
    expect(ctx.value).toBe(5);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/ui/stepper.data.test.ts`. Expected: FAIL (cannot resolve `@lib/ui/stepper.data`).

- [ ] **Step 3: Implement** `app/src/lib/ui/stepper.data.ts`:

```ts
type StepperConfig = { min: number; max: number };
type StepperKey = Pick<KeyboardEvent, "key" | "preventDefault">;

/**
 * Clamps `value + delta` into `[min, max]`. Numeric strings are coerced;
 * null, empty or non-numeric input counts as `min`.
 */
export function stepValue(
  value: unknown,
  delta: number,
  min: number,
  max: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  const base = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, base + delta));
}

/**
 * Alpine factory for `Stepper.astro`. `value` is the `x-modelable` slot, so
 * it may hold whatever the parent bound (string, null); `current()` is the
 * clamped number the UI shows.
 */
export function stepperData(config: StepperConfig) {
  const { min, max } = config;
  return {
    value: min as unknown,
    min,
    max,
    current(): number {
      return stepValue(this.value, 0, min, max);
    },
    step(delta: number) {
      this.value = stepValue(this.value, delta, min, max);
    },
    onKey(event: StepperKey) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      this.step(event.key === "ArrowUp" ? 1 : -1);
    },
  };
}
```

- [ ] **Step 4:** Run the test file. Expected: PASS.

- [ ] **Step 5: Register** in `register-ui-data.ts`: `import { stepperData } from "@lib/ui/stepper.data";` and `Alpine.data("stepper", stepperData);`.

- [ ] **Step 6: Create `app/src/components/forms/Stepper.astro`.**

```astro
---
/**
 * Vertical glass stepper: up chevron, mono value, down chevron. Bind the
 * value from a parent scope with `x-model`; exposed through
 * `x-modelable="value"`. The value is a spinbutton (Arrow Up/Down step).
 * @param {number} min
 * @param {number} max
 * @param {string} ariaLabel Accessible name of the spinbutton
 * @param {string} [class] Extra classes
 */
interface Props {
  min: number;
  max: number;
  ariaLabel: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const { min, max, ariaLabel, class: classNameProp, ...props }: Props =
  Astro.props;

// Lib
import { cn } from "@client/cn";

// Icons
import ChevronDownIcon from "@icons/chevron-down.svg";

// Data
const config = { min, max };

// Styles
const className = cn(
  "glass-button flex w-16 flex-col items-center gap-0.5 rounded-full py-1.5",
  classNameProp,
);
const buttonClass =
  "flex h-8 w-11 items-center justify-center rounded-full text-muted-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-30";
---

<div
  class={className}
  x-data={`stepper(${JSON.stringify(config)})`}
  x-modelable="value"
  {...props}
>
  <button
    type="button"
    class={buttonClass}
    aria-label="Increase"
    :disabled="current() >= max"
    @click="step(1)"
  >
    <ChevronDownIcon class="size-5.5 rotate-180" />
  </button>
  <span
    role="spinbutton"
    tabindex="0"
    aria-label={ariaLabel}
    aria-valuemin={min}
    aria-valuemax={max}
    :aria-valuenow="current()"
    class="py-1 font-mono text-[32px] leading-none text-foreground"
    x-text="current()"
    @keydown="onKey($event)"
  ></span>
  <button
    type="button"
    class={buttonClass}
    aria-label="Decrease"
    :disabled="current() <= min"
    @click="step(-1)"
  >
    <ChevronDownIcon class="size-5.5" />
  </button>
</div>
```

- [ ] **Step 7:** Run `cd app && npx astro check && npm test -- tests/lib/ui/stepper.data.test.ts`. Expected: 0 errors, PASS.

- [ ] **Step 8: Commit.**

```bash
git add app/src/lib/ui/stepper.data.ts app/src/components/forms/Stepper.astro app/src/lib/client/alpine/register-ui-data.ts app/tests/lib/ui/stepper.data.test.ts
git commit -m "feat(ui): stepper primitive"
```

---

### Task 4: `RangeSlider` primitive

**Files:**
- Create: `app/src/lib/ui/range-slider.data.ts`
- Create: `app/src/components/forms/RangeSlider.astro`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`
- Modify: `app/src/styles/global.css` (utilities `slider-fill`, `slider-thumb`, `slider-bubble`)
- Test: `app/tests/lib/ui/range-slider.data.test.ts`

**Interfaces:**
- Consumes: `SettingLabel` (Task 2).
- Produces:
  - `MAX_TICKS = 25`
  - `valueToFraction(value, min, max): number`
  - `normaliseSliderValue(raw: unknown, min, max, fallback?): number`
  - `type SliderTick = { fraction: number; major: boolean }`
  - `tickFractions(min, max): SliderTick[]`
  - `rangeSliderData(config: { min: number; max: number; fallback?: number })`, registered as `"rangeSlider"`, with `value`, `ticks`, `init()`, `current()`, `fraction()`, `position()` and `onInput(raw)`
  - `<RangeSlider min max label ariaLabel fallback? hint? x-model="durationValue" />`

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/ui/range-slider.data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_TICKS,
  normaliseSliderValue,
  rangeSliderData,
  tickFractions,
  valueToFraction,
} from "@lib/ui/range-slider.data";

describe("valueToFraction", () => {
  it("maps min, mid, max to 0, 0.5, 1", () => {
    expect(valueToFraction(5, 5, 30)).toBe(0);
    expect(valueToFraction(17.5, 5, 30)).toBe(0.5);
    expect(valueToFraction(30, 5, 30)).toBe(1);
  });

  it("clamps out-of-range values", () => {
    expect(valueToFraction(0, 5, 30)).toBe(0);
    expect(valueToFraction(99, 5, 30)).toBe(1);
  });

  it("is 0 for a degenerate range", () => {
    expect(valueToFraction(3, 3, 3)).toBe(0);
  });
});

describe("normaliseSliderValue", () => {
  it("keeps an in-range number", () => {
    expect(normaliseSliderValue(12, 1, 50)).toBe(12);
  });

  it("coerces numeric strings and clamps", () => {
    expect(normaliseSliderValue("12", 1, 50)).toBe(12);
    expect(normaliseSliderValue("80", 1, 50)).toBe(50);
  });

  it("uses fallback for null, empty or garbage", () => {
    expect(normaliseSliderValue(null, 3, 30, 10)).toBe(10);
    expect(normaliseSliderValue("", 3, 30, 10)).toBe(10);
    expect(normaliseSliderValue("x", 3, 30, 10)).toBe(10);
  });

  it("defaults fallback to min", () => {
    expect(normaliseSliderValue(undefined, 3, 30)).toBe(3);
  });
});

describe("tickFractions", () => {
  it("matches design 6a for 5–30: one tick per value, major every 5", () => {
    const ticks = tickFractions(5, 30);
    expect(ticks).toHaveLength(24);
    expect(ticks[0]).toEqual({ fraction: 0.04, major: false });
    expect(ticks[4]).toEqual({ fraction: 0.2, major: true });
  });

  it("caps tick count for wide ranges", () => {
    expect(tickFractions(1, 100).length).toBeLessThanOrEqual(MAX_TICKS);
  });

  it("excludes the endpoints", () => {
    const ticks = tickFractions(3, 30);
    expect(ticks.every((t) => t.fraction > 0 && t.fraction < 1)).toBe(true);
  });

  it("is empty for a degenerate range", () => {
    expect(tickFractions(3, 3)).toEqual([]);
  });
});

describe("rangeSliderData", () => {
  function harness(config: Parameters<typeof rangeSliderData>[0]) {
    const ticks: Array<() => void> = [];
    const ctx = Object.assign(rangeSliderData(config), {
      $nextTick(cb: () => void) {
        ticks.push(cb);
      },
    });
    return { ctx, flush: () => ticks.forEach((cb) => cb()) };
  }

  it("writes a normalised number back after the model binds", () => {
    const { ctx, flush } = harness({ min: 3, max: 30, fallback: 10 });
    ctx.init();
    ctx.value = null;
    flush();
    expect(ctx.value).toBe(10);
  });

  it("leaves an already-valid number untouched", () => {
    const { ctx, flush } = harness({ min: 1, max: 50 });
    ctx.init();
    ctx.value = 12;
    flush();
    expect(ctx.value).toBe(12);
  });

  it("onInput stores a number from the native input string", () => {
    const { ctx } = harness({ min: 1, max: 50 });
    ctx.onInput("23");
    expect(ctx.value).toBe(23);
  });

  it("position() is the inset calc for the current fraction", () => {
    const { ctx } = harness({ min: 5, max: 30 });
    ctx.value = 10;
    expect(ctx.position()).toBe("calc(12px + (100% - 24px) * 0.2)");
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/ui/range-slider.data.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `app/src/lib/ui/range-slider.data.ts`:

```ts
type RangeSliderConfig = { min: number; max: number; fallback?: number };

export type SliderTick = { fraction: number; major: boolean };

/** Upper bound on rendered minor+major ticks, so 1–100 stays readable. */
export const MAX_TICKS = 25;

/** Position of `value` along `[min, max]` as 0–1, clamped. */
export function valueToFraction(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Coerces a bound model value (number, numeric string, null) to an integer
 * in `[min, max]`; unusable input becomes `fallback` (default `min`).
 */
export function normaliseSliderValue(
  raw: unknown,
  min: number,
  max: number,
  fallback: number = min,
): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  const base = Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, base));
}

/**
 * Tick marks strictly between `min` and `max`. Stride grows so the count
 * stays ≤ `MAX_TICKS`; every 5th stride is major.
 */
export function tickFractions(min: number, max: number): SliderTick[] {
  const span = max - min;
  if (span <= 0) return [];
  const stride = Math.max(1, Math.ceil(span / MAX_TICKS));
  const ticks: SliderTick[] = [];
  for (let step = 1; min + step * stride < max; step++) {
    ticks.push({
      fraction: Math.round(((step * stride) / span) * 1e4) / 1e4,
      major: step % 5 === 0,
    });
  }
  return ticks;
}

/**
 * Alpine factory for `RangeSlider.astro`. `value` is the `x-modelable` slot;
 * once the parent binding lands (`$nextTick`), a non-number or out-of-range
 * model is rewritten to its normalised number so `start()` sees what the
 * slider shows.
 */
export function rangeSliderData(config: RangeSliderConfig) {
  const { min, max } = config;
  const fallback = config.fallback ?? min;
  return {
    value: null as unknown,
    min,
    max,
    ticks: tickFractions(min, max),
    init(this: { value: unknown; $nextTick(cb: () => void): void }) {
      this.$nextTick(() => {
        const next = normaliseSliderValue(this.value, min, max, fallback);
        if (next !== this.value) this.value = next;
      });
    },
    current(): number {
      return normaliseSliderValue(this.value, min, max, fallback);
    },
    fraction(): number {
      return valueToFraction(this.current(), min, max);
    },
    position(): string {
      return `calc(12px + (100% - 24px) * ${this.fraction()})`;
    },
    onInput(raw: string) {
      this.value = normaliseSliderValue(raw, min, max, fallback);
    },
  };
}
```

  Check the first test: for 5–30, ticks[0] is (1/25) = 0.04 and ticks[4] is 5/25 = 0.2 with step 5, so major. The count is 24 (steps 1–24). This matches design 6a.

- [ ] **Step 4:** Run the test file. Expected: PASS.

- [ ] **Step 5: Add the utilities** to `global.css`:

```css
@utility slider-fill {
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--accent) 30%, transparent),
    var(--accent)
  );
}

@utility slider-thumb {
  background: var(--foreground);
  box-shadow:
    0 0 0 3px color-mix(in oklch, var(--accent) 35%, transparent),
    0 2px 8px oklch(0% 0 0 / 0.4);
}

@utility slider-bubble {
  @apply border-x-0 border-y backdrop-blur-sm;
  background: radial-gradient(
    at 50% 0%,
    color-mix(in oklch, var(--accent) 35%, transparent),
    oklch(40% 0.12 240 / 0.55) 85%
  );
  border-top-color: color-mix(in oklch, var(--accent-bright) 50%, transparent);
  border-bottom-color: color-mix(in oklch, var(--accent) 30%, transparent);
}
```

  If `--foreground` is not white, use `oklch(100% 0 0)` in `slider-thumb`.

- [ ] **Step 6: Register** `rangeSliderData` as `"rangeSlider"` in `register-ui-data.ts`.

- [ ] **Step 7: Create `app/src/components/forms/RangeSlider.astro`.**

```astro
---
/**
 * Bounded integer slider (design 6a): mono label, value bubble over a
 * capsule thumb, filled well track, ticks, min/max labels. A transparent
 * native `input[type=range]` on top supplies drag, keyboard and a11y. Bind
 * with `x-model`; exposed through `x-modelable="value"`. Non-number models
 * are normalised and written back on mount.
 * @param {number} min
 * @param {number} max
 * @param {string} label Mono caps label (e.g. "ROUNDS")
 * @param {string} ariaLabel Accessible name of the range input
 * @param {number} [fallback] Shown and written when the model is unusable; default `min`
 * @param {string} [hint] Muted caption under the control
 * @param {string} [class] Extra classes
 */
interface Props {
  min: number;
  max: number;
  label: string;
  ariaLabel: string;
  fallback?: number;
  hint?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  min,
  max,
  label,
  ariaLabel,
  fallback,
  hint,
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Components
import SettingLabel from "@components/layout/games/setup/SettingLabel.astro";

// Lib
import { cn } from "@client/cn";

// Data
const config = { min, max, fallback: fallback ?? min };

// Styles
const className = cn("flex flex-col gap-2", classNameProp);
---

<div
  class={className}
  x-data={`rangeSlider(${JSON.stringify(config)})`}
  x-modelable="value"
  {...props}
>
  <SettingLabel text={label} />
  <div class="relative h-[30px]">
    <span
      class="slider-bubble absolute bottom-0.5 flex h-7 min-w-10 -translate-x-1/2 items-center justify-center rounded-full px-2.5 font-mono text-sm text-foreground"
      :style="`left:${position()}`"
      x-text="current()"
    ></span>
  </div>
  <div class="relative flex h-8 items-center">
    <div class="inset-well absolute inset-x-3 h-2 rounded-full">
      <div
        class="slider-fill h-full rounded-full"
        :style="`width:${fraction() * 100}%`"
      ></div>
    </div>
    <span
      class="slider-thumb pointer-events-none absolute h-[22px] w-9 -translate-x-1/2 rounded-full"
      :style="`left:${position()}`"
    ></span>
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      aria-label={ariaLabel}
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      :value="current()"
      @input="onInput($event.target.value)"
    />
  </div>
  <div class="relative h-3.5 font-mono text-[11px] text-muted">
    <span class="absolute left-1 top-0">{min}</span>
    <div class="absolute inset-x-0 top-1 h-1.5">
      <template x-for="tick in ticks">
        <span
          class="absolute w-px -translate-x-1/2"
          :class="tick.major ? 'h-1.5 bg-foreground/35' : 'h-1 bg-foreground/20'"
          :style="`left:calc(12px + (100% - 24px) * ${tick.fraction})`"
        ></span>
      </template>
    </div>
    <span class="absolute right-0 top-0">{max}</span>
  </div>
  {hint && <p class="px-0.5 text-xs text-muted">{hint}</p>}
</div>
```

  If the style gate flags `bg-foreground/35` or `/20`, add `@utility tick-major` / `tick-minor` with `oklch(100% 0 0 / 0.35|0.2)` and use those instead.

- [ ] **Step 8:** Run `cd app && npx astro check && npm test -- tests/lib/ui/range-slider.data.test.ts && bash ../scripts/check-style-tokens.sh`. Expected: 0 errors, PASS, OK.

- [ ] **Step 9: Commit.**

```bash
git add app/src/lib/ui/range-slider.data.ts app/src/components/forms/RangeSlider.astro app/src/lib/client/alpine/register-ui-data.ts app/src/styles/global.css app/tests/lib/ui/range-slider.data.test.ts
git commit -m "feat(ui): range slider primitive"
```

---

### Task 5: `SlideToStart` primitive + `SetupShell`

**Files:**
- Create: `app/src/lib/ui/slide-to-start.data.ts`
- Create: `app/src/components/forms/SlideToStart.astro`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`
- Modify: `app/src/styles/global.css` (`slide-thumb`, `slide-fill`, `start-bar-fade`)
- Modify: `app/src/components/layout/games/setup/SetupShell.astro`
- Test: `app/tests/lib/ui/slide-to-start.data.test.ts`

**Interfaces:**
- Produces:
  - `SLIDE_THRESHOLD = 0.85`, `SLIDE_THUMB_SPAN = 60`, `SLIDE_RESET_MS = 600`
  - `dragFraction(dx, travel): number`
  - `shouldFire(fraction): boolean`
  - `slideToStartData()`, registered as `"slideToStart"`, with `fraction`, `dragging`, `fired`, `disabled`, `init()`, `begin(e)`, `move(e)`, `end()`, `onKey(e)`, `fire()` and `reset()`
  - `<SlideToStart disabledExpr="loading || loadingReconciliation" />`, placed inside a `<form>`

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/ui/slide-to-start.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SLIDE_RESET_MS,
  SLIDE_THRESHOLD,
  dragFraction,
  shouldFire,
  slideToStartData,
} from "@lib/ui/slide-to-start.data";

describe("dragFraction / shouldFire", () => {
  it("clamps to 0–1", () => {
    expect(dragFraction(-20, 300)).toBe(0);
    expect(dragFraction(150, 300)).toBe(0.5);
    expect(dragFraction(900, 300)).toBe(1);
  });

  it("is 0 when there is no travel", () => {
    expect(dragFraction(50, 0)).toBe(0);
  });

  it("fires at the threshold, not below", () => {
    expect(SLIDE_THRESHOLD).toBe(0.85);
    expect(shouldFire(0.84)).toBe(false);
    expect(shouldFire(0.85)).toBe(true);
  });
});

describe("slideToStartData", () => {
  let requestSubmit: ReturnType<typeof vi.fn>;

  function harness() {
    requestSubmit = vi.fn();
    const watchers: Record<string, (v: boolean) => void> = {};
    const ctx = Object.assign(slideToStartData(), {
      $refs: { track: { clientWidth: 360 } as HTMLElement },
      $root: { closest: () => ({ requestSubmit }) } as unknown as HTMLElement,
      $watch(key: string, cb: (v: boolean) => void) {
        watchers[key] = cb;
      },
    });
    ctx.init();
    return { ctx, watchers };
  }

  const pointer = (clientX: number) => ({
    clientX,
    pointerId: 1,
    currentTarget: null,
  });
  const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a full drag fires once and parks at the end", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.move(pointer(10 + 300));
    ctx.end();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(ctx.fraction).toBe(1);
    expect(ctx.fired).toBe(true);
  });

  it("a short drag snaps back without firing", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.move(pointer(10 + 200));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(ctx.fraction).toBe(0);
  });

  it("a tap does not fire", () => {
    const { ctx } = harness();
    ctx.begin(pointer(10));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it("Enter and Space fire; other keys do not", () => {
    const { ctx } = harness();
    ctx.onKey(key("a"));
    expect(requestSubmit).not.toHaveBeenCalled();
    const enter = key("Enter");
    ctx.onKey(enter);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    const { ctx: ctx2 } = harness();
    ctx2.onKey(key(" "));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not fire twice while fired", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    ctx.onKey(key("Enter"));
    ctx.begin(pointer(10));
    ctx.move(pointer(400));
    ctx.end();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("ignores pointer and keys while disabled", () => {
    const { ctx } = harness();
    ctx.disabled = true;
    ctx.onKey(key("Enter"));
    ctx.begin(pointer(10));
    ctx.move(pointer(400));
    ctx.end();
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(ctx.fraction).toBe(0);
  });

  it("resets when disabled turns false after firing (start() failed)", () => {
    const { ctx, watchers } = harness();
    ctx.onKey(key("Enter"));
    ctx.disabled = true;
    watchers.disabled(true);
    ctx.disabled = false;
    watchers.disabled(false);
    expect(ctx.fired).toBe(false);
    expect(ctx.fraction).toBe(0);
  });

  it("resets after SLIDE_RESET_MS when start() never set loading", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    vi.advanceTimersByTime(SLIDE_RESET_MS);
    expect(ctx.fired).toBe(false);
    expect(ctx.fraction).toBe(0);
  });

  it("stays fired past the timeout while still disabled (loading)", () => {
    const { ctx } = harness();
    ctx.onKey(key("Enter"));
    ctx.disabled = true;
    vi.advanceTimersByTime(SLIDE_RESET_MS);
    expect(ctx.fired).toBe(true);
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/ui/slide-to-start.data.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `app/src/lib/ui/slide-to-start.data.ts`:

```ts
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
```

- [ ] **Step 4:** Run the test file. Expected: PASS.

- [ ] **Step 5: Register** `slideToStartData` as `"slideToStart"` in `register-ui-data.ts`.

- [ ] **Step 6: Add the utilities** to `global.css`:

```css
@utility slide-thumb {
  @apply border-t border-white/35;
  background: linear-gradient(138deg, var(--accent) 10%, oklch(42% 0.13 242) 90%);
  box-shadow: 0 0 20px 2px color-mix(in oklch, var(--accent) 40%, transparent);
}

@utility slide-fill {
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--accent) 11%, transparent),
    color-mix(in oklch, var(--accent) 32%, transparent) 55%,
    color-mix(in oklch, var(--accent) 47%, transparent)
  );
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.12);
}

@utility start-bar-fade {
  background: linear-gradient(180deg, transparent, oklch(0% 0 0 / 0.85) 45%);
}
```

- [ ] **Step 7: Create `app/src/components/forms/SlideToStart.astro`.** It must sit inside a `<form>`. It is fixed 8px above `BottomNav` (whose bottom offset is `max(0.5rem, env(safe-area-inset-bottom) - 0.5rem)` and which is about 70px tall).

```astro
---
/**
 * Slide-to-start control (design 4d/4e). Drag the thumb past 85% or press
 * Enter/Space to submit the enclosing form; an earlier release snaps back.
 * Fixed just above `BottomNav`.
 * @param {string} disabledExpr Alpine expression; while true, input is ignored
 * @param {string} [label="Slide to start"]
 * @param {string} [class] Extra classes
 */
interface Props {
  disabledExpr: string;
  label?: string;
  class?: string;
}

// Props
const {
  disabledExpr,
  label = "Slide to start",
  class: classNameProp,
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Icons
import PlayRoundedIcon from "@icons/play-rounded.svg";

// Styles
const className = cn(
  "fixed inset-x-4 z-30 mx-auto max-w-lg bottom-[calc(max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))+4.875rem)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-muted rounded-full",
  classNameProp,
);
---

<div
  class={className}
  x-data="slideToStart()"
  x-effect={`disabled = Boolean(${disabledExpr})`}
  role="button"
  tabindex="0"
  aria-label="Slide to start game"
  :aria-disabled="disabled ? 'true' : 'false'"
  @keydown="onKey($event)"
>
  <div
    x-ref="track"
    class="glass-button relative flex h-15 items-center justify-center overflow-hidden rounded-full transition-opacity"
    :class="disabled && !fired ? 'opacity-50' : ''"
  >
    <span
      class="slide-fill absolute inset-y-0 left-0 rounded-full"
      x-show="fraction > 0"
      x-cloak
      :style="`width:calc(${fraction} * (100% - 60px) + 55px)`"
    ></span>
    <span class="relative text-sm font-semibold tracking-[0.02em] text-soft-foreground">
      {label}
    </span>
    <span
      class="slide-thumb absolute top-[5px] flex size-[50px] touch-none items-center justify-center rounded-full motion-safe:transition-[left,transform] motion-safe:duration-200"
      :class="dragging ? 'transition-none scale-[1.06]' : ''"
      :style="`left:calc(5px + (100% - 60px) * ${fraction})`"
      @pointerdown="begin($event)"
      @pointermove="move($event)"
      @pointerup="end()"
      @pointercancel="end()"
    >
      <PlayRoundedIcon class="size-5 text-foreground" />
    </span>
  </div>
</div>
```

- [ ] **Step 8: Rewrite the `SetupShell.astro` template.**
  - Replace the `Button` import with `import SlideToStart from "@components/forms/SlideToStart.astro";`.
  - Update the JSDoc: "start is a slide gesture (`SlideToStart`), disabled while `loading || loadingReconciliation`".

```astro
<div {...props}>
  <header class="grid grid-cols-[40px_1fr_40px] items-center pt-3 pb-2">
    <a
      href="/games"
      aria-label="Back to games"
      class="glass-button flex size-10 items-center justify-center rounded-full"
    >
      <ChevronDownIcon class="size-5.5 rotate-90 text-muted-foreground" />
    </a>
    <h2 class="text-center font-display text-lg tracking-[0.02em] text-foreground">
      {title}
    </h2>
    <span></span>
  </header>

  <form
    class="mt-1 flex max-w-sm flex-col gap-3 pb-28"
    @submit.prevent="start()"
  >
    <slot />

    <ErrorAlert class="mt-2" />

    <div
      aria-hidden="true"
      class="start-bar-fade pointer-events-none fixed inset-x-0 bottom-0 z-20 h-50"
    ></div>
    <SlideToStart disabledExpr="loading || loadingReconciliation" />
  </form>
</div>
```

  The back control changes from a `Button` with `@click` to an `<a href>`: same target, and native navigation.

- [ ] **Step 9:** Run `cd app && npx astro check && npm test && bash ../scripts/check-style-tokens.sh && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, all PASS, OK.
  - If the style gate rejects `fixed` outside `Modal.astro` for the fade, move the fade into `SlideToStart.astro` as a sibling wrapper and re-run.

- [ ] **Step 10: Commit.**

```bash
git add app/src/lib/ui/slide-to-start.data.ts app/src/components/forms/SlideToStart.astro app/src/lib/client/alpine/register-ui-data.ts app/src/styles/global.css app/src/components/layout/games/setup/SetupShell.astro app/tests/lib/ui/slide-to-start.data.test.ts
git commit -m "feat(setup): slide-to-start and redesigned setup header"
```

---

### Task 6: Players card — initials avatars, count, add opponent

**Files:**
- Create: `app/src/lib/ui/initials.ts`
- Modify: `app/src/lib/client/alpine/` (expose `initialsOf` as an Alpine magic or global; see Step 5)
- Modify: `app/src/components/layout/games/setup/UserSection.astro`
- Modify: `app/src/components/layout/games/setup/UserIconDisplay.astro`
- Modify: `app/src/components/layout/games/setup/GuestSection.astro`
- Modify: `app/src/components/layout/games/setup/AddGuestButton.astro`
- Test: `app/tests/lib/ui/initials.test.ts`

**Interfaces:**
- Produces:
  - `initialsOf(name: string | null | undefined): string`
  - `playerCountLabel(count: number): string` (`"1 PLAYER"` / `"2 PLAYERS"`)
  - Alpine magics `$initials(name)` and `$playerCount(n)`

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/ui/initials.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { initialsOf, playerCountLabel } from "@lib/ui/initials";

describe("initialsOf", () => {
  it("takes first and last word initials", () => {
    expect(initialsOf("Levi Broeksma")).toBe("LB");
    expect(initialsOf("anna van der berg")).toBe("AB");
  });

  it("uses one letter for a single word", () => {
    expect(initialsOf("Levi")).toBe("L");
  });

  it("trims and collapses whitespace", () => {
    expect(initialsOf("  jo   smith ")).toBe("JS");
  });

  it("falls back to ? for empty input", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });
});

describe("playerCountLabel", () => {
  it("pluralises", () => {
    expect(playerCountLabel(1)).toBe("1 PLAYER");
    expect(playerCountLabel(2)).toBe("2 PLAYERS");
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/ui/initials.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `app/src/lib/ui/initials.ts`:

```ts
/**
 * Avatar initials: first letter of the first and last word, uppercased;
 * one letter for a single word; `?` when empty.
 */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** Mono caps seat count for the Players card header. */
export function playerCountLabel(count: number): string {
  return `${count} PLAYER${count === 1 ? "" : "S"}`;
}
```

- [ ] **Step 4:** Run the test file. Expected: PASS.

- [ ] **Step 5: Expose to templates.**
  - Find where Alpine magics/stores are registered: `grep -rn "Alpine.magic\|Alpine.store(" app/src/lib/client/alpine`.
  - If a magics registrar exists, add:

    ```ts
    Alpine.magic("initials", () => initialsOf);
    Alpine.magic("playerCount", () => playerCountLabel);
    ```

  - If there is none, add both lines to `registerUiData` (same file as Tasks 3–5).

- [ ] **Step 6: Rewrite `UserIconDisplay.astro`** (same props). Add a prop `initialsExpr?: string`, defaulting to `` `$initials(${nameExpr ?? `'${name}'`})` ``.

```astro
<div class="flex flex-col items-center gap-1.5">
  <div
    class="glass-blue flex size-13 items-center justify-center rounded-full font-display text-base text-foreground"
    x-text={initialsExpr}
  ></div>
  <span class="text-xs font-semibold text-foreground" x-text={nameExpr}>
    {name}
  </span>
</div>
```

  Drop the `UserIcon` import.

- [ ] **Step 7: Rewrite the `UserSection.astro` card.**

```astro
<div class="glass flex flex-col gap-3.5 rounded-2xl p-4">
  <div class="flex items-baseline justify-between">
    <h2 class="font-display text-[13px] tracking-[0.06em]">Players</h2>
    <span
      class="font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground"
      x-text="$playerCount(1 + guests.length + (bot ? 1 : 0))"
    ></span>
  </div>
  <div class="flex flex-row items-start gap-[18px]">
    <UserIconDisplay
      name="User"
      nameExpr="$store.profile.displayName || 'User'"
    />
    {allowGuests && <GuestSection allowDartbot={allowDartbot} />}
  </div>
</div>
```

  Every setup factory spreads the controller, so `guests` and `bot` are always in scope. Confirm with `grep -n "guests:" app/src/lib/game/setup-controller.ts`.

- [ ] **Step 8: Update `GuestSection.astro`.**
  - Guest avatar: replace the inner avatar block with `<UserIconDisplay name="Guest" nameExpr="g.displayName" />` (import it). Keep the remove `IconBtn`, with class `absolute -top-1 -right-1 p-0.5 glass-button rounded-full text-foreground flex justify-center items-center`.
  - Bot avatar: a `glass-blue size-13 rounded-full` circle holding `<TargetIcon class="size-6 text-foreground" />`, with the name "DartBot" in `text-xs font-semibold`.
  - Drop the unused `UserIcon` import.

- [ ] **Step 9: Update `AddGuestButton.astro`.**

```astro
<div
  class="flex flex-col items-center gap-1.5"
  x-show="guests.length < 1 && !bot"
  x-cloak
>
  <IconBtn
    type="button"
    variant="dashed"
    ariaLabel="Add opponent"
    @click={allowDartbot ? "showOpponentChooser = true" : "showAddGuestModal = true"}
    class="flex size-13 items-center justify-center rounded-full border-[1.5px]"
  >
    <PlusIcon class="size-5 opacity-80" />
  </IconBtn>
  <span class="text-xs text-muted">Add opponent</span>
</div>
```

  If the `dashed` variant's border colour is not white/35, keep the variant; it is the existing token.

- [ ] **Step 10:** Run `cd app && npx astro check && npm test && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, PASS, OK.

- [ ] **Step 11: Commit.**

```bash
git add app/src/lib/ui/initials.ts app/tests/lib/ui/initials.test.ts app/src/lib/client/alpine app/src/components/layout/games/setup/UserSection.astro app/src/components/layout/games/setup/UserIconDisplay.astro app/src/components/layout/games/setup/GuestSection.astro app/src/components/layout/games/setup/AddGuestButton.astro
git commit -m "feat(setup): players card with initials avatars and seat count"
```

---

### Task 7: Rules card — `InfoSection` restyle + `open`

**Files:**
- Modify: `app/src/components/ui/InfoSection.astro`
- Modify: `app/src/components/layout/games/setup/Bobs27SetupForm.astro`, `CricketSetupForm.astro`, `TacticsSetupForm.astro` (add `open`)

**Interfaces:**
- Produces: `InfoSection` props `title`, `description`, `id?`, `open?: boolean`.

- [ ] **Step 1: Rewrite `InfoSection.astro`.**
  - Props: add `open?: boolean`, default `false`.
  - Remove the `InfoIcon` import.
  - JSDoc: add "`open`: always expanded, no chevron, not interactive (setups without settings)".

```astro
{
  open ? (
    <div class="glass-info flex flex-col gap-2 rounded-2xl px-4 py-3.5">
      <h4 id={id} class="text-[13px] font-semibold text-accent-bright">{title}</h4>
      <p class="text-xs leading-[1.55] text-muted text-pretty">{description}</p>
    </div>
  ) : (
    <div
      x-data="{ expanded: false }"
      class="glass-info flex flex-col gap-2 rounded-2xl px-4 py-3.5"
    >
      <button
        type="button"
        @click="expanded = ! expanded"
        :aria-expanded="expanded ? 'true' : 'false'"
        class="flex w-full items-center justify-between"
      >
        <h4 id={id} class="text-[13px] font-semibold text-accent-bright">{title}</h4>
        <ChevronDownIcon
          class="size-[18px] text-muted-foreground transition-transform duration-300"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>
      <p
        class="text-xs leading-[1.55] text-muted text-pretty"
        :class="expanded ? '' : 'line-clamp-2'"
      >
        {description}
      </p>
    </div>
  )
}
```

  `x-collapse` is dropped: the text is always visible, so only the clamp toggles.

- [ ] **Step 2:** Add `open` to the `<InfoSection …>` in `Bobs27SetupForm.astro`, `CricketSetupForm.astro` and `TacticsSetupForm.astro`.

- [ ] **Step 3:** Run `cd app && npx astro check && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, OK.

- [ ] **Step 4: Commit.**

```bash
git add app/src/components/ui/InfoSection.astro app/src/components/layout/games/setup/Bobs27SetupForm.astro app/src/components/layout/games/setup/CricketSetupForm.astro app/src/components/layout/games/setup/TacticsSetupForm.astro
git commit -m "feat(setup): accent rules card, clamp-to-expand, open variant"
```

---

### Task 8: 501 form — match format grid

**Files:**
- Modify: `app/src/lib/game/five-oh-one-legs.ts:6` (export `FIVE_OH_ONE_LEGS_MAX`)
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`
- Test: `app/tests/lib/game/five-oh-one-legs.test.ts` (create it if it is absent; otherwise append)

**Interfaces:**
- Consumes: `Toggle` with `disabled` options (Task 1), `SettingLabel` (Task 2), `Stepper` (Task 3).

- [ ] **Step 1: Write the failing test.** It pins the exported bound the Stepper relies on:

```ts
import { describe, it, expect } from "vitest";
import {
  FIVE_OH_ONE_LEGS_MAX,
  FIVE_OH_ONE_LEGS_MIN,
  clampFiveOhOneLegs,
} from "@lib/game/five-oh-one-legs";

describe("501 legs bounds export", () => {
  it("exports the bounds clampFiveOhOneLegs enforces", () => {
    expect(FIVE_OH_ONE_LEGS_MIN).toBe(1);
    expect(FIVE_OH_ONE_LEGS_MAX).toBe(20);
    expect(clampFiveOhOneLegs(FIVE_OH_ONE_LEGS_MAX + 1).value).toBe(
      FIVE_OH_ONE_LEGS_MAX,
    );
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/game/five-oh-one-legs.test.ts`. Expected: FAIL (`FIVE_OH_ONE_LEGS_MAX` is not exported, so it is undefined).

- [ ] **Step 3:** Change `const FIVE_OH_ONE_LEGS_MAX = 20;` to `export const FIVE_OH_ONE_LEGS_MAX = 20;`. Run again. Expected: PASS.

- [ ] **Step 4: Rewrite the `FiveOhOneSetupForm.astro` settings.**
  - Imports: drop nothing. Add `SettingLabel`, `Stepper` (`@components/forms/Stepper.astro`), and `{ FIVE_OH_ONE_LEGS_MIN, FIVE_OH_ONE_LEGS_MAX }` from `@lib/game/five-oh-one-legs`.
  - Data:

```ts
const matchFormatOpts = [
  { value: "FIRST_TO", label: "First to" },
  { value: "BEST_OF", label: "Best of", disabled: true },
];
const matchUnitOpts = [
  { value: "LEGS", label: "Legs" },
  { value: "SETS", label: "Sets", disabled: true },
];
```

  Settings card body:

```astro
  <SettingSectionShell>
    <div class="flex flex-col gap-2">
      <SettingLabel text="STARTING SCORE" />
      <Toggle
        orientation="horizontal"
        options={startingScoreOpts}
        x-model="startingScoreOption"
        class="w-full"
      />
      <Input
        id="startingScoreValue"
        name="startingScoreValue"
        type="text"
        inputmode="numeric"
        placeholder="Starting score"
        aria-label="Custom starting score"
        x-model.number="startingScoreValue"
        @input="scoreClampNotice = ''"
        x-show="startingScoreOption === 'CUSTOM'"
        x-cloak
        class="glass rounded-full mt-2"
      />
      <p
        class="px-0.5 text-xs text-muted"
        role="status"
        x-show="scoreClampNotice"
        x-text="scoreClampNotice"
        x-cloak
      >
      </p>
    </div>
    <div class="flex flex-col gap-2">
      <SettingLabel text="MATCH FORMAT" />
      <div class="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-2.5">
        <Toggle
          orientation="vertical"
          options={matchFormatOpts}
          initial="FIRST_TO"
          class="w-full"
        />
        <Stepper
          min={FIVE_OH_ONE_LEGS_MIN}
          max={FIVE_OH_ONE_LEGS_MAX}
          ariaLabel="Legs to win"
          x-model="legsToWin"
          class="justify-self-center"
        />
        <Toggle
          orientation="vertical"
          options={matchUnitOpts}
          initial="LEGS"
          class="w-full"
        />
      </div>
    </div>
    <Switch
      label="Show checkout hints"
      x-model="$store.checkoutHints.enabled"
    />
  </SettingSectionShell>
```

  - The two locked toggles have no `x-model`, so they own `activeTab` internally. That is fine: nothing reads them.
  - The legs `Input`, its label and the `legsClampNotice` paragraph are removed. `legsClampNotice` stays in the data factory (data is untouched); it is now unreachable from markup.

- [ ] **Step 5:** Run `cd app && npx astro check && npm test`. Expected: 0 errors, PASS.

- [ ] **Step 6: Commit.**

```bash
git add app/src/lib/game/five-oh-one-legs.ts app/tests/lib/game/five-oh-one-legs.test.ts app/src/components/layout/games/setup/FiveOhOneSetupForm.astro
git commit -m "feat(setup): 501 match format grid with legs stepper"
```

---

### Task 9: Duration forms — 121, Score training, TUOD, ATC sliders

**Files:**
- Modify: `app/src/lib/game/around-the-clock-duration.ts` (add `AROUND_THE_CLOCK_DEFAULT_MINUTES`)
- Modify: `app/src/lib/game/around-the-clock-setup.data.ts:9` (import it instead of the local `DEFAULT_MINUTES`)
- Modify: `OneTwentyOneSetupForm.astro`, `ScoreTrainingSetupForm.astro`, `TuodSetupForm.astro`, `AroundTheClockSetupForm.astro` (all in `app/src/components/layout/games/setup/`)
- Test: `app/tests/lib/game/around-the-clock-duration.test.ts` (append, or create)

**Interfaces:**
- Consumes: `RangeSlider` (Task 4), `SettingLabel` (Task 2), `Switch` (Task 2), and these bounds helpers (verified in the repo):
  - `oneTwentyOneDurationBounds(type)`
  - `scoreTrainingDurationBounds(type)`
  - `tuodDurationBounds(type)`
  - `aroundTheClockDurationBounds()`

  Each returns `{ min, max }`.

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
import {
  AROUND_THE_CLOCK_DEFAULT_MINUTES,
  aroundTheClockDurationBounds,
} from "@lib/game/around-the-clock-duration";

describe("ATC default minutes export", () => {
  it("is 10 and inside the duration bounds", () => {
    const { min, max } = aroundTheClockDurationBounds();
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBe(10);
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBeGreaterThanOrEqual(min);
    expect(AROUND_THE_CLOCK_DEFAULT_MINUTES).toBeLessThanOrEqual(max);
  });
});
```

- [ ] **Step 2:** Run `cd app && npm test -- tests/lib/game/around-the-clock-duration.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - In `around-the-clock-duration.ts`, add:

    ```ts
    /** Minutes used when a timed run has no typed value. */
    export const AROUND_THE_CLOCK_DEFAULT_MINUTES = 10;
    ```

  - In `around-the-clock-setup.data.ts`, delete `const DEFAULT_MINUTES = 10;`, import `AROUND_THE_CLOCK_DEFAULT_MINUTES`, and replace its single use.
  - Run the test, then `npm test -- tests/lib/game`. Expected: PASS (behaviour is identical).

- [ ] **Step 4: Update `OneTwentyOneSetupForm.astro`.**
  - Imports: drop `Input`; add `RangeSlider`, `SettingLabel` and `{ oneTwentyOneDurationBounds }`.
  - Data:

```ts
const rounds = oneTwentyOneDurationBounds("ROUNDS");
const minutes = oneTwentyOneDurationBounds("MINUTES");
const soloHint = "Rounds and Time are solo only — with a guest or bot, check out 170 to win.";
```

  Settings body:

```astro
  <SettingSectionShell>
    <template x-if="guests.length === 0 && !bot">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <SettingLabel text="FORMAT" />
          <Toggle orientation="horizontal" options={formatOpts} x-model="durationType" class="w-full" />
        </div>
        <template x-if="durationType === 'ROUNDS'">
          <RangeSlider min={rounds.min} max={rounds.max} label="ROUNDS" ariaLabel="Number of rounds" hint={soloHint} x-model="durationValue" />
        </template>
        <template x-if="durationType === 'MINUTES'">
          <RangeSlider min={minutes.min} max={minutes.max} label="MINUTES" ariaLabel="Number of minutes" hint={soloHint} x-model="durationValue" />
        </template>
      </div>
    </template>
    <template x-if="guests.length > 0 || bot">
      <p class="px-0.5 text-xs text-muted">
        Check out 170 to win — Rounds and Time modes are solo only.
      </p>
    </template>
    <Switch label="Show checkout hints" x-model="$store.checkoutHints.enabled" />
  </SettingSectionShell>
```

  Each type gets its own `x-if`, so switching type remounts the slider with that type's bounds. The data factory sets `durationValue` for the new type before the remount.

- [ ] **Step 5: Update `ScoreTrainingSetupForm.astro`.**
  - Imports: drop `Input`; add `RangeSlider`, `SettingLabel` and `{ scoreTrainingDurationBounds }`.
  - Data: `rounds` / `minutes` as in Step 4 via `scoreTrainingDurationBounds`, and `const soloHint = "Time is solo only — with a guest or bot, play by rounds.";`.
  - Body:

```astro
  <SettingSectionShell>
    <template x-if="guests.length === 0 && !bot">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <SettingLabel text="FORMAT" />
          <Toggle orientation="horizontal" options={formatOpts} x-model="durationType" class="w-full" />
        </div>
        <template x-if="durationType === 'ROUNDS'">
          <RangeSlider min={rounds.min} max={rounds.max} label="ROUNDS" ariaLabel="Number of rounds" hint={soloHint} x-model="durationValue" />
        </template>
        <template x-if="durationType === 'MINUTES'">
          <RangeSlider min={minutes.min} max={minutes.max} label="MINUTES" ariaLabel="Number of minutes" hint={soloHint} x-model="durationValue" />
        </template>
      </div>
    </template>
    <template x-if="guests.length > 0 || bot">
      <RangeSlider min={rounds.min} max={rounds.max} label="ROUNDS" ariaLabel="Number of rounds" x-model="durationValue" />
    </template>
  </SettingSectionShell>
```

- [ ] **Step 6: Update `TuodSetupForm.astro`.**
  - Same as Step 5, using `tuodDurationBounds` and the same `soloHint`.
  - Then keep the checkout `Switch` as the last child: `<Switch label="Show checkout hints" x-model="$store.checkoutHints.enabled" />`.
  - First read the current guest branch at `TuodSetupForm.astro:68-88`. Carry over any extra markup it has beyond the rounds `Input` (for example a note `<p>`), restyled to `px-0.5 text-xs text-muted`.

- [ ] **Step 7: Update `AroundTheClockSetupForm.astro`.**
  - Imports: drop `Input`; add `RangeSlider`, `SettingLabel` and `{ aroundTheClockDurationBounds, AROUND_THE_CLOCK_DEFAULT_MINUTES }`.
  - Delete `labelClass`. Add `const minutes = aroundTheClockDurationBounds();`.
  - Body:

```astro
  <SettingSectionShell>
    <div class="flex flex-col gap-4" x-show="!bot" x-cloak>
      <div class="flex flex-col gap-2">
        <SettingLabel text="DIRECTION" />
        <Toggle orientation="horizontal" options={directionOpts} x-model="pathDirection" class="w-full" />
      </div>
      <Switch label="Odds first" hint="Play every odd number before the evens" x-model="oddsFirst" />
      <div class="flex flex-col gap-2">
        <SettingLabel text="DIFFICULTY" />
        <Toggle orientation="horizontal" options={difficultyOpts} x-model="difficulty" class="w-full" />
      </div>
      <div class="flex flex-col gap-2" x-show="$store.settings.captureModeKey === 'ANALYTICS'" x-cloak>
        <SettingLabel text="SEGMENT" badge="ANALYTICS" />
        <Toggle orientation="horizontal" options={segmentOpts} x-model="segmentRule" class="w-full" />
      </div>
      <div class="flex flex-col gap-4" x-show="guests.length === 0" x-cloak>
        <div class="flex flex-col gap-2">
          <SettingLabel text="DURATION" />
          <Toggle orientation="horizontal" options={durationOpts} x-model="durationType" class="w-full" />
        </div>
        <template x-if="durationType === 'MINUTES'">
          <RangeSlider
            min={minutes.min}
            max={minutes.max}
            fallback={AROUND_THE_CLOCK_DEFAULT_MINUTES}
            label="MINUTES"
            ariaLabel="Number of minutes"
            hint={`${minutes.min}–${minutes.max} minutes. Solo only.`}
            x-model="durationValue"
          />
        </template>
      </div>
    </div>
  </SettingSectionShell>
```

  `x-if` (not `x-show`) on the slider means the `null → 10` write-back only happens once Timed is picked. Untimed keeps `durationValue: null`, as today.

- [ ] **Step 8:** Run `cd app && npx astro check && npm test && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, PASS, OK.

- [ ] **Step 9: Commit.**

```bash
git add app/src/lib/game/around-the-clock-duration.ts app/src/lib/game/around-the-clock-setup.data.ts app/tests/lib/game/around-the-clock-duration.test.ts app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro app/src/components/layout/games/setup/TuodSetupForm.astro app/src/components/layout/games/setup/AroundTheClockSetupForm.astro
git commit -m "feat(setup): duration sliders for 121, score training, TUOD, ATC"
```

---

### Task 10: Toggle-only forms — Doubles, Shanghai, Singles

**Files:**
- Modify: `DoublesTrainingSetupForm.astro`, `ShanghaiSetupForm.astro`, `SinglesTrainingSetupForm.astro` (in `app/src/components/layout/games/setup/`)

- [ ] **Step 1: Doubles.** Delete `labelClass`; import `SettingLabel`. Body:

```astro
  <SettingSectionShell>
    <div class="flex flex-col gap-2">
      <SettingLabel text="TARGET ORDER" />
      <Toggle orientation="horizontal" options={orderModeOpts} x-model="orderMode" class="w-full" />
    </div>
  </SettingSectionShell>
```

- [ ] **Step 2: Shanghai.** Import `SettingLabel`. Wrap the existing `Toggle` (keep its `hint` expression) in:

```astro
    <div class="flex flex-col gap-2">
      <SettingLabel text="DIFFICULTY" />
      ...existing Toggle unchanged...
    </div>
```

- [ ] **Step 3: Singles.** Delete `labelClass`; import `SettingLabel`. Replace each `<label class={labelClass}>X</label>` and its wrapper `<div>` with a `<div class="flex flex-col gap-2">` that starts with:
  - `<SettingLabel text="TARGET ORDER" />`
  - `<SettingLabel text="DIFFICULTY" />`
  - `<SettingLabel text="SCORING" badge="ANALYTICS" />`, keeping the scoring wrapper's `x-show` / `x-cloak`

  Change the outer `gap-3` to `gap-4`.

- [ ] **Step 4:** Run `cd app && npx astro check && bash ../scripts/check-astro-conventions.sh`. Expected: 0 errors, OK.

- [ ] **Step 5: Commit.**

```bash
git add app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro app/src/components/layout/games/setup/ShanghaiSetupForm.astro app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro
git commit -m "feat(setup): mono labels on doubles, shanghai, singles"
```

---

### Task 11: Verify, docs, decision, discovered work

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (rows at :36 `InfoSection`, :58 `Switch`, :109 `SettingSectionShell`, :110 `SetupShell`; new rows)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (new utilities)
- Modify: `decisions/frontend/style.md` (append D430)
- Modify: `docs/superpowers/specs/2026-10-08-game-setup-redesign-design.md` (status line only: `approved` → `implemented`)

- [ ] **Step 1: Visual pass.** Run `cd app && npm run dev` and use the `run` skill to drive a browser at 390×844. For each of the 11 `/games/<slug>/setup/` pages, compare against the design screen:
  - **Solo state.**
  - **Guest added:** 121, Score training and TUOD switch to their guest branch.
  - **Bot added:** ATC hides its settings.
  - **501:** the stepper is bounded at 1 and 20; Best of and Sets cannot be clicked.
  - **Slide:** a short drag snaps back; a full drag starts the game; Tab then Enter starts the game.
  - **Rules card:** clamped, expands on tap; Bob's shows it open.
  - **Other `Toggle` users:** also check `/statistics` and trivia QuickSubtract.

  Fix any regressions in the owning task's files and commit them as `fix(setup): …`.

- [ ] **Step 2: Component Inventory.**
  - Add these rows to the forms table:
    - `Stepper.astro`: "Bounded vertical stepper, spinbutton" | `min`, `max`, `ariaLabel`, `x-model`
    - `RangeSlider.astro`: "Bounded integer slider over native range" | `min`, `max`, `label`, `ariaLabel`, `fallback`, `hint`, `x-model`
    - `SlideToStart.astro`: "Fixed slide-to-submit above BottomNav; Enter/Space" | `disabledExpr`, `label`
  - Add a setup table row for `SettingLabel.astro`: "Mono caps setting label + optional chip" | `text`, `badge`.
  - Update these rows:
    - `InfoSection`: add `open`.
    - `Switch`: hint under the label.
    - `SetupShell`: start via `SlideToStart`.
    - `Toggle`: `options[].disabled`.

- [ ] **Step 3: Style Guide.** Add one line each for `setting-badge`, `slider-fill`, `slider-thumb`, `slider-bubble`, `slide-thumb`, `slide-fill` and `start-bar-fade`: name, purpose and the design source (6a / 4d).

- [ ] **Step 4: Decision.** Append to `decisions/frontend/style.md`:

```markdown
### D430 — Setup controls are bounded primitives; start is a slide
Status: Accepted · Date: 2026-10-08
Decision: game setup screens follow Claude Design `Game Setup.dc.html`. Numeric settings use `Stepper` (501 legs) or `RangeSlider` (rounds/minutes) instead of free text inputs; slider bounds come from each game's `*DurationBounds` helper, never the mock's 5–30. Start is `SlideToStart`: release past 85% or press Enter/Space submits; a tap does nothing; a fired slide resets when loading ends or after 600ms if loading never began. `Toggle` options may be `disabled` (501 Best of / Sets render locked until supported). `InfoSection` clamps to two lines and gains `open` for setups without settings. No new icons: `chevron-down`, `plus`, `play-rounded`, `target` via `currentColor`.
Reason: bounded controls make out-of-range input unreachable, so clamp notices drop from markup while the domain clamps stay as the `start()` guard; a slide guards against accidental starts.
Consequences: the `Input` clamp notices for legs and duration are gone from markup. `Toggle` restyle also reaches `/statistics` and trivia. `.astro` carries no unit test (D101); pure helpers in `lib/ui/{stepper,range-slider,slide-to-start,initials}` are tested. Deferred (GitHub issues): 501 Best of, 501 Sets, DartBot level slider onto `RangeSlider`.
Supersedes: none.
```

- [ ] **Step 5: Discovered work.** Run the `capturing-discovered-work` skill once per item, to file `discovered-work` issues:
  1. "501: support Best of match format": the setup control is shown locked (D430).
  2. "501: support Sets": shown locked (D430).
  3. "OpponentChooserModal: move the DartBot level slider onto `RangeSlider`".
  4. Anything else noticed during Tasks 1–10.

  Record the issue numbers for the PR body.

- [ ] **Step 6: Gates.** Run the `run-all-gates` skill, then the `validate-app` skill. Expected: every script reports OK or PASS. Paste the failures, if any, and fix them in the owning files.

- [ ] **Step 7: Context maintenance.**
  - Run the `context-maintenance` skill: CLAUDE.md sync, context map, decision ledger, graph note.
  - Set the spec status to `implemented`.

- [ ] **Step 8: Commit.**

```bash
git add docs/architecture/07-Frontend/08-Component-Inventory.md docs/architecture/07-Frontend/07-Style-Guide.md decisions/frontend/style.md docs/superpowers/specs/2026-10-08-game-setup-redesign-design.md
git commit -m "docs(setup): D430, component inventory, style guide"
```

- [ ] **Step 9: Finish.** Run `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill (Option 2: push and open a PR). The PR body lists the discovered-work issue numbers.
