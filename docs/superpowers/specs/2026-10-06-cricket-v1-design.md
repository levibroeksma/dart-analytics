# Cricket V1 — design

Date: 2026-10-06
Input: `docs/game-rules/rulesets/cricket.md` (rules, V1 cut, defer list)
Precedent: `BOBS27_V1` (`app/src/modules/game/bobs27.engine.module.ts`), the
reference exemplar named by `docs/architecture/07-Frontend/09-Adding-A-Game.md`

## 1. Scope

New game type `CRICKET`, ruleset `CRICKET_V1`, standalone game with setup,
play and result screens. Solo only: a **close-out efficiency drill** — close
20, 19, 18, 17, 16, 15 and Bull in as few darts as possible. No points, no
win/loss, no opponent.

Resolves the rules file's open question "exact single-player practice win
condition": there is none. A solo run is complete when all seven objectives
are closed; the result is a measure, not a verdict.

Out of scope (V2+ in the rules file): multiplayer, points / own-score-on, dead
numbers, the multiplayer win rule, Cut-throat, a Cricket-specific statistics
view and trend section, a shared marks engine with Tactics.

No migration. Seeds only.

## 2. Persistence

- **Capture/input mode:** `RECREATIONAL` + `DETAILED_DARTS` and `ANALYTICS` +
  `VISUAL_BOARD` — the same two pairs as every other per-dart game
  (`app/src/lib/game/rulesets/capabilities.ts`). `QUICK_SCORE` cannot carry
  the game: a mark is read off the dart's number and ring.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`) for the whole
  game. No stage per objective; all seven are live at once.
- **`turns`:** one per visit, up to 3 darts. `completedAt` stamped by the
  visit's 3rd dart, or by the dart that closes the 7th objective (the visit
  then holds 1–3 darts).
- **`darts`:** `intendedTargetNumber` and `intendedZoneKey` both `null` — a
  visit has no single required target, so any stored intent would be
  invented. `score` = the dart's board score (T20 = 60, outer bull = 25, inner
  bull = 50, miss = 0), never marks or Cricket points.
- **Derived, never stored:** marks per objective, closed set, effective marks,
  MPR, darts-to-close per objective, completion.
- **Stats tags:** `["board"]`. Not `intent-stored` (null intent), not
  `intent-derived` or `target-sequence` (no fixed path to recover an aim
  from).

## 3. Engine — `cricket.engine.module.ts`

Shaped on Bob's 27: seat-aware from day one (`Seated<CricketSnapshot>`,
`foldSeatStates`, `stageOwnership: "PER_SEAT"`), one seat locked in V1. A
solo session is one seat — no branch anywhere in the engine. Multiplayer (V2)
then adds seating and scoring, not a rewrite.

**Objectives:** engine constant `[20, 19, 18, 17, 16, 15, BULL]`. Not config.

**Seat state:**

| Field | Meaning |
| --- | --- |
| `marks` | per objective, 0–3, capped |
| `dartsThrown` | count of darts folded for this seat |
| `dartsThisVisit` | darts in the open visit |
| `closedAtDart` | per objective, `dartsThrown` value when its 3rd mark landed; `null` while open |
| `status` | `IN_PROGRESS` \| `COMPLETE` |

**`applyCricketDart(state, observation)`** — pure reducer:

| Dart | Marks |
| --- | --- |
| single 15–20 | 1 |
| double 15–20 | 2 |
| treble 15–20 | 3 |
| outer bull | 1 |
| inner bull | 2 |
| 1–14, miss | 0 |

- Marks add to the objective, capped at 3. Overflow is discarded (V1 has no
  points).
- A hit on a closed objective adds nothing.
- Every dart increments `dartsThrown`, scoring or not.
- The dart that closes the last open objective sets `COMPLETE` immediately —
  on dart 1, 2 or 3 of the visit.
- Throws when `status` is `COMPLETE`; undo first.

**Engine class:** `record`, `undo`, `wouldComplete`, `isComplete`, `state`,
`facts`, per the `GameEngine` contract (`04-Architecture-patterns.md` Pattern
18). `record` validates against derived state before writing, so a throw
leaves the fact log untouched. `wouldComplete(obs)` is true iff the dart
closes the last open objective. `undo` pops the last dart and clears
`completedAt` on a surviving visit (`undoLastDart`). Constructor replays
`prior` facts.

**Result (derived):**

| Measure | Definition |
| --- | --- |
| Darts thrown | `dartsThrown` |
| Effective marks | Σ marks per objective after the cap — max 21 |
| MPR | effective marks ÷ darts thrown × 3 |
| Darts to close | `closedAtDart` per objective |

## 4. Data, config, validation

- **Seed `database/seeds/0033_cricket_game_engine_reference.sql`**, shaped on
  `0010`/`0027`: `game_types` row `CRICKET` (next id in the `0198f000-*`
  range), `ruleset_versions` row `CRICKET_V1` (next `0198f100-*`), one empty
  `configuration_templates` preset (next `0198f300-*`), its
  `game_type_features` rows. Plus `database/verification/0033_*`.
- **Capabilities:** two `CRICKET_V1` rows appended to
  `seeds/0007_ruleset_version_capabilities.sql` (and its verification),
  mirroring `RULESET_CAPABILITIES`; `STATS_TAGS.CRICKET_V1 = ["board"]`;
  `GAME_TYPE_BY_RULESET.CRICKET_V1 = "CRICKET"`.
- **Config:** `CricketConfig` — `.strict()` Zod object in
  `lib/game/rulesets/types.ts` with no keys. `CricketSnapshot = {}`, seated
  via `Seated<…>`. A drifted key fails the session.
- **Validator:** `services/rulesets/cricket/cricket.validator.ts` — a
  `createThreeDartValidator` call (`label: "Cricket"`), composed (wrapped, not
  forked) to also reject: a dart with a non-null intent field; a visit after
  the visit that closed the 7th objective, or darts after the closing dart.
  Registered in `services/rulesets/registry.ts` in the same commit as the
  engine (`scripts/check-game-engines.sh`).
- **Slugs:** route `cricket`, code `cricket`, ruleset key `CRICKET_V1`.

## 5. UI

Full touch list of `09-Adding-A-Game.md`; check `08-Component-Inventory.md`
before writing markup.

- **Setup:** `lib/game/cricket-setup.data.ts` — `createPresetSetupController`
  (`gameTypeKey: "CRICKET"`, `label: "Cricket"`). `CricketSetupForm.astro`
  shows the three presets locked: Players = 1 (solo practice), Objectives =
  20–15 + Bull, Variant = Classic.
- **Play:** `lib/game/cricket-play.data.ts` + `interfaces/Cricket.astro` — a
  seven-row board, mark glyphs `/` `X` `Ⓧ` per objective, closed rows dimmed,
  darts thrown. Existing DETAILED_DARTS keypad / VISUAL_BOARD input by mode.
  Undo as in Bob's 27.
- **Result:** `result-modals/CricketResults.astro` — darts thrown, MPR, darts
  to close per objective.
- **Wiring:** `pages/games/cricket/{setup,play}/index.astro`,
  `lib/client/alpine/register-route-data.ts`, the `games-visibility.ts` card.

## 6. Testing

Red → green first (`app/CLAUDE.md` §Test-Driven Development).

- **Engine:** mark table above; cap at 3; hit on closed adds nothing; 1–14 and
  miss count as darts; close-out on dart 1, 2 and 3; record after complete
  throws and leaves facts untouched; undo round-trip incl. reopening a
  completed visit; replay from `prior`; MPR and darts-to-close maths;
  `wouldComplete` true only on the closing dart.
- **Validator:** both mode pairs accepted, others rejected; non-null intent
  rejected; >3 darts rejected; darts after completion rejected.
- **Setup / play controllers.**
- **Shared:** `capabilities.test.ts`, `games-visibility.test.ts`, capability
  parity test.
- **Seed verification SQL.**

## 7. Commit shape

`scripts/check-game-wiring.sh` runs pre-commit on every commit, so the shared
registries (`registry.ts`, `capabilities.ts`, `games-visibility.ts`,
`register-route-data.ts`) and their pages/controllers land in **one commit**.
Engine and validator modules may land earlier only while unregistered.

## 8. Docs and context

- Amend `docs/game-rules/rulesets/cricket.md` (amend mode, targeted edits):
  strike the solo-win open question with its resolution; add VISUAL_BOARD to
  `Capture`; add V2+ rows for the Cricket stats view/trend section.
  `Current version:` bumps only when the implementation ships.
- New block in `decisions/game-engine.md`: solo Cricket is an efficiency drill
  with no win condition.
- `05-Database/10-Database-Agent-Guide.md`, context map, File Inventory as the
  `context-maintenance` skill requires.
