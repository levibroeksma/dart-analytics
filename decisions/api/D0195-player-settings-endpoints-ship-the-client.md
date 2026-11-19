---
id: D0195
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [api, session, status, error code]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Player settings endpoints ship; the client stops owning last-used modes

## Context and Problem Statement
D60 deferred these endpoints and left the client persisting last-used modes locally, which was workable while capture/input mode was a per-session choice made on the setup screen. The visual board makes it an account-level app mode that the profile screen sets and the games page filters by, so it must survive a device change and be readable by the server — a `localStorage` value cannot be either. Refusing an uncapable pair at write time is what keeps the setting from stranding a player in a mode where every game card is hidden.

## Decision Drivers
* The app mode now gates which games are visible, so a per-device value would disagree across devices (spec Decisions taken, row 8).
* The setting must survive a device change and be readable by the server (record Context, spec row 8).

## Considered Options
* Keep D60's deferral: no settings endpoints, with the client persisting last-used modes locally.
* Ship `GET` and `PATCH /api/players/me/settings` with a server-side `player_settings` row (chosen).

## Decision Outcome
Chosen option: "`GET` and `PATCH /api/players/me/settings` ship as a normal protected route pair. `GET` reads `v_player_settings` (migration `0021`) and falls back to `RECREATIONAL` + `QUICK_SCORE` when the player has no row or either stored mode id is NULL; `PATCH` replaces both modes and creates the row lazily on first write, with no backfill. `PATCH` refuses a capture/input pair no ruleset version declares, returning `VALIDATION_FAILED` with the rejected pair in `error.details.reason` — the service asks `capableRulesets()` (`app/src/lib/game/rulesets/capabilities.ts`), the same declaration migration `0020`'s composite foreign key enforces on `exercise_sessions`. The service returns `ServiceResult { ok, code, details }` rather than throwing, matching `session.service.ts`. No new error code is introduced. Settings stay defaults only: read at session start, copied onto the session, never rewriting history.".

### Consequences
`06-Spec/03-Player-Layer.md`'s `player_settings` section moves from "v1 status: deferred" to shipped, and `DECISIONS.md`'s Deferred list loses its `player_settings endpoints` entry. The `players` domain now has a `me` sub-resource; `PATCH /api/players/me` (rename, D76) remains deferred and is unaffected. `PlayerSettingsResponse` omits the view's `player_id` and `updated_at` — the caller is always `me` and no client reads the timestamp — so widening it later is additive. A player whose stored pair stops being capable (a ruleset version dropping a mode) is not migrated: `GET` still returns the stored pair, and only the next `PATCH` is refused.
* Good, because a player who never opens the settings form keeps today's behavior: no settings row reads as `RECREATIONAL` + `QUICK_SCORE`, and no backfill migration runs.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/rulesets/capabilities.test.ts` covers the capability declaration the service reads. `app/tests/services/settings.service.test.ts` covers the default fallbacks and the write path.

## Pros and Cons of the Options
### Keep D60's local persistence
* Bad, because a per-device value disagrees across devices once it gates game visibility.

### Ship the settings endpoints
* Good, because the mode survives a device change and the server can read it.

## Evidence / More Information
Decided: 2026-08-08
Supersedes: D60 — only its deferral clause (the client-owns-last-used-modes arrangement recorded against it). D60's own rule stands unchanged: `POST /api/sessions` still requires `captureModeKey` + `inputModeKey` on every request, and settings are only the values the client defaults those fields to.


* `docs/superpowers/specs/2026-08-05-visual-board-input-design.md` (Decisions taken, row 8, which supersedes D60's deferral clause; API; Edge cases): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-08-05-visual-board-capability-and-settings.md` (Task 12; capability and settings tasks): rebuilt Confirmation.
* Commit `70d5b5e7` (PR #75, 2026-08-09): added the D195 block and the settings implementation.
