# Tactics V1 — design

Date: 2026-10-06
Input: `docs/game-rules/rulesets/tactics.md` (rules, V1 cut, defer list)
Precedent: Cricket V1 (`docs/superpowers/specs/2026-10-06-cricket-v1-design.md`,
`app/src/modules/game/cricket.engine.module.ts`)

## 1. Scope

New game type `TACTICS`, ruleset `TACTICS_V1`, standalone game with setup,
play and result screens. Solo only: a **close-out efficiency drill** — close
20, 19, 18, 17, 16, 15, Bull, Doubles and Triples in as few darts as possible.
No points, no win/loss, no opponent.

Resolves the rules file's open question "exact single-player practice win
condition": there is none, as for Cricket (D421).

Decided in design:

- **Dual-purpose is an auto rule in V1.** A double or treble on 15–20 marks
  its number while the number is open; once the number is closed it marks the
  Doubles / Triples category. The player choice moves to V2+ with Multiplayer.
  With no points, the rule is never worse than the choice: an open number
  takes 2–3 marks from the dart, a category 1, and Slop lets any other
  double/treble feed the category. Derived from dart facts alone — no
  migration.
- **The bull is never a D/T hit.** Inner bull marks Bull only; Doubles and
  Triples are fed by rings on 1–20.
- **Shared marks core.** Cricket's pure mark/close fold moves to a shared
  module; Cricket and Tactics each supply their objective list and a
  `marksOf` mapper.

Out of scope (V2+ in the rules file): multiplayer, points / own-score-on,
dead numbers, the multiplayer win rule, player-chosen dual-purpose, Strict,
Cut-throat, a Tactics statistics view.

No migration. Seeds only.

## 2. Persistence

- **Capture/input mode:** `RECREATIONAL` + `DETAILED_DARTS` and `ANALYTICS` +
  `VISUAL_BOARD`, as Cricket. `QUICK_SCORE` cannot carry the game.
- **Stage type:** one `EXERCISE_BLOCK` (`exerciseBlockStage()`).
- **`turns`:** one per visit, up to 3 darts. `completedAt` stamped by the
  visit's 3rd dart, or by the dart that closes the 9th objective.
- **`darts`:** `intendedTargetNumber` and `intendedZoneKey` both `null`.
  `score` = board score (T20 = 60, outer bull = 25, inner bull = 50,
  miss = 0), never marks.
- **Dual-purpose:** not stored. Which objective a dart marked is folded from
  the dart and the marks state before it.
- **Derived, never stored:** marks per objective, closed set, effective
  marks, MPR, darts-to-close, completion.
- **Stats tags:** `["board"]`.

## 3. Engine

### 3.1 Shared core — `marks-close.module.ts`

Extracted from `cricket.engine.module.ts`, behaviour unchanged:

- `MarksSeatState` — `participantRef`, `sideKey`, `marks[]`,
  `closedAtDart[]`, `dartsThrown`, `dartsThisVisit`, `status`.
  `CricketSeatState` and `TacticsSeatState` alias it.
- `initialMarksSeat(seat, objectiveCount)`.
- `applyMarksDart(state, hit)` — `hit` is `{ objectiveIndex, marks } | null`;
  cap at 3, `closedAtDart`, completion on any dart of the visit, visit
  counter, throw when complete. The mapper runs before it, against `state`.
- `effectiveMarks`, `marksPerRound`.

Cricket keeps `CRICKET_OBJECTIVES`, `cricketMarksOf`, `applyCricketDart`
(now `applyMarksDart(state, cricketMarksOf(obs))`), its fold and engine
class. Its tests stay as they are and must stay green — the refactor's proof.

### 3.2 `tactics.engine.module.ts`

**Objectives:** `[20, 19, 18, 17, 16, 15, BULL, DOUBLES, TRIPLES]`. Engine
constant, not config.

**`tacticsMarksOf(state, observation)`:**

| Dart | Marks |
| --- | --- |
| outer bull | Bull +1 |
| inner bull | Bull +2 |
| single 15–20 | number +1 |
| double 15–20, number open | number +2 |
| treble 15–20, number open | number +3 |
| double 15–20, number closed | Doubles +1 |
| treble 15–20, number closed | Triples +1 |
| double 1–14 | Doubles +1 |
| treble 1–14 | Triples +1 |
| single 1–14, miss | — |

A hit on a closed objective adds nothing (core rule), so a T20 with 20 and
Triples both closed is a dart with no marks.

**Engine class:** `record`, `undo`, `wouldComplete`, `isComplete`, `state`,
`facts` per Pattern 18, shaped exactly on `CricketEngine`; seat-aware
(`Seated<TacticsSnapshot>`, `foldSeatStates`, `PER_SEAT`), one seat in V1.

**Result (derived):** darts thrown; effective marks (max 27); MPR; darts to
close per objective.

## 4. Data, config, validation

- **Seed `database/seeds/0034_tactics_game_engine_reference.sql`**, shaped
  on `0033`: `game_types` `TACTICS` (`0198f000-…-00000000000b`),
  `ruleset_versions` `TACTICS_V1` (`0198f100-…-000000000016`), one empty
  `configuration_templates` preset (`0198f300-…-000000000018`), no
  `game_type_features` rows. Plus `database/verification/0034_*`.
- **Capabilities:** two `TACTICS_V1` rows in
  `seeds/0007_ruleset_version_capabilities.sql` (+ verification);
  `STATS_TAGS.TACTICS_V1 = ["board"]`; `GAME_TYPE_BY_RULESET.TACTICS_V1 =
  "TACTICS"`.
- **Config:** `TacticsConfig` — `.strict()` Zod object, no keys.
  `TacticsSnapshot = {}`.
- **Validator:** `services/rulesets/tactics/tactics.validator.ts` — as
  Cricket's: `createThreeDartValidator` (`label: "Tactics"`), wrapped to
  reject non-null intent and >3 darts per turn. Registered in
  `services/rulesets/registry.ts` with the engine.
- **Stats / replay:** `lib/stats/constants.ts` (`"TACTICS_V1"`),
  `replay-fold.ts` (engine import), `replay-presenters.ts` (`TACTICS`
  presenter), `section-registry.ts` (`TACTICS: null` + doc table row).
- **Slugs:** route `tactics`, code `tactics`, ruleset key `TACTICS_V1`.

## 5. UI

Touch list of `09-Adding-A-Game.md`; check `08-Component-Inventory.md`
first. Reuse Cricket's components where they generalise over the objective
list rather than forking them.

- **Setup:** `lib/game/tactics-setup.data.ts` (`createPresetSetupController`,
  `gameTypeKey: "TACTICS"`). Presets shown locked: Players = 1, Objectives =
  20–15, Bull, Doubles, Triples, D/T rule = Slop.
- **Play:** nine-row board, mark glyphs as Cricket, closed rows dimmed, darts
  thrown. Tactics gets its own `TacticsRecreationalInput.astro` and
  `interfaces/Tactics.astro`: Cricket's are bound to `cricket*` names, so
  generalising them would edit shipped Cricket UI for no gain. Input under
  DETAILED_DARTS: the D / T modifier reveals 14…1 in the tap grid; with no
  modifier the grid is 20–15 + Bull (a single on 1–14 is entered as Miss, as
  Cricket). `BoardInputPanel` under VISUAL_BOARD. Undo as Cricket.
- **Result:** `result-modals/TacticsResults.astro` — darts thrown, MPR,
  darts to close per objective.
- **Wiring:** `pages/games/tactics/{setup,play}/index.astro`,
  `register-route-data.ts`, `games-visibility.ts` card.

## 6. Testing

Red → green first (`app/CLAUDE.md` §Test-Driven Development).

- **Core extraction:** existing Cricket engine tests unchanged and green.
- **Tactics engine:** every row of the mark table; auto rule both sides of
  the number closing (incl. a closing double whose overflow is discarded, not
  sent to Doubles); bull never feeds D/T; cap; hit on closed adds nothing;
  close-out on dart 1, 2, 3; record after complete throws, facts untouched;
  undo round-trip; replay from `prior`; MPR / darts-to-close maths;
  `wouldComplete`.
- **Validator:** mode pairs; non-null intent; >3 darts.
- **Setup / play controllers; shared registry tests; seed verification.**

## 7. Commit shape

Core extraction first, own commit, Cricket green. Engine and validator may
land unregistered. Shared registries and their pages/controllers in one
commit (`scripts/check-game-wiring.sh`).

## 8. Docs and context

- Amend `docs/game-rules/rulesets/tactics.md` (amend mode): strike the
  solo-win open question; move "Dual-purpose choice" to V2+ (depends on
  Multiplayer) and add a V1 "Dual-purpose auto rule" row; state bull is not a
  D/T hit; add VISUAL_BOARD and drop the "choice recorded alongside the
  visit" line from `Capture`; V2+ row for a Tactics stats view.
- New block in `decisions/game-engine.md` (D422): solo Tactics is a close-out
  drill; dual-purpose is an auto rule until Multiplayer.
- Database agent guide, context map, File Inventory per `context-maintenance`.
