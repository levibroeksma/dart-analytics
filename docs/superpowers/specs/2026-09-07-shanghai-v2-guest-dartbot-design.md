<!--
status: canonical
scope: shanghai-v2-guest-dartbot-design
read-when: implementing or reviewing Shanghai V2's 2-seat (guest/DartBot) admission
updated: 2026-09-07
-->

# Shanghai V2 — Admit Guest/DartBot Seats (Hard Mode Applies 1v1) — Design Spec

## Summary

Fixes issue #237: a player who selects Hard mode ("Target Needed") and then adds
a DartBot or human guest opponent sees the Hard toggle stay selected in the UI,
but the session silently creates under `SHANGHAI_V1` (no `difficulty` field at
all), so a missed round never halves the score. Root cause: `SHANGHAI_V2` was
never wired into `SEAT_CAPS`/`RULESET_DARTBOT`, so a 2-seat `SHANGHAI_V2`
session 422s at `createSession`; a prior task (closing finding F45) worked
around that by routing any guested Shanghai session back to `SHANGHAI_V1`
instead of fixing the seat-cap gap, silently narrowing D245's stated intent
("creates `SHANGHAI_V2` sessions rather than `SHANGHAI_V1`" — unconditionally).

This spec wires `SHANGHAI_V2` for a 2nd seat (guest or DartBot) and removes the
`SHANGHAI_V1` fallback entirely, restoring D245's original, unconditional
intent. No engine change: `ShanghaiEngine`/`foldShanghaiState` already fold
Hard-mode halving per seat for any seat count (`difficultyOf(config)` reads one
config-level `difficulty`, shared by every seat; `foldSeatStates` applies it
identically to each). No `SHANGHAI_V1` change: existing/resumed V1 sessions are
untouched.

## Scope

- Both DartBot 1v1 and human-guest 1v1 gain Hard mode — the seat-cap gap isn't
  opponent-specific, and a human 1v1 hits the exact same silent-drop bug the
  issue reports for DartBot. (Confirmed with the user during brainstorming.)
- Singles Training has the identical gap (already logged as `FINDINGS.md` F69)
  — out of scope here; the issue named Shanghai only.
- `SHANGHAI_V1` itself, already-created/resumable V1 sessions, and the Shanghai
  game card's routing (`games-visibility.ts` — stays pointed at `SHANGHAI_V1`
  by established `121_V2`/Singles V2 precedent, since the card only gates
  capability-based visibility and both versions declare identical capability
  pairs) are all unchanged.

## Changes

### `app/src/lib/game/rulesets/capabilities.ts`

- `RULESET_DARTBOT` gains `SHANGHAI_V2: true`.
- The doc comment above `RULESET_DARTBOT` currently states "Shanghai V2 and
  Singles Training V2 can never create *any* 2-seat session today ... that gap
  is explicitly deferred, not this map's to route around" — correct this to
  name only Singles Training V2 as still gapped (citing F69 in place of the
  stale F45 reference), since Shanghai V2 no longer has the gap after this
  change.

### `app/src/services/session-seats.service.ts`

- `SEAT_CAPS` gains `SHANGHAI_V2: 2`.
- Its doc comment's seat-cap-holder count ("the other eight are wired for
  exactly one opponent (1v1)") becomes nine.

### `app/src/lib/game/shanghai-setup.data.ts`

- Delete the `guested()` helper and the `rulesetVersionKey: (ctx) =>
  guested(ctx) ? "SHANGHAI_V1" : "SHANGHAI_V2"` branch — every new session is
  `SHANGHAI_V2`, unconditionally (restoring D245's original shape).
- `configOverrides` becomes the unconditional `(ctx) => ({ difficulty:
  ctx.difficulty })` (drop the `guested(ctx) ? {} : ...` branch).
- Delete the `addGuest`/`addBot` overrides that reset `this.difficulty =
  "NORMAL"` on add — Hard mode must now survive a guest/bot being seated, so
  the reset is the exact behavior being removed. `shanghaiSetup()` no longer
  needs to override `addGuest`/`addBot` at all; it falls through to
  `createPresetSetupController`'s own unmodified implementations.

### `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`

- Revert the `x-show="guests.length < 1 && !bot"` / `x-cloak` guard added on
  the difficulty `SettingSectionShell` by the prior (superseded) fix — the
  toggle is visible and selectable regardless of opponent, and now always
  reflects what will actually apply.
- `allowDartbot={supportsDartbot("SHANGHAI_V1")}` → `supportsDartbot("SHANGHAI_V2")`.

## Test changes

- `app/tests/lib/game/rulesets/capabilities.test.ts`: `supportsDartbot("SHANGHAI_V2")`
  flips from `false` to `true`; split the combined "rejects Shanghai V2 and
  Singles V2 (F45)" test so Shanghai V2's half becomes an "accepts" assertion
  and Singles V2's half keeps its own (still-true) rejection, re-pointed at F69
  instead of F45.
- `app/tests/services/session-seats.service.test.ts`: the test titled "rejects
  a DARTBOT seat for Shanghai V2, whose 1v1 seating is already broken (F45)"
  is deleted and replaced with an assertion that `rejectSeatRequest([player,
  bot], "SHANGHAI_V2")` is `null`; add a seat-cap assertion (3 seats rejected
  for `SHANGHAI_V2`) alongside the existing `SHANGHAI_V1`/`BOBS27_V1` cap
  tests, for parity.
- `app/tests/lib/game/shanghai-setup.data.test.ts`: delete the two tests
  asserting the old contract ("resolves SHANGHAI_V1 and forces difficulty back
  to NORMAL once a guest is added" / "...once a DartBot is seated" — per root
  `CLAUDE.md`'s test-invariant rule, these assert a guarantee this task
  deliberately removes, so they're deleted rather than repointed). Add tests
  for the new contract: adding a guest, then choosing Hard, then `start()`
  creates a `SHANGHAI_V2` session with `overrides: { difficulty: "HARD" }` and
  a `configSnapshot` carrying `difficulty: "HARD"`; same for a DartBot seat;
  and a solo-session regression check that `SHANGHAI_V2` + `NORMAL` (today's
  passing default-difficulty test) is unaffected.
- No engine test changes: `shanghai.engine.module.test.ts`'s existing Hard-mode
  coverage already exercises multi-seat folding at the pure-function level
  (`foldShanghaiState` takes `config.seats` generically); nothing there assumed
  a single-seat-only `SHANGHAI_V2`.

## Decision ledger

Append one new decision to `decisions/game-engine.md` (next id derived at
commit time via `DECISIONS.md`'s own command — `D259` as of this writing)
recording: `SHANGHAI_V2` now admits a 2nd seat (guest or DartBot), completing
D245's original unconditional-V2 intent rather than reversing it; the earlier
guested-session V1 fallback (which closed F45 without its own decision entry)
is removed. Not a `Supersedes:` of D245 — D245's own text already specified
unconditional `SHANGHAI_V2` creation; this decision documents fixing the seat
admission gap that made the fallback seem necessary and removing that
fallback.

## Out of scope / unaffected

- Migrations/seeds: none needed. `SHANGHAI_V2`'s `ruleset_versions` row
  (`database/seeds/0012_shanghai_v2_game_engine_reference.sql`) and its
  capability rows already exist; seat-count admission is an app-level map
  (`SEAT_CAPS`), not a DB constraint.
- `ShanghaiEngine`, `foldShanghaiState`, `applyShanghaiDart`: unchanged —
  already seat-count-agnostic.
- `shanghai-play.data.ts`: unchanged — `RESUMABLE_RULESET_VERSIONS` already
  lists both versions, and its DartBot-turn wiring keys off the active seat's
  `participantTypeKey`, not the ruleset version.
- `docs/game-rules/rulesets/shanghai.md`, the 2026-08-28 V2 design spec: no
  rule changed, only seat admission; left as-is (the latter is a historical
  record per `docs/CLAUDE.md`).
