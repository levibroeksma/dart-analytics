# Setup Toggle Integration — Design

> **Date:** 2026-08-07
> **Status:** approved (brainstorming consensus)
> **Scope:** Wire a pill Toggle (OOP module + Alpine factory + setup Astro shell) into Score Training setup via `x-model` / `x-modelable`, linked to `scoreTrainingSetup`.
> **Out of scope:** Moving Toggle into portable `components/ui/`; restyling off `tab-*` tokens onto semantic-only tokens; DOM layout unit tests beyond the Proxy private-field guard (optional stubs deferred).
>
> **Revised 2026-08-07** after validating the implementation plan against the frontend handbook and gate scripts: the Alpine factory moves to `lib/ui/toggle.data.ts` (`02-Folder-Structure.md` colocation rule — `lib/client/alpine/` holds only the entry factory and registrars), the module's `type` aliases live in a new `modules/ui/types.ts` raised by `modules/types.ts` rather than in `interfaces.ts`, and the setup test helper gains a mocked `$watch` (its absence would break every existing `init()` test).

---

## Context

Score Training setup is mid-rebuild under `components/layout/games/setup/`. A working `Toggle.astro` shell and a typed `Toggle` class exist, but they are not integrated with the codebase architecture or with `score-training-setup.data.ts`.

Decisions locked in brainstorming:

| Topic | Choice |
| ----- | ------ |
| Astro home | Keep under `layout/games/setup/` (game chrome; `tab-*` tokens OK) |
| OOP class | `modules/ui/toggle.module.ts` (classes only under `modules/`) |
| Parent binding | `x-model="durationType"` + `$watch` → `selectMode` |
| Form Alpine scope | Drop nested form `x-data`; inherit page `scoreTrainingSetup()` |
| Option values | `"ROUNDS"` / `"MINUTES"` (match `ScoreTrainingDurationType`) |
| Submit | `SetupShell` calls `start()` (setup factory keeps `start`) |
| Approach | Nested Alpine.data + `x-modelable` (Approach 1) |

Authority: `07-Frontend/03-Alpine-Patterns.md`, `04-Modules-And-OOP.md`, `02-Folder-Structure.md`, `05-Astro-Components.md`, `app/CLAUDE.md`.

---

## Scope

In scope:

- `modules/ui/toggle.module.ts` + types on a new `modules/ui/types.ts` (raised by `modules/types.ts`)
- `tests/modules/ui/toggle.module.test.ts` (Vitest port of value/Proxy tests)
- `lib/ui/toggle.data.ts` + register as `Alpine.data("toggle", …)`
- Fix `Toggle.astro` / `ToggleListItem.astro` conventions (`cn`, `{...props}`, no `font-medium`)
- Wire `ScoreTrainingSetupForm.astro` (no nested `x-data`; domain option values; `x-model`)
- `$watch("durationType", …)` in `score-training-setup.data.ts` calling `selectMode`
- `SetupShell.astro` `@submit.prevent="start()"`

Out of scope:

- Portable-kit move to `components/ui/` + token restyle
- Focus trap / roving tabindex beyond current click + `data-toggle-value` markup
- Vitest for `.astro` markup (D101)
- Optional `mount`/`layout` DOM geometry tests (manual check in v1)

---

## Architecture

```
Page: x-data="scoreTrainingSetup()"
  └─ ScoreTrainingSetupForm (no x-data)
       └─ Toggle.astro
            x-data="toggle(config)" + x-modelable="activeTab"
            x-model="durationType"  (parent)
                 └─ lib/ui/toggle.data.ts (closure holds Toggle instance)
                      └─ modules/ui/toggle.module.ts
                           mount / ResizeObserver / pill layout
```

| File | Role |
| ---- | ---- |
| `app/src/modules/ui/toggle.module.ts` | OOP class; `#` privates; `mount` / `unmount` / `layout` / `setValue` |
| `app/src/modules/ui/types.ts` | New barrel: `ToggleOption`, `Orientation`, `Pill`, `ToggleOpts` |
| `app/src/modules/types.ts` | Raise it: `export * from "./ui/types";` |
| `app/tests/modules/ui/toggle.module.test.ts` | Vitest: defaults, initial, unknown, setValue, Proxy private-field guard |
| `app/src/lib/ui/toggle.data.ts` | `toggleData(config)` factory; class in closure only |
| `app/src/lib/client/alpine/register-ui-data.ts` | `Alpine.data("toggle", toggleData)` (name must match markup) |
| `app/src/components/layout/games/setup/Toggle.astro` | Shell + pill; `x-data={`toggle(${JSON.stringify(config)})`}` |
| `app/src/components/layout/games/setup/ToggleListItem.astro` | Option row; `@click` → `select(value)` |
| `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro` | Drop nested `x-data`; options + `x-model` |
| `app/src/lib/game/score-training-setup.data.ts` | `$watch("durationType")` → `selectMode` |
| `app/src/components/layout/games/setup/SetupShell.astro` | `@submit.prevent="start()"` |

---

## Data flow

### Toggle Alpine factory

Reactive fields on the Alpine object: `activeTab`, `options`, `orientation`, `pill`.

Closure-only: `Toggle` instance. **Never** assign the class instance to `this.*` — Alpine deep-proxies reactive state; calling methods on a proxied class breaks ES private fields (`#ro`, `#pill`, …) and `mount`/`layout` never run (pill stays 0×0). Covered by the Proxy unit test.

Lifecycle:

1. `init()` — resolve `activeTab` against options; `new Toggle({…, onPillChange})`; `$watch("activeTab", (v) => toggle?.setValue(v))`; `$nextTick` → `toggle.mount(this.$refs.list)` → `requestAnimationFrame(() => toggle?.layout())` so fonts/layout settle.
2. `destroy()` — `toggle?.unmount()`; clear closure ref.
3. `select(value)` — sets `activeTab` (used by list items).

`x-modelable="activeTab"` exposes the value to the parent `x-model`.

### Score Training setup

- Page owns `scoreTrainingSetup()`; form does **not** declare `x-data`.
- Toggle bound with `x-model="durationType"`. Omit a separate `initial` prop when `x-model` is present — parent `durationType` is the source of truth via `x-modelable`.
- Options:

```ts
[
  { value: "ROUNDS", label: "Rounds" },
  { value: "MINUTES", label: "Time" },
]
```

- In setup `init()`, register:

```ts
this.$watch("durationType", (type: ScoreTrainingDurationType) => {
  this.selectMode(type);
});
```

Alpine `$watch` does not fire on registration. Subsequent changes (Toggle → `x-model`, or any other writer) call `selectMode`, which remains the single place that sets `durationValue` from the preset and clears `clampNotice`. Re-entrant `selectMode` when it assigns the same `durationType` is idempotent.

- `SetupShell` submit: `@submit.prevent="start()"` → existing `start()` method (no rename of the factory method).

### Prop forwarding

`Toggle.astro` destructures known props, then spreads leftover attributes as `{...props}` onto the root so parent `x-model` / `class` / other Alpine attrs reach the element that owns `x-data` + `x-modelable`.

---

## Component conventions

- Use `cn()` for class composition — never `class:list` (gate: `check-astro-class-composition.sh`).
- Template attribute spread must be `{...props}` (style gate forbids `{...rest}`).
- No `font-medium` on list item labels — `font-normal` / `font-semibold` / `font-bold` only.
- No `x-init`; factory `init()` only.
- Alpine v3 shorthand (`:attr`, `@event`) on native elements.

---

## Errors & edge cases

| Case | Behavior |
| ---- | -------- |
| Empty `options` | Module constructor throws; do not swallow in the Alpine factory |
| Unknown initial / parent value | Module `#resolveValue` falls back to first option; factory syncs `activeTab` in `init` |
| Missing `$refs.list` | Skip `mount`; no throw |
| Teardown | `destroy` always `unmount`s ResizeObserver |

---

## Testing

**Module (required):** port to Vitest under `app/tests/modules/ui/toggle.module.test.ts`:

- defaults to first option when `initial` omitted
- uses matching `initial`
- unknown `initial` → first option
- `setValue` ignores unknown; accepts known
- Proxy wrapper throws on private-field access (documents “Alpine must not wrap Toggle”)

**Setup:** existing `score-training-setup.data.test.ts` continues to exercise `selectMode` directly, and its context helper gains a mocked `$watch` that records `(key, callback)` — mandatory, since `init()` now calls it. One added test asserts the recorded `durationType` callback runs `selectMode`. Alpine's own `$watch` runtime stays untested; only our callback is.

**Manual:**

- Pill tracks selection (horizontal); resize reflows
- Rounds ↔ Time updates duration field via `selectMode`
- Start Game invokes `start()`

---

## Non-goals / follow-ups

- Elevate Toggle to portable `components/ui/` + semantic-token restyle (separate task).
- DOM geometry tests for `layout()` / `pill` (optional later).
