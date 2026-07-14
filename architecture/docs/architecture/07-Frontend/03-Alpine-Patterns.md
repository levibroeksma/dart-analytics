<!--
status: canonical
scope: frontend/alpine-patterns
read-when: Alpine stores, forms, data components, persist
updated: 2026-07-14
-->

# Frontend Alpine Patterns

> **Version:** 0.1.0
>
> Alpine.js entry factory, store/form/data patterns, and `$persist` rules.
>
> Folder layout: `02-Folder-Structure.md`. Module boundaries: `04-Modules-And-OOP.md`.

---

# Purpose

This document defines how Alpine.js is bootstrapped and how client state is structured.

Alpine is the interactive layer on prerendered Astro shells (`01-Rendering-Strategy.md`). API calls are orchestrated by pages and forms — not by modules (`02-Folder-Structure.md`).

---

# Layer Diagram

```
Astro page (shell)
    ↓
Alpine.data (*.data.ts) — x-data="componentState()"
    ↓
Alpine.store (*.store.ts) / form (*.form.ts)
    ↓
Module (*.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ (pages/forms/stores only)
```

---

# Alpine Entry Factory

Alpine boots **only** through the `@astrojs/alpinejs` integration entrypoint. No `import Alpine from 'alpinejs'` outside the factory chain. Other files may use `import type { Alpine } from 'alpinejs'`.

**Target `astro.config.mjs`:**

```javascript
alpinejs({ entrypoint: "/src/lib/client/alpine/app.factory" })
```

**`app.factory.ts`:**

```typescript
"use strict";

import persist from "@alpinejs/persist";
import type { Alpine } from "alpinejs";
import { registerStores } from "./register-stores";
import { registerUiData } from "./register-ui-data";
import { registerRouteData } from "./register-route-data";

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);
  registerStores(Alpine);
  registerUiData(Alpine);
  registerRouteData(Alpine);
};
```

### Registration modules

| File | Registers |
| ---- | --------- |
| `register-stores.ts` | `Alpine.store()` for all stores |
| `register-ui-data.ts` | `Alpine.data()` for portable UI (timer, toast, modal, chart) |
| `register-route-data.ts` | `Alpine.data()` for route components (play, session-setup, …) |

Each registrar receives `Alpine` as an argument. Factory files (`.store.ts`, `.data.ts`) export functions only — they do not import Alpine.

---

# Store Pattern

Stores hold shared and persisted session state. Register in `register-stores.ts`:

```typescript
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { gameStore } from "@stores/game.store";

export function registerStores(Alpine: Alpine) {
  const persist = Alpine.persist as Persist;
  Alpine.store("game", gameStore(persist));
}
```

**`game.store.ts`** exports a factory returning the store object. Gameplay blobs are keyed by `gameTypeKey` (D09 — one active session per game type).

Timer **state** (`timerRemainingMs`, `timerStartedAt`) lives in `game.store.ts` for recovery. The `Timer` module (`modules/ui/timer.module.ts`) drives display only.

---

# Form Pattern

Forms hold draft UI interaction state. In v1 they **substitute for `player_settings`** (D77): last-used capture mode, input mode, template selection. Values are sent on every `POST /api/sessions` per D60.

`$persist` is allowed in `*.form.ts` for draft preferences only — not for submitted payloads.

---

# Data Component Pattern

Route-scoped Alpine components live in `*.data.ts`. Register in `register-route-data.ts`:

```typescript
import type { Alpine } from "alpinejs";
import { playData } from "@pages/games/play/play.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("play", playData);
}
```

`play.data.ts` exports a factory function. Templates reference it with **invocation**:

```html
<div x-data="play()">...</div>
```

---

# Binding Rules (Non-Negotiable)

| Rule | Detail |
| ---- | ------ |
| **No `x-init`** | Forbidden everywhere — deprecated |
| **`x-data` invocation** | Always `x-data="componentState()"` — never `x-data="componentState"` |
| **Store registration** | `Alpine.store('name', storeFactory(persist))` — invoke factory so `init()` runs |
| **No Alpine in modules** | `modules/` never import Alpine |

---

# `$persist` Scope

`$persist` is allowed **only** in `*.store.ts` and `*.form.ts`.

| Persisted | Never persisted |
| --------- | --------------- |
| Gameplay / session recovery (`stores/`) | Modal open state |
| Draft UI prefs (`forms/`) | Toast queue |
| Timer fields in `game.store.ts` | Chart hover/selection |
| `idempotencyKey` until batch ACK | Ephemeral `.data.ts` fields |

`lib/client/alpine/` configures the persist plugin (namespace prefix) — not individual store keys.

**Schema evolution (0.1.0):** no runtime `schemaVersion` machinery. Persisted shapes follow the **additive-only** rule — extend fields, never remove or rename incompatibly (D89).

---

# Recovery & Auto-Cleanup

The client owns session-progress persistence (D67, D88).

| Condition | Action |
| --------- | ------ |
| Local store + server `sessionId` align | Resume from store |
| Local missing or `sessionId` mismatch | Client auto-`PATCH` → `ABANDONED` — **no user prompt** |
| Server `ACTIVE`, client empty | Client auto-abandons server session |
| Client-side orphans | Client clears store + abandons server row if present |
| Server DB orphans | Server responsibility (future sweep) — not client UX |

No sign-out step in this flow. See `00-Overview.md` state model.

---

# Skeleton-First Hydration

For data-heavy pages:

1. Prerender shell + middleware gate
2. Client `fetch` from `@client/api/` with Bearer JWT
3. Hydrate Alpine/DOM when response resolves
4. Show error state on failure

Details: `00-Overview.md`.

---

# Anti-Patterns

| Anti-pattern | Reason |
| ------------ | ------ |
| `x-init` | Deprecated — use factory `init()` |
| `x-data="play"` without `()` | `init()` does not run |
| `$persist` in `.data.ts` or components | Unpredictable recovery scope |
| `import Alpine from 'alpinejs'` outside factory | Breaks single entrypoint |
| HTTP in `modules/` | Violates import direction |
| Manual abandon dialog on mismatch | Contradicts D88 auto-cleanup |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | API client, data flows |
| `01-Rendering-Strategy.md` | Prerender + middleware |
| `02-Folder-Structure.md` | Suffixes, aliases |
| `04-Modules-And-OOP.md` | Engine and payload modules |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
