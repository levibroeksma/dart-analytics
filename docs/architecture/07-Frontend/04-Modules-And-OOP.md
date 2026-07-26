<!--
status: canonical
scope: frontend/modules-oop
read-when: game engine, portable UI kit, payload builders
updated: 2026-07-26
-->

# Frontend Modules And OOP

> **Version:** 0.2.0 (GameEngine contract replaces the engine/payload split, 2026-07-26; prior 0.1.2 inline export type/interface anti-pattern, 2026-07-17)
>
> OOP boundaries, portable UI kit, engine vs payload modules, validation split.
>
> Alpine wiring: `03-Alpine-Patterns.md`. Folder layout: `02-Folder-Structure.md`.

---

# Purpose

This document defines where object-oriented code belongs in the frontend, how portable UI primitives are structured, and how client game logic relates to API validation.

---

# OOP Boundary

| Layer | OOP? | Pattern |
| ----- | ---- | ------- |
| `modules/ui/*.module.ts` | **Yes** | `new Timer(opts)`, lifecycle methods |
| `modules/game/*.engine.module.ts` | **Yes** | `GameEngine` contract — one shape for every game (Pattern 18) |
| `modules/game/*.payload.module.ts` | Prefer functions | Assembles typed API payloads; one generic builder, not one per game |
| `stores/`, `forms/`, `*.data.ts` | **No** | Object factories |
| `components/ui/*.astro` | **No** | Markup + Alpine wiring |

Classes are permitted **only** under `src/modules/`.

---

# Constructor & Lifecycle

1. Construction via `new ModuleClass(options)` happens in Alpine factory `init()` — never in Astro frontmatter.
2. Constructor receives plain config and callbacks — no Alpine proxies, no `fetch`, no store imports inside `modules/ui/`.
3. Modules with timers/listeners expose `start()` / `stop()` / `destroy()`.
4. Alpine teardown must call `destroy()` to prevent leaks.

### Timer example (sketch)

```typescript
// modules/ui/timer.module.ts
export class Timer {
  constructor(
    private opts: {
      durationMs: number;
      onTick?: (remainingMs: number) => void;
    },
  ) {}

  start() { /* … */ }
  stop() { /* … */ }
  destroy() { /* … */ }
}
```

Authoritative timer fields (`timerRemainingMs`, etc.) live in `game.store.ts`. The `Timer` class drives intervals against store fields — not the reverse.

---

# Portable UI Kit

Reusable primitives: **timer**, **toast**, **modal**, **chart**.

### Pairing rule

Every `components/ui/<Name>.astro` has exactly one `modules/ui/<name>.module.ts`.

### Portability contract

| Rule | `modules/ui/` + `components/ui/` |
| ---- | ---------------------------------- |
| May import | Paired module, Tailwind utilities |
| Must not import | `@stores`, `@forms`, `@pages`, `@client/api`, `@services`, `@repositories` |
| Styling | Tailwind utilities — no app-specific design tokens |
| Copy-paste | Drop both folders into another Astro+Alpine project; adjust classes |

### Chart peer dependency

The portable kit is **behaviour + markup contract**. `chart.module.ts` may wrap a declared **peer dependency** (e.g. Chart.js). Copy-paste includes noting the peer dep in `package.json` — not zero-dependency.

Alpine wiring for UI components is registered in `register-ui-data.ts`. Modules remain pure TypeScript — no Alpine import.

---

# Game Engine Contract

Every `*.engine.module.ts` implements the same contract (`modules/game/interfaces.ts`), built by a `GameEngineFactory` from a configuration snapshot bound to a `rulesetVersionKey`. Architecture-level statement: `../04-Architecture-patterns.md` Pattern 18.

| Member | Owns |
| ------ | ---- |
| `record(input)` | Folds one observation — a dart or a whole visit — into the fact log; returns the new state |
| `undo()` | Exact inverse of `record()` over `facts()`, including any stage that `record()` opened |
| `wouldComplete(input)` | Pure predicate: would recording this input finish the session? Must not mutate |
| `isComplete()` | Zero-argument — the engine owns its own completion state, never a caller-passed one |
| `state()` | Derived view of the fact log: running score, training points, ratios |
| `facts()` | `EngineFacts` = `StageFact[]` + `TurnFact[]`, the single fact log |
| `create(config, prior)` | Factory member; `prior` is the rehydrate path — persisted facts replay into state |

`wouldComplete()` exists because deciding completion by recording and rolling back is unsafe: 501's `record()` can open a `LEG` stage as well as a turn, so a rollback that pops only the turn leaves an orphan stage behind.

One generic payload module assembles every batch — `events.payload.module.ts`'s `buildEventsBatch(participantRef, facts)`. Stages come from the engine, so 501's `LEG` stages and Score Training's single `EXERCISE_BLOCK` use the same builder with no per-game branch. Payload modules import types from `@client/api/types` only. They never call `@client/api`.

Shared ruleset configuration schemas live in `lib/game/rulesets/` — see `02-Folder-Structure.md`.

---

# Key Ownership

| Key | Owner | Lifecycle |
| --- | ----- | --------- |
| `clientKey` (per turn/dart) | Engine / payload assembly | Minted at fact creation |
| `Idempotency-Key` (batch header) | `game.store.ts` | Minted at session-complete; held until batch ACK |

Pages/forms pass the store-held idempotency key to `@client/api` on `POST .../events/batch`.

---

# Game Engine vs API Validation

| Layer | Owns |
| ----- | ---- |
| `modules/game/` | In-session UX: scoring display, turn flow, dart entry, payload **assembly** |
| API / service | Authoritative validation: ruleset limits, capture-mode matrix (D73), status transitions, idempotency |

The frontend may **predict** rejection for UX. The API response is always the source of truth. Never override or ignore domain error codes.

This preserves D40 (client game engine) without making the frontend the authority on persisted domain rules.

---

# Anti-Patterns

| Anti-pattern | Reason |
| ------------ | ------ |
| Classes in `stores/` or `forms/` | OOP boundary violation |
| `@client/api` in `modules/` | HTTP belongs in pages/forms/stores |
| Alpine import in `modules/` | Factory entrypoint only |
| Portable UI importing `@stores` | Breaks copy-paste contract |
| Duplicating API validation as source of truth | Drift from frozen contract |
| Persisting toast/modal state | Ephemeral UI |
| `export type`/`export interface` declared inline in a `.module.ts` | Belongs in the folder's `types.ts`/`interfaces.ts` barrel (`../06-API/03-Shared-Conventions.md`) |
| Engine accumulates a score/points field instead of folding `facts()` | The derivation survives and the fact is discarded — inverts "store what happened" (Pattern 9) |
| Engine that cannot be rebuilt from persisted facts | Breaks local-first resume (D67/D88); `create(config, prior)` is the rehydrate path |
| Per-game payload module | `events.payload.module.ts` builds every batch; stage assembly belongs to the engine |
| Deciding completion by `record()` then `undo()` | Use `wouldComplete()`; a rollback can strand a stage the record opened |
| Engine hardcodes its rules as module constants | Rules come from the validated config snapshot bound to its ruleset version |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `03-Alpine-Patterns.md` | Stores, forms, factory |
| `02-Folder-Structure.md` | Suffix table |
| `../06-API/04-Endpoint-Contracts.md` | `EventsBatchRequest`, `DartFact` |
| `../06-API/03-Shared-Conventions.md` | Zod `z.infer<>` type rules |
| `10-Frontend-Agent-Guide.md` | Agent quick reference |
