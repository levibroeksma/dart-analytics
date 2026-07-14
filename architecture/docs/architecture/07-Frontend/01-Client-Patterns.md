<!--
status: canonical
scope: frontend/client-conventions
read-when: building Astro pages, components, Alpine stores, or forms
updated: 2026-07-14
-->

# Frontend Client Patterns

> **Version:** 1.0.0 (2026-07-14)
>
> Client-side structure and conventions for the Astro + Alpine frontend in `app/`.
> The API integration seam and state ownership are in `00-Overview.md`.

---

## `.astro` component frontmatter

`BottomNav.astro` and `NavBtn.astro` are **not in conflict** — they are two projections of one latent convention. NavBtn has props and no data list; BottomNav has a data list and no props. Overlaid, a single canonical section order emerges. It is codified, not re-invented; no existing file needs rewriting.

**Canonical frontmatter section order:**

```
1. interface Props { … }          // omitted when the component takes no props
2. // Props     → const { … }: Props = Astro.props
3. imports, grouped & ordered:  // Layouts · // Components · // Icons · // Lib
4. // Data      → local static config arrays (the BottomNav `pages` pattern)
5. // Styles    → className composition / derived display values (NavBtn pattern)
```

Sections that do not apply are omitted (BottomNav skips §1; NavBtn skips §4). Import group headers use the fixed vocabulary above.

---

## Alpine store pattern

Store files are **pure factories**: they receive only the `$persist` function they depend on (not the whole `Alpine` object) and **return** a store object. They never call `Alpine.store()` themselves. All plugin registration and store instantiation is centralized in one file, `lib/app.init.ts`.

Location: `app/src/lib/stores/*.store.ts`. One store per bounded concern.

```ts
// lib/stores/session.store.ts
// `Persist` = the type of Alpine's $persist magic fn; exact type resolved at implementation.

const SESSION_STORE_VERSION = 1;                 // bump on shape change

export function sessionStore(persist: Persist) {
  return {
    _v: persist(SESSION_STORE_VERSION).as('session._v').using(localStorage),
    sessionId: persist<string | null>(null).as('session.id').using(localStorage),
    idempotencyKey: persist<string | null>(null).as('session.idem').using(localStorage),
    // …draft fields
    init()  { if (this._v !== SESSION_STORE_VERSION) this.reset(); },   // discard on drift
    reset() { this.sessionId = null; this.idempotencyKey = null; this._v = SESSION_STORE_VERSION; },
  };
}
```

**Rules:**

- Store files are **DI factories** `xStore(persist)` returning the store object; they never reference the global `Alpine` and never register themselves.
- Every **persisted** store carries `_v` + an `init()` version guard + a `reset()`.
- `.using(...)` **always states the storage backend explicitly** (`localStorage` for v1). This call site is the exact seam for the documented outbox → IndexedDB forward path (`00-Overview.md`) — only the outbox factory changes, nothing else.
- Stores hold **data + intent only** — no rules/scoring logic (that is the engine, a separate pure module in `lib/engine/`).

**Central registration** — one focused file at the `lib/` root registers the plugin and instantiates every store:

```ts
// lib/app.init.ts
import type { Alpine } from 'alpinejs';
import persist from '@alpinejs/persist';
import { sessionStore } from '@stores/session.store';
import { outboxStore }  from '@stores/outbox.store';

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);

  Alpine.store('session', sessionStore(Alpine.$persist));
  Alpine.store('outbox',  outboxStore(Alpine.$persist));
};
```

Wired as the `@astrojs/alpinejs` entrypoint:

```js
// astro.config.mjs
alpinejs({ entrypoint: '/src/lib/app.init' })
```

> **Naming:** the factory is `sessionStore` and the store key is `"session"` (matching the `session.*` persist keys). Do **not** name the factory or key `sessionStorage` — it shadows the `sessionStorage` Web Storage global and reads confusingly next to `.using(localStorage)`.
>
> **Dependency:** `@alpinejs/persist` must be added to `app/package.json` (only `alpinejs` is present today).

---

## Form pattern

Location: `app/src/lib/forms/*.form.ts`. Forms are `Alpine.data` factories.

```ts
// lib/forms/session-setup.form.ts
export function sessionSetupForm() {
  return {
    fields: { /* … */ },
    errors: {} as Record<string, string>,
    submitting: false,
    async submit() {
      this.submitting = true;
      try {
        await api.sessions.create(this.fields);   // typed lib/api wrapper
        // → transition / navigate
      } catch (e) {
        if (e instanceof ApiError) this.errors = mapError(e);
      } finally {
        this.submitting = false;
      }
    },
  };
}
```

**Rules:**

- Forms delegate to a typed `lib/api` wrapper — never call `fetch` directly, never contain business logic.
- Map `ApiError.code` → user messages via one shared map (`mapError`), not per-form strings.
- Forms never assemble the batch payload; the engine owns gameplay payload construction.

---

## Data-file pattern

- Trivial static lists stay **inline** in frontmatter under `// Data` (the BottomNav `pages` array).
- A list that is **reused across components** or larger than ~10 lines moves to a colocated `*.data.ts` exporting a typed `const`:

```ts
// components/layout/nav.data.ts
export const navItems = [ /* … */ ] satisfies NavItem[];
```

---

## Client folder taxonomy

Extends the live scaffold and declares homes for the split-out specs (`engine/`, `auth/`):

```
app/src/
├── components/{ui, layout, game, forms}/
├── layouts/
├── lib/
│   ├── app.init.ts # Alpine entrypoint: registers plugins + instantiates all stores
│   ├── api/       # browser API client (D41): client.ts + per-domain wrappers
│   ├── auth/      # token access            → detailed in the auth spec
│   ├── stores/    # Alpine store factories  (session.store.ts, outbox.store.ts, …)
│   ├── forms/     # Alpine.data form factories
│   ├── engine/    # pure game engine        → detailed in the engine spec
│   └── shared/    # cross-cutting pure utils (nav/is-nav-active, …)
├── pages/
└── icons/
```

`lib/api/` is browser-only (D41/D78); `lib/server/` (Worker helpers) never shares a folder with it.

---

## Implementation-phase checklist (deferred from the docs plan)

These app-config changes are executed with the **first store implementation**, not by the documentation change set (wiring an entrypoint to a not-yet-existing `lib/app.init.ts` would break `astro check`):

- Add `@alpinejs/persist` to `app/package.json` (only `alpinejs` is present today).
- Set `alpinejs({ entrypoint: '/src/lib/app.init' })` in `astro.config.mjs`.
- Add the `@stores/*` → `./src/lib/stores/*` path alias to `app/tsconfig.json` (alongside the existing `@lib/*`, `@components/*`, …).

---

## Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | Frontend state ownership, API integration seam, boundary rules |
| `../06-API/04-Endpoint-Contracts.md` | Frozen `EventsBatchRequest` and response DTOs the client consumes |
| `app/CLAUDE.md` | Operational frontend non-negotiables |
