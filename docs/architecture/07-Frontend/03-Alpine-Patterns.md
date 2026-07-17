<!--
status: canonical
scope: frontend/alpine-patterns
read-when: Alpine stores, forms, data components, persist
updated: 2026-07-17
-->

# Frontend Alpine Patterns

> **Version:** 0.2.1
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
import { outboxStore } from "@stores/outbox.store";

export function registerStores(Alpine: Alpine) {
  const persist = Alpine.persist as Persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("outbox", outboxStore(persist));
}
```

**`game.store.ts`** exports a factory returning the store object. Gameplay blobs are keyed by `gameTypeKey` (D09 — one active session per game type). **`outbox.store.ts`** holds completed-but-unsent batches until the server confirms them (see Completed-Batch Outbox below).

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
| **Alpine v3 shorthand** | Use `:attr` and `@event` — never `x-bind:attr` or `x-on:event` (see table below) |
| **No `x-init`** | Forbidden everywhere — deprecated |
| **`x-data` invocation** | Always `x-data="componentState()"` — never `x-data="componentState"` |
| **Store registration** | `Alpine.store('name', storeFactory(persist))` — invoke factory so `init()` runs |
| **No Alpine in modules** | `modules/` never import Alpine |

## Alpine v3 directive syntax (mandatory)

Use **shorthand** for binds and listeners. Keep structural/behavioral directives as `x-*`.

| Use | Not |
| --- | --- |
| `:class="expr"` | `x-bind:class="expr"` |
| `:style="expr"` | `x-bind:style="expr"` |
| `:value="expr"` | `x-bind:value="expr"` |
| `:disabled="expr"` | `x-bind:disabled="expr"` |
| `@click="handler"` | `x-on:click="handler"` |
| `@submit.prevent="handler"` | `x-on:submit.prevent="handler"` |

**Keep long form (no shorthand):** `x-data`, `x-show`, `x-text`, `x-model`, `x-cloak`, `x-for`, `x-if`, `x-transition`, `x-effect`.

### Astro exception

In `.astro` markup, prefer shorthand on **native HTML elements** (`<form>`, `<button>`, `<input>`, …).

When an Alpine listener must be declared inside a **`{}` Astro expression** (component prop or spread) and the linter rejects `@click`, use `x-on:click` for that attribute only. Do not use `x-on:` elsewhere when shorthand works.

```astro
<!-- preferred on native elements -->
<form x-data="loginForm()" @submit.prevent="submit">
  <button type="submit" :disabled="loading">Sign in</button>
</form>

<!-- Astro {} escape hatch only when linter blocks @ -->
<Button {...{ "x-on:click": "handle()" }} />
```

---

# `$persist` Scope

`$persist` is allowed **only** in `*.store.ts` and `*.form.ts`.

| Persisted | Never persisted |
| --------- | --------------- |
| Gameplay / session recovery (`stores/`) | Modal open state |
| Draft UI prefs (`forms/`) | Toast queue |
| Timer fields in `game.store.ts` | Chart hover/selection |
| `idempotencyKey` until batch ACK | Ephemeral `.data.ts` fields |
| Completed-but-unsent batches (`outbox`) | — |

`lib/client/alpine/` configures the persist plugin (namespace prefix) — not individual store keys.

**Schema evolution:** **additive-only is the discipline** — extend persisted shapes, never remove or rename incompatibly (D89). No heavyweight `schemaVersion` machinery. As a safety valve for the rare unavoidable *incompatible* change, each persisted store carries a single `_v` integer and discards its own state on mismatch in `init()` (D91). Additive changes never bump `_v`; only a genuinely breaking shape change does. This keeps the additive-only rule as the norm while preventing a stale store from rehydrating into incompatible code. <!-- 2026-07-14 -->

---

# Recovery & Auto-Cleanup

The client owns session-progress persistence (D67, D88). Setup and play share one helper — `app/src/lib/game/session-recovery.ts` (`reconcileActiveSession`) — identical decision table, no page-specific variants (D118).

| Condition | Returned `action` | Caller behavior |
| --------- | ----------------- | --------------- |
| Server `ACTIVE` + local `sessionId` **matches** | `"match"` | Resume path. Setup: Continue/Abandon modal. Play: keep store, resume silently. Store untouched. |
| Server `ACTIVE` + local missing / `sessionId` **mismatch**, auto-abandon `PATCH` succeeds | `"no_active"` | Helper already `store.reset()`. Caller shows empty state. **No dialog on either page.** |
| Server `ACTIVE` + mismatch, auto-abandon `PATCH` **fails** | `"abandon_failed"` | Store untouched. Block session creation; offer retry. Never treat as `"no_active"` (orphan still `ACTIVE`; create would violate `uq_sessions_single_active`). |
| Local present, no server `ACTIVE` | `"no_active"` | Helper `store.reset()` (stale local). |
| Both empty | `"no_active"` | No store change. |

Match vs mismatch: Continue/Abandon on **match** is intentional user choice for an agreed in-progress session — allowed. Mismatch never shows a dialog (auto-abandon only). Server DB orphans remain server responsibility (future sweep). See `00-Overview.md` state model. <!-- 2026-07-17 -->

---

# Completed-Batch Outbox

Recovery above governs the **active** session. A **completed** session whose batch upload fails (offline, `503`) must not be lost between "game finished" and "server confirmed" — the one client-side data loss we actively prevent.

**Default (D90):** On session completion the assembled `EventsBatchRequest` moves from `game.store.ts` into a persisted `outbox` store, carrying the `Idempotency-Key` minted at session-complete (`04-Modules-And-OOP.md` key ownership). Upload is attempted immediately with a few backoff retries; on persistent failure the entry stays queued.

| Condition | Action |
| --------- | ------ |
| Upload succeeds (or same-key/same-hash stored result) | Remove entry from `outbox` |
| Upload fails after retries | Keep entry; show passive **"unsaved — will retry"** indicator |
| Next app load / `online` event | Auto-retry all queued entries with their stored keys |
| Retryable error only (`503`) | Retry with the **same** `Idempotency-Key`; never re-mint |

The stable key makes retries safe: a batch the server already persisted but never acknowledged returns its stored result on retry, and the client dequeues (D90). Removal happens **only** on confirmed success — never blind discard. localStorage backs the `outbox` in v1; if queue depth ever grows, only the `outbox` store migrates to IndexedDB (unchanged elsewhere).

**Score Training exception (D119):** v1 play completion uses a synchronous hard-gate instead of outbox enqueue — Back / Play again stay disabled until batch POST and `PATCH COMPLETED` both succeed (`completionStatus === "succeeded"`; `409 SESSION_ALREADY_COMPLETED` counts as success). Results render as a play-page modal from a component-local snapshot (no dedicated `/results` navigation). Do not generalize this hard-gate to other games without a new decision. <!-- 2026-07-17 -->

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
| `x-bind:*` / `x-on:*` (when shorthand works) | Use `:attr` / `@event` (Alpine v3) |
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
