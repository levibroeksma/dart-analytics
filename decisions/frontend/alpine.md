<!--
status: canonical
scope: decisions/frontend/alpine
read-when: why an Alpine store/persist/recovery choice was made
load-when: Alpine, stores, state, persist, recovery, x-data, x-show, outbox, x-init, idempotency, auth gate, session recovery
depends-on: decisions/architecture.md, decisions/frontend/architecture.md
related: decisions/frontend/astro.md, decisions/api.md
updated: 2026-08-02
-->

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D77 | 2026-07-13 | `player_settings` deferred post-v1: no endpoints; `forms/` persist last-used modes and send them per D60 | Table was unreachable; local persistence covers the need |
| D81 | 2026-07-14 | Alpine `app.factory` entry + `register*(Alpine)`; no `x-init`; `x-data="foo()"`; store factories invoked with `()` | Single Alpine bootstrap; init runs |
| D86 | 2026-07-14 | `$persist` in stores/forms only; timer state in game store; forms = v1 `player_settings` substitute | Predictable persistence |
| D88 | 2026-07-14 | Client recovery: auto-abandon on mismatch/missing local; no manual abandon UI; server owns DB orphan sweeps | Amends D67 UX wording |
| D89 | 2026-07-14 | Persisted schemas additive-only in 0.1.0; no runtime schema versioning | Extend never break |
| D90 | 2026-07-14 | Completed-but-unsent batches held in a persisted `outbox` store; retried on load/`online` with the session-complete `Idempotency-Key`; removed only on confirmed success | Finished gameplay never lost between completion and server ACK |
| D91 | 2026-07-14 | Augments D89: single `_v` integer per persisted store discards on incompatible bump; additive changes never bump it | Safety valve for the rare unavoidable breaking shape change |
| D98 | 2026-07-15 | Client auth gate in `BaseLayout` (`auth.store` `init()` + `x-cloak`) is the load-bearing navigation control for prerendered routes (D97); middleware redirect remains a UX nicety for on-demand routes only | Prerendered shells bypass middleware on this Cloudflare config — client gate prevents nav chrome flash |
| D100 | 2026-07-15 | Alpine v3 shorthand mandatory: `:attr` and `@event` instead of `x-bind:*` / `x-on:*`; `x-on:*` only inside Astro `{}` when linter rejects `@` | Consistent templates; matches Alpine 3 defaults |
| D118 | 2026-07-17 | Shared session recovery helper for setup & play: identical decision table in `app/src/lib/game/session-recovery.ts` (no page-specific variants) reconciles local `sessionId` vs server ACTIVE SCORE_TRAINING session; returns `"match"` \| `"no_active"` \| `"abandon_failed"` — the latter blocks session creation instead of silently resetting (orphan still ACTIVE; create would violate `uq_sessions_single_active`); match shows Continue/Abandon modal on setup only; mismatch never shows a dialog | Single implementation prevents table drift and UX loop where setup re-renders the modal twice |
| D120 | 2026-07-17 | Persisted Alpine stores take a `PersistFactory` (`() => Alpine.$persist`), calling it once per field — never reuse one `persist()` across fields. Alpine's `$persist` getter returns a fresh closure each access; a shared closure collapses every `.as()` key onto the last alias (e.g. `turns` hydrated as `null` from `game.idempotencyKey`) | Root-cause fix for play-page Alpine crashes; documents the plugin's shared-`alias` hazard |
