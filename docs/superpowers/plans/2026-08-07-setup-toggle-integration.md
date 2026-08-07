# Setup Toggle Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the pill Toggle (OOP module + Alpine factory + setup Astro shell) with Score Training setup so `durationType` binds via `x-model`/`x-modelable` and mode switches run `selectMode`.

**Architecture:** `Toggle` class lives in `modules/ui/toggle.module.ts` (private fields; never Alpine-proxied), with its option/pill types in `modules/ui/types.ts` raised through `modules/types.ts`. Alpine factory `toggle(config)` lives in `lib/ui/toggle.data.ts` and holds the instance in a closure, mounts on `$refs.list`, and exposes `activeTab` via `x-modelable`. The setup page owns `scoreTrainingSetup()`; the form inherits that scope, binds `x-model="durationType"`, and `$watch`es `durationType` → `selectMode`. `SetupShell` submits with `start()`.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest (`environment: "node"` — these tests never touch the DOM, so no `jsdom` pragma).

**Spec:** `docs/superpowers/specs/2026-08-07-setup-toggle-integration-design.md`

**Revised 2026-08-07** after validating the first draft against the docs and gate scripts. Corrections carried here: the setup test helper needs a `$watch` stub (the draft's targeted-test claim was false); factory types must not be exported from an implementation file and module types must be imported via the `@modules/types` area root (`scripts/check-type-barrels.sh` rules 1 and 3); the factory moves to `lib/ui/` per `02-Folder-Structure.md`; verification follows `run-all-gates` + `validate:app` + the full-suite policy; the decision is appended as a block, never as a table row; context-map registration, `03-Alpine-Patterns.md` sync, branch/PR check, Astro frontmatter section headers, and `[key: string]: unknown` are now explicit steps.

## Global Constraints

- Astro shell stays under `components/layout/games/setup/` — not portable `components/ui/`
- OOP class only under `modules/ui/` — never assign the instance to Alpine `this.*`
- Alpine factory lives at `app/src/lib/ui/toggle.data.ts`, imported as `@lib/ui/toggle.data` (matches the `@lib/game/*.data.ts` precedent in `register-route-data.ts`); `lib/client/alpine/` holds only `app.factory.ts` + the three registrars
- Register Alpine name **`toggle`** (matches `x-data={`toggle(...)`}`) — not `toggleData`
- Module types: `type` aliases go in `modules/ui/types.ts` (raised by `modules/types.ts`); `interface` declarations stay in `modules/ui/interfaces.ts`. Consumers outside `modules/ui/` import them from `@modules/types` — never `@modules/ui/types` (`check-type-barrels.sh` rule 3)
- No `export type` / `export interface` in any implementation file — unexported local types are fine (precedent: `stores/auth.store.ts`, `middleware.ts`)
- Option values `"ROUNDS"` / `"MINUTES"` only (never `"TIME"`)
- Form must **not** declare its own `x-data`; page already has `scoreTrainingSetup()`
- `SetupShell` calls `start()` — do not rename the setup factory method
- No `$persist` on Toggle; no `x-init`; Alpine v3 shorthand (`:attr`, `@event`)
- `cn()` only — no `class:list`; template spread `{...props}` only — no `{...rest}`
- Astro frontmatter order per `05-Astro-Components.md`: `interface Props` → `// Props` destructure → grouped imports (`// Components`, `// Lib`) → `// Data` → `// Styles`
- Astro `Props` index signature is `[key: string]: unknown` (committed convention: `Button.astro`, `Input.astro`, `IsLoading.astro`) — never `any`
- No `font-medium`; no `text-fg-*` / `bg-bg-*` (use `text-muted-foreground`, etc.)
- No inline `//` comments inside `app/src/**/*.ts` function bodies — snippets below that show `// …` are **plan annotations only**; do not copy them into source
- Tests under `app/tests/` only; Vitest (not `node:test`); full suite runs before any completion claim (`07-Frontend/06-Test-Strategy.md`)
- Worktrees forbidden — dedicated task branch in the main working copy
- Do not commit unless the user asks (plan steps still list commit commands for when they do)
- Out of scope: portable-kit move to `components/ui/`, DOM geometry unit tests for `layout()` / `pill`

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/ui/types.ts` | **New** — `ToggleOption`, `Orientation`, `Pill`, `ToggleOpts` |
| `app/src/modules/types.ts` | Raise the new barrel: `export * from "./ui/types";` |
| `app/src/modules/ui/toggle.module.ts` | OOP `Toggle` class (value + pill layout + ResizeObserver) |
| `app/tests/modules/ui/toggle.module.test.ts` | Vitest: value resolution, `setValue`, empty options, Proxy private-field guard |
| `app/src/lib/ui/toggle.data.ts` | **New** — `toggleData(config)` Alpine factory; instance in closure; local unexported types |
| `app/src/lib/client/alpine/register-ui-data.ts` | `Alpine.data("toggle", toggleData)` from `@lib/ui/toggle.data` |
| `app/src/lib/game/types.ts` | Add `$watch` to `ScoreTrainingSetupContext` |
| `app/src/lib/game/score-training-setup.data.ts` | `init()` registers `$watch("durationType")` → `selectMode` |
| `app/tests/lib/game/score-training-setup.data.test.ts` | `$watch` stub in `createSetup()` + mode-change test |
| `app/src/components/layout/games/setup/Toggle.astro` | Shell + `x-modelable`; frontmatter order, `unknown` index signature |
| `app/src/components/layout/games/setup/ToggleListItem.astro` | Option row; frontmatter order, `unknown` index signature |
| `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro` | Drop nested `x-data`; domain option values; `x-model` |
| `app/src/components/layout/games/setup/SetupShell.astro` | `@submit.prevent="start()"` |
| `decisions/frontend/alpine.md` | Append decision **block** (never a table row) |
| `docs/architecture/07-Frontend/03-Alpine-Patterns.md` | Registrar list + anti-pattern row for proxied module instances |
| `docs/architecture/00-Context-Map.md` | Register this plan + its spec in the File Inventory |

---

### Task 1: Toggle module (TDD)

**Files:**
- Create: `app/src/modules/ui/types.ts`
- Modify: `app/src/modules/types.ts`
- Create: `app/src/modules/ui/toggle.module.ts`
- Test: `app/tests/modules/ui/toggle.module.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `Toggle` class (`@modules/ui/toggle.module`); types `ToggleOption`, `Orientation`, `Pill`, `ToggleOpts`, importable as `@modules/types`

- [ ] **Step 1: Create `app/src/modules/ui/types.ts`**

```ts
export type ToggleOption = { value: string; label: string };
export type Orientation = "horizontal" | "vertical";
export type Pill = { w: number; h: number; x: number; y: number };

export type ToggleOpts = {
  options: ToggleOption[];
  orientation: Orientation;
  initial?: string;
  onPillChange?: (pill: Pill) => void;
};
```

Leave `app/src/modules/ui/interfaces.ts` untouched — `SegmentTimerOptions` is an `interface` and stays there.

- [ ] **Step 2: Raise the new barrel in `app/src/modules/types.ts`**

The file currently contains one line. It becomes:

```ts
export * from "./game/types";
export * from "./ui/types";
```

Without this, `scripts/check-type-barrels.sh` rule 2 fails with "`app/src/modules/ui/types.ts` is never raised".

- [ ] **Step 3: Write the failing tests**

Create `app/tests/modules/ui/toggle.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Toggle } from "@modules/ui/toggle.module";

describe("Toggle", () => {
  const options = [
    { value: "bestOf", label: "Best of" },
    { value: "firstTo", label: "First to" },
  ];

  it("defaults value to first option when initial omitted", () => {
    const t = new Toggle({ options, orientation: "vertical" });
    expect(t.value).toBe("bestOf");
  });

  it("uses initial when it matches an option", () => {
    const t = new Toggle({
      options,
      orientation: "vertical",
      initial: "firstTo",
    });
    expect(t.value).toBe("firstTo");
  });

  it("falls back to first option when initial is unknown", () => {
    const t = new Toggle({
      options,
      orientation: "vertical",
      initial: "nope",
    });
    expect(t.value).toBe("bestOf");
  });

  it("setValue ignores unknown values", () => {
    const t = new Toggle({
      options,
      orientation: "horizontal",
      initial: "bestOf",
    });
    t.setValue("nope");
    expect(t.value).toBe("bestOf");
    t.setValue("firstTo");
    expect(t.value).toBe("firstTo");
  });

  it("throws when options is empty", () => {
    expect(
      () => new Toggle({ options: [], orientation: "horizontal" }),
    ).toThrow(/at least one option/);
  });

  it("throws when methods run through a Proxy (Alpine must not wrap Toggle)", () => {
    const t = new Toggle({ options, orientation: "horizontal" });
    const proxied = new Proxy(t, {});
    expect(() => proxied.unmount()).toThrow(/private/);
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL (module missing)**

```bash
cd app && npx vitest run tests/modules/ui/toggle.module.test.ts
```

Expected: FAIL — cannot resolve `@modules/ui/toggle.module`.

- [ ] **Step 5: Implement `app/src/modules/ui/toggle.module.ts`**

```ts
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
```

`./types` is this file's own folder barrel — the only relative barrel import rule 4 permits.

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd app && npx vitest run tests/modules/ui/toggle.module.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 7: Prove the barrel rules hold**

```bash
bash scripts/check-type-barrels.sh
```

Expected: `OK: 23 type barrel(s) fully raised; …` (one more barrel than before this task).

- [ ] **Step 8: Commit** (only if the user asked)

```bash
git add app/src/modules/ui/types.ts \
  app/src/modules/types.ts \
  app/src/modules/ui/toggle.module.ts \
  app/tests/modules/ui/toggle.module.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): add Toggle module with private-field pill layout

EOF
)"
```

---

### Task 2: Alpine `toggle` factory + registration

**Files:**
- Create: `app/src/lib/ui/toggle.data.ts`
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`

**Interfaces:**
- Consumes: `Toggle` from `@modules/ui/toggle.module` (value import — direct path allowed); `Orientation`, `Pill`, `ToggleOption` from `@modules/types` (type import — area root required)
- Produces: `toggleData(config)` registered as Alpine data name `"toggle"`; reactive fields `activeTab`, `options`, `orientation`, `pill`; methods `init`, `destroy`, `select`

- [ ] **Step 1: Create `app/src/lib/ui/toggle.data.ts`**

```ts
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
    orientation: (config.orientation ?? "vertical") as Orientation,
    pill: { w: 0, h: 0, x: 0, y: 0 } as Pill,

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
```

Both local types stay **unexported** — `check-type-barrels.sh` rule 1 rejects an exported `type` in an implementation file, and `lib/ui/` has no barrel to hold one.

- [ ] **Step 2: Replace `app/src/lib/client/alpine/register-ui-data.ts`**

```ts
import type { Alpine } from "alpinejs";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";

export function registerUiData(Alpine: Alpine) {
  Alpine.data("logoutButton", logoutButton);
  Alpine.data("toggle", toggleData);
}
```

Two things the draft got wrong and must not regress: the registered name is `"toggle"` (matching `Toggle.astro`'s `x-data`), and the import path is `@lib/ui/toggle.data` (not `@client/alpine/…`).

- [ ] **Step 3: Delete the stale WIP factory path if it exists**

```bash
test -f app/src/lib/client/alpine/toggle.data.ts && git rm -f app/src/lib/client/alpine/toggle.data.ts || echo "no stale file"
```

- [ ] **Step 4: Verify structure + types**

```bash
bash scripts/check-file-locations.sh && bash scripts/check-type-barrels.sh
cd app && npm run check
```

Expected: both scripts `OK`; `astro check` reports no error in `toggle.data.ts` or `register-ui-data.ts` (name any pre-existing unrelated errors in the report rather than "fixing" them here).

- [ ] **Step 5: Commit** (only if the user asked)

```bash
git add app/src/lib/ui/toggle.data.ts \
  app/src/lib/client/alpine/register-ui-data.ts
git commit -m "$(cat <<'EOF'
feat(alpine): register toggle UI data factory

EOF
)"
```

---

### Task 3: Wire setup form, `$watch`, and submit (TDD)

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/score-training-setup.data.test.ts`
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/SetupShell.astro`
- Modify: `app/src/components/layout/games/setup/Toggle.astro`
- Modify: `app/src/components/layout/games/setup/ToggleListItem.astro`

**Interfaces:**
- Consumes: Alpine data name `toggle` (Task 2); existing `selectMode(type)` / `start()` on the setup factory
- Produces: `durationType` bound to the Toggle; mode change runs `selectMode`; submit runs `start()`

**Why a test exists here at all:** the spec says not to unit-test Alpine's `$watch` *runtime*. This test mocks `$watch` and asserts **our** callback, which is exactly the Vitest-with-mocks pattern `app/CLAUDE.md` mandates — and the stub is required regardless, because `init()` now calls `this.$watch`.

- [ ] **Step 1: Add `$watch` to `ScoreTrainingSetupContext`**

In `app/src/lib/game/types.ts`, inside `ScoreTrainingSetupContext`, immediately after the `$store` block:

```ts
  $watch(
    key: "durationType",
    callback: (value: ScoreTrainingDurationType) => void,
  ): void;
```

- [ ] **Step 2: Add the `$watch` stub + failing test**

In `app/tests/lib/game/score-training-setup.data.test.ts`, capture the registered watcher and give every context the stub. Replace the existing helper:

```ts
  let watchers: Array<{
    key: string;
    callback: (value: never) => void;
  }>;

  function createSetup(
    overrides: Partial<ScoreTrainingSetupContext> = {},
  ): ScoreTrainingSetupContext {
    watchers = [];
    return {
      ...scoreTrainingSetup(),
      $store: store,
      $watch: (key: string, callback: (value: never) => void) => {
        watchers.push({ key, callback });
      },
      ...overrides,
    } as ScoreTrainingSetupContext;
  }
```

Then add this test inside the existing `describe("selectMode", …)` block:

```ts
    it("init registers a durationType watcher that runs selectMode", async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      const watcher = watchers.find((w) => w.key === "durationType");
      expect(watcher).toBeDefined();

      setup.durationType = "MINUTES";
      watcher!.callback("MINUTES" as never);

      expect(setup.durationValue).toBe(5);
      expect(setup.clampNotice).toBe("");
    });
```

- [ ] **Step 3: Run the setup suite — expect FAIL**

```bash
cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts
```

Expected: the new test FAILS (no `durationType` watcher registered). The pre-existing tests still pass — the stub keeps them green.

- [ ] **Step 4: Register the watcher in `init()`**

In `app/src/lib/game/score-training-setup.data.ts`, `init()` opens with the registration, before `loadingReconciliation`:

```ts
    async init(this: ScoreTrainingSetupContext) {
      this.$watch("durationType", (type) => {
        this.selectMode(type);
      });

      this.loadingReconciliation = true;
      try {
```

Everything below is unchanged. Alpine's `$watch` does not fire on registration, and assigning the same primitive does not retrigger reactivity, so `init()`'s own `this.durationType = "ROUNDS"` cannot loop through `selectMode`. Do **not** add a `$watch` on `durationValue` — `start()` writes the clamped value back before setting `clampNotice`, and a watcher would blank the notice (constraint carried from the configurable-duration plan).

- [ ] **Step 5: Run the setup suite — expect PASS**

```bash
cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts
```

Expected: PASS, including every pre-existing `init()` test.

- [ ] **Step 6: Rewrite `ScoreTrainingSetupForm.astro`**

No nested `x-data`, domain option values, and frontmatter section headers per `05-Astro-Components.md`:

```astro
---
// Components
import Input from "@components/forms/Input.astro";
import Toggle from "./Toggle.astro";
import InfoSection from "./InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";

// Data
const formatOpts = [
  { value: "ROUNDS", label: "Rounds" },
  { value: "MINUTES", label: "Time" },
];

const infoSection = {
  title: "Scoring Training",
  description:
    "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.",
};
---

<SetupShell title="Score Training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={formatOpts}
      x-model="durationType"
      class="w-full"
    />
    <Input
      type="text"
      placeholder="Number of rounds"
      x-model.number="durationValue"
      class="glass border-tab-border rounded-full!"
    />
    <span
      class="text-xs text-muted-foreground px-4 py-0 italic"
      x-text="durationType === 'ROUNDS' ? 'Rounds' : 'Minutes'"
    ></span>
  </SettingSectionShell>
</SetupShell>
```

Do **not** pass `initial` alongside `x-model` — the parent's `durationType` is the source of truth through `x-modelable`.

- [ ] **Step 7: Point `SetupShell.astro` at `start()`**

```astro
    @submit.prevent="start()"
```

Leave the title heading, slot, and Start Game button as they are.

- [ ] **Step 8: Bring `Toggle.astro` to convention**

Required end state: `interface Props` with `[key: string]: unknown`, then `// Props` destructure (`class: classNameProp`, rest collected as `...props`), then `// Components` / `// Lib` imports (`ToggleListItem`, `cn` from `@client/cn`), then `// Data` (`config`, `n`), then `// Styles` (`className = cn("tab-container", classNameProp ?? "w-fit")`, `shellClass`, `listClass`, `listStyle`).

Markup must keep: `class={className}` (no `class:list`), `x-data={`toggle(${JSON.stringify(config)})`}`, `x-modelable="activeTab"`, `{...props}`, `x-ref="list"` on the pill shell, and `text-muted-foreground` on the hint.

- [ ] **Step 9: Bring `ToggleListItem.astro` to convention**

Required end state: `[key: string]: unknown` in `Props`, `// Props` header above the destructure, and markup keeping `data-toggle-value={value}`, `:class` on `activeTab`, `@click={`select('${value}')`}`, `font-semibold` (never `font-medium`), `text-muted-foreground` (never `text-fg-muted`).

- [ ] **Step 10: Run the Astro + style gates**

```bash
bash scripts/check-astro-class-composition.sh \
  && bash scripts/check-astro-conventions.sh \
  && bash scripts/check-style-tokens.sh \
  && bash scripts/check-no-inline-comments.sh
```

Expected: four `OK` lines.

- [ ] **Step 11: Manual check**

```bash
cd app && npm run dev
```

On Score Training setup, confirm: the pill sits under the selected option and moves on Rounds ↔ Time; the duration field updates to that mode's preset value (10 / 5); Start Game runs `start()`.

- [ ] **Step 12: Commit** (only if the user asked)

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/score-training-setup.data.ts \
  app/tests/lib/game/score-training-setup.data.test.ts \
  app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro \
  app/src/components/layout/games/setup/SetupShell.astro \
  app/src/components/layout/games/setup/Toggle.astro \
  app/src/components/layout/games/setup/ToggleListItem.astro
git commit -m "$(cat <<'EOF'
feat(setup): bind Toggle to scoreTrainingSetup durationType

EOF
)"
```

---

### Task 4: Docs, decision, and full verification

**Files:**
- Modify: `decisions/frontend/alpine.md` (append a block at end of file)
- Modify: `docs/architecture/07-Frontend/03-Alpine-Patterns.md`
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: canonical doc + decision record; every applicable gate run and reported

- [ ] **Step 1: Sync `03-Alpine-Patterns.md` (docs outrank the ledger)**

Two edits, minimal diff:

1. In the registration-modules table, the `register-ui-data.ts` row currently reads "`Alpine.data()` for portable UI (timer, toast, modal, chart)". Add `toggle` to that list.
2. In the Anti-Patterns table, add a row:

```markdown
| OOP module instance stored on the Alpine data object (`this.toggle = new Toggle()`) | Alpine deep-proxies reactive state; a proxied class throws on every ES private field, so lifecycle methods silently never run — hold it in the factory's closure |
```

Update the file's `updated:` front-matter date to `2026-08-07` and bump its version line.

- [ ] **Step 2: Append the decision block**

Derive the next id:

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- DECISIONS.md 'decisions/**.md' \
  | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append to the **end** of `decisions/frontend/alpine.md`, after its existing table — never as a new table row, and never editing an existing row (`DECISIONS.md` "How to add a decision"; `scripts/check-decision-ids.sh` checks 1 and 5):

```markdown
### D<next> — Hold UI module instances off the Alpine reactive object
Status: Accepted · Date: 2026-08-07
Decision: An Alpine factory that drives a `modules/ui/*` class keeps the instance in the factory closure, never on `this.*`. The registered `Alpine.data()` name matches the factory call in markup (`toggle`), and the factory file lives under `lib/<domain>/` (`lib/ui/toggle.data.ts`), not in `lib/client/alpine/` which holds only the entry factory and registrars.
Reason: Alpine deep-proxies reactive state, and an ES private field throws when read through a Proxy, so `mount()` / `layout()` never ran and the Toggle pill stayed 0×0. A mismatched registration name fails the same way, silently.
Consequences: `modules/ui` classes are unit-tested with an explicit Proxy guard that documents the hazard. `x-modelable` still exposes scalar reactive fields (`activeTab`), so parent `x-model` binding is unaffected. The Toggle's paired `.astro` deliberately sits in `components/layout/games/setup/` rather than `components/ui/` because it uses app `tab-*` tokens — the same one-directional reading of the pairing rule that `segment-timer.module.ts` already relies on.
```

Substitute the derived id and keep the date as the ISO date of the work.

- [ ] **Step 3: Register spec + plan in the context map**

In `docs/architecture/00-Context-Map.md`'s File Inventory, alongside the existing `docs/superpowers/…` rows, add:

```markdown
| `docs/superpowers/specs/2026-08-07-setup-toggle-integration-design.md` | Setup Toggle integration design: `modules/ui` Toggle class, closure-held Alpine factory, `x-model`/`x-modelable` binding to `scoreTrainingSetup` (2026-08-07) | historical |
| `docs/superpowers/plans/2026-08-07-setup-toggle-integration.md` | The 4-task plan implementing that spec: Toggle module + types barrel, `lib/ui` Alpine factory, setup form/`$watch`/submit wiring, docs + verification (2026-08-07) | historical |
```

Bump the map's version line and its `updated:` date, describing the change in one clause.

- [ ] **Step 4: Full app validation**

```bash
cd app && npm run validate:app && cd ..
```

This runs `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` (full suite — never scoped) → `npm run check` → `bash ../scripts/refresh-graph.sh`. If the graph refresh warns that the `graphify` CLI is absent, record that warning in the completion report; stage `graphify-out/graph.json` if it changed.

- [ ] **Step 5: Run every remaining applicable gate**

```bash
bash scripts/check-context-map.sh \
  && bash scripts/check-doc-links.sh \
  && bash scripts/check-context-budget.sh \
  && bash scripts/check-agent-mirrors.sh \
  && bash scripts/check-file-locations.sh \
  && bash scripts/check-astro-class-composition.sh \
  && bash scripts/check-astro-conventions.sh \
  && bash scripts/check-game-engines.sh \
  && bash scripts/check-refinement-coverage.sh \
  && bash scripts/check-type-barrels.sh \
  && bash scripts/check-alias-sync.sh \
  && bash scripts/check-constraint-mirror.sh \
  && bash scripts/check-no-inline-comments.sh \
  && bash scripts/check-style-tokens.sh \
  && bash scripts/check-decision-ids.sh
```

Report each script's result explicitly — the `run-all-gates` skill forbids summarizing as "gates pass".

- [ ] **Step 6: Format**

```bash
cd app && npm run format && npm run format:check
```

Expected: `format:check` clean. Commit any formatting diffs before opening a PR (`app/CLAUDE.md`).

- [ ] **Step 7: Branch / PR check**

```bash
git branch --show-current && git status -sb
```

Confirm the work sits on a dedicated task branch with an open PR targeting `main`, and that unrelated WIP on the branch (`package.json`, `app/src/styles/global.css`, new icons) is either part of this change set or moved off it. Report the PR link, or why none exists, in the completion report. At most one open task branch may target another task branch (`branch-stack-cap`).

- [ ] **Step 8: Commit** (only if the user asked)

```bash
git add decisions/frontend/alpine.md \
  docs/architecture/07-Frontend/03-Alpine-Patterns.md \
  docs/architecture/00-Context-Map.md
git commit -m "$(cat <<'EOF'
docs: record Alpine closure rule for UI module instances

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| `Toggle` class under `modules/ui/` with private fields | 1 |
| Option/pill types on a raised `modules/ui` barrel | 1 |
| Vitest value / empty-options / Proxy-guard tests | 1 |
| Alpine factory registered as `"toggle"` | 2 |
| Instance held in a closure, never on `this` | 2 |
| Missing `$refs.list` skips `mount` without throwing | 2 (Step 1 code) |
| Form drops nested `x-data`; `ROUNDS`/`MINUTES`; `x-model` | 3 |
| `$watch("durationType")` → `selectMode` | 3 |
| `SetupShell` → `start()` | 3 |
| Toggle/ListItem conventions (`cn`, `{...props}`, tokens, no `font-medium`) | 3 |
| No portable-kit move; no DOM geometry tests | Global Constraints |
| Decision, doc sync, context-map registration, gates | 4 |

## Type consistency

- Alpine registration name `"toggle"` ↔ markup `toggle(...)` ↔ `Alpine.data("toggle", toggleData)`
- Factory export is `toggleData`, imported as `@lib/ui/toggle.data`
- `Toggle` value import uses `@modules/ui/toggle.module`; its types come from `@modules/types`
- Reactive scalar `activeTab` ↔ parent `durationType` via `x-modelable` / `x-model`
- Domain values `"ROUNDS"` / `"MINUTES"` in the form, `selectMode`, and `FALLBACK_DURATION`
- Setup method stays `start()`; shell calls `start()`
- `ToggleOption` / `Orientation` / `Pill` / `ToggleOpts` are declared once, in `modules/ui/types.ts`
