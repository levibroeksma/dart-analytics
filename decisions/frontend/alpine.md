<!--
status: canonical
scope: decisions/frontend/alpine
read-when: why an Alpine store/persist/recovery choice was made
load-when: Alpine, stores, state, persist, recovery, x-data, x-show, outbox, x-init, idempotency, auth gate, session recovery
depends-on: decisions/architecture.md, decisions/frontend/architecture.md
related: decisions/frontend/astro.md, decisions/api.md
updated: 2026-08-11
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

### D187 — Hold UI module instances off the Alpine reactive object
Status: Accepted · Date: 2026-08-07
Decision: An Alpine factory that drives a `modules/ui/*` class keeps the instance in the factory closure, never on `this.*`. The registered `Alpine.data()` name matches the factory call in markup (`toggle`), and the factory file lives under `lib/<domain>/` (`lib/ui/toggle.data.ts`), not in `lib/client/alpine/` which holds only the entry factory and registrars.
Reason: Alpine deep-proxies reactive state, and an ES private field throws when read through a Proxy, so `mount()` / `layout()` never ran and the Toggle pill stayed 0×0. A mismatched registration name fails the same way, silently.
Consequences: `modules/ui` classes are unit-tested with an explicit Proxy guard that documents the hazard. `x-modelable` still exposes scalar reactive fields (`activeTab`), so parent `x-model` binding is unaffected. The Toggle's paired `.astro` deliberately sits in `components/layout/games/setup/` rather than `components/ui/` because it uses app `tab-*` tokens — the same one-directional reading of the pairing rule that `segment-timer.module.ts` already relies on.

### D206 — Throwing-hand preference is a local `$persist` store, not `player_settings`
Status: Accepted · Date: 2026-08-11
Decision: The player's throwing hand (`Handedness`, already a `boardInput()` option per D199) is read from a new `boardInput` Alpine store (`stores/board-input.store.ts`, one `$persist` field, `PersistFactory` per D120) rather than added to the server-backed `player_settings`/`v_player_settings` pair. `board-input.data.ts`'s `freshController` now passes `$store.boardInput.handedness` into `boardInput()` instead of relying on its `"RIGHT"` default, and a new `HandednessForm.astro` on the profile page writes the store directly.
Reason: Which side the magnifier opens on is a per-device rendering preference — it does not describe gameplay, need not sync across devices, and has no server read path today. Routing it through `player_settings` would mean a new migration, endpoint contract bump, service/repository change and view column for a value only the client ever consumes, for no behavioural gain over `$persist`.
Consequences: Handedness does not follow a player across devices (matches D77/D86's `forms/`-as-substitute precedent for pre-`player_settings` local prefs). If a future need for cross-device sync emerges, migrating this one field into `player_settings` is a small, isolated change against an established pattern (`settings.store.ts`/`AppModeForm.astro`) — not a reason to default there now.

### D233 — Unify the dart-preview reveal timer across input modes
Status: Accepted · Date: 2026-08-26
Decision: `play-lifecycle.ts`'s reveal-then-clear timer (`playCommitDart`) no
longer branches on `inputModeKey`. Every input mode gets the same 1500ms
delay between a visit resolving and its preview clearing. Bob's 27's
previously independent, hand-rolled copy of this same timer is deleted; it
now delegates to `play-lifecycle.ts` like every other per-dart game mode.
Reason: the branch's non-`VISUAL_BOARD` path set `hiddenTurnKey` in the same
tick the 3rd dart was recorded, before Alpine's reactive effects repaint —
so tap/keypad input (the recreational entry path for Bob's 27, Singles
Training, Doubles Training, Shanghai, and Around the Clock) never actually
rendered the 3rd dart's preview. This was an accidental divergence between
input modes, not a deliberate design choice.
Consequences: every per-dart game mode's preview now behaves identically
regardless of input mode or seat count. `playPreviewSegments()` (a new
shared export alongside the timer) replaces 3 duplicated segment-computation
functions and reshapes the pre-existing shared `doublesPathPreviewSegments`
helper onto the same gate. See Pattern 19,
`docs/architecture/04-Architecture-patterns.md`.
