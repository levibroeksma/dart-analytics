# 501 V2 Match Formats — Architecture Design

> **Date:** 2026-10-10
> **Status:** approved (brainstorming consensus)
> **Branch:** `docs/501-v2-rules`
> **Rules input:** `docs/game-rules/rulesets/501.md` (V2 rows scheduled 2026-10-10, commit 9decec3)
> **Scope:** ruleset version `501_V2` — best of N (odd N), sets (first to / best of S, legs per set), win by 2 legs with a configurable sudden-death cap, deciding-set margin scope, per-set throw rotation. Engine, stage tree, seat rota, undo, seed, stats fold, setup/play/results UI.
> **Out of scope:** alternate in/out rules (Double in, Master in, Master out, Straight / open out — stay `V2+`); deciding leg 1's starter by a bull throw; SQL views that group legs by set.

---

## Context

501 V1 (`five-oh-one.engine.module.ts`) plays first to N legs. Every leg is a root `LEG` stage whose `sequence` is its position in the match (`legStage`, :33-42); `foldFiveOhOneState` (:241-270) counts `legsWon >= legsToWin`; `wouldComplete` (:582-612) hard-codes the same test; the SHARED seat rota starts leg L on seat L (`seat-rota.module.ts:79-85`).

What already exists for V2:

- `SET` and `MATCH` stage types are seeded (`database/seeds/0001_reference_data.sql`, ids 2 and 1).
- `exercise_stages.parent_stage_id` nests stages (`database/migrations/0005_runtime_core.sql`); sibling `sequence` is unique per (session, parent), root `sequence` per session (`0011_ordering_and_uniqueness.sql:17-25`), so a per-set restart is legal.
- The write path accepts `parentClientKey`, resolved within the batch (`pages/api/sessions/types.ts:141-147`, `session.service.ts:507-513, 615-619`). No engine emits a non-null parent yet.
- `v_replay_stages` (0046) and `replay.module.ts:26-47` are already tree-shaped.
- Second ruleset versions ship as a seed, never a migration (`0012_shanghai_v2_game_engine_reference.sql:55-69`; capability rows appended to `0007`), with one engine class taking a version argument (`shanghai.engine.module.ts:403-406`).

---

## Decisions taken in brainstorming

1. **Best of N is odd only** — a label for first to (N+1)/2; a match is never drawn, at any side count.
2. **Win by 2 legs** is optional and bounded by a **sudden-death cap X** (configurable, default target + 2, never below the target): the first side to X + 1 legs wins the race, margin or not.
3. **Margin scope** with sets on is the player's pick: every set, or the deciding set only.
4. **Per-set throw rotation:** set k's first leg opens on seat k; legs inside a set rotate from there.
5. **Storage (option 1 of 3):** each set is a `SET` stage; its legs are child `LEG` stages whose `sequence` restarts at 1 per set. Rejected: global leg sequence under SET parents (two meanings of `sequence`), and flat legs with sets derived only (no SQL grouping by set, seeded `SET` unused).

---

## Config — `501_V2`

Strict zod object in `lib/game/rulesets/types.ts`, snake case on the wire:

```
starting_score      int >= 2, default 501          (unchanged)
check_in            "STRAIGHT_IN"                   (unchanged)
check_out           "DOUBLE_OUT"                    (unchanged)
max_darts_per_turn  int 1..3                        (unchanged)
max_visit_score     int, default 180                (unchanged)
legs                { mode: FIRST_TO | BEST_OF, count: int 1..20 }
sets                null | { mode: FIRST_TO | BEST_OF, count: int 1..20 }
win_by_two          null | { cap: int, scope: EVERY_SET | DECIDING_SET }
```

`superRefine` rejects:

- `BEST_OF` with an even `count` (legs or sets);
- `win_by_two.cap` below the leg target;
- `win_by_two.scope = DECIDING_SET` while `sets` is null.

**Target** of a `{ mode, count }`: `count` for `FIRST_TO`, `(count + 1) / 2` for `BEST_OF`.

`legs` is the match's leg race when `sets` is null, and each set's leg race otherwise.

**V1 adapter.** A `501_V1` snapshot is never rewritten. The engine reads it as `legs: { FIRST_TO, legs_to_win }, sets: null, win_by_two: null`, so one fold serves both versions.

---

## `modules/game/match-format.module.ts`

Pure; no engine state, no I/O.

```ts
foldMatch(
  format: MatchFormat,          // normalised legs / sets / winByTwo
  sideKeys: readonly string[],
  legWinnersBySet: readonly (readonly string[])[], // from the stage tree, in play order
): {
  sets: { legsWon: Record<string, number>; winner: string | null }[];
  setsWon: Record<string, number>;
  winner: string | null;
  currentSetClosed: boolean;
  decidingSet: boolean;
  suddenDeath: boolean;
}
```

Rules:

- **Leg race won** when a side reaches the leg target and, if the margin applies to this set, leads **every** other side by 2. Under win-by-2 with cap X, a side reaching X + 1 legs wins regardless of margin.
- **Margin applies** when `win_by_two` is set and (`scope = EVERY_SET` or this set is the deciding set). With `sets` null, the single implicit set counts as `EVERY_SET`.
- **Deciding set:** the set played while every side stands at set target − 1. With `sets` null, false.
- **Sudden death:** the margin applies and every leading side stands at X legs in the current set.
- **Match winner:** with `sets` null, the winner of the one implicit set; otherwise the first side to the set target.
- The fold never invents set boundaries: grouping comes from the stage tree. It only reports whether the current (last) set is closed.

---

## Engine — `five-oh-one.engine.module.ts`

- One class constructed with `"501_V1"` or `"501_V2"`. Both keys register via `registerEngineFactory` and `services/rulesets/registry.ts` in the same commit (`scripts/check-game-engines.sh`).
- `foldFiveOhOneState` groups `LEG` stages under their `SET` parent (root legs form one implicit set), folds each leg with the existing `foldLeg`, collects winners and calls `foldMatch`.
- `state()` adds `sets`, `setsWon`, `decidingSet`, `suddenDeath`. `sides[].legsWon` means legs won **in the current set** (the whole match when sets are off — V1 meaning unchanged).
- `wouldComplete(input)`: when the input checks out, append the active side to a copy of the winners and return whether `foldMatch` then reports a winner.
- `record()` after `WON` keeps its current rejection.

### Stage tree

| Sets | Opening stages | After a leg win, match continues |
| --- | --- | --- |
| off (V1, or V2 with `sets: null`) | `leg-1` (root, seq 1) | push `leg-(n+1)` (root, seq n+1) — unchanged |
| on | `set-1` (root, seq 1), `set-1-leg-1` (parent `set-1`, seq 1) | if `currentSetClosed`: push `set-(k+1)` then `set-(k+1)-leg-1`; else push `set-k-leg-(m+1)` (parent `set-k`, seq m+1) |

The `LEG` is always pushed last, so `stages.at(-1)` stays the open leg.

### Rehydration

`create(config, prior)` throws when the prior stage tree contradicts the fold: a `LEG` whose parent is absent or not a `SET`, a `SET` opened while the previous set is not closed, or `LEG` stages beyond a won match. A wrong score shown silently is worse than a loud failure.

---

## Seat rota — `seat-rota.module.ts` (SHARED branch)

Start index = Σ (`sequence` − 1) over the open leg and its ancestors.

- Root legs: `legSeq − 1` — today's rule.
- Nested: `(setSeq − 1) + (legSeq − 1)` — set k opens on seat k (mod seat count), legs rotate from there.

Only 501 uses SHARED; PER_SEAT engines are untouched.

## Undo — `turn-log.module.ts`

`popStageOpenedBy` additionally pops a trailing `SET` left with no child stages, never the first stage. Undoing the checkout that opened a new set removes both stages; undo stays the exact inverse of `record()`. 121 never emits `SET`, so it is unaffected.

---

## Persistence

- New seed `database/seeds/0037_five_oh_one_v2_game_engine_reference.sql`: `ruleset_versions` row `501_V2`, `version_number` 2, same game type as `501_V1`, `ON CONFLICT DO NOTHING`.
- Capability rows `('501_V2','RECREATIONAL','QUICK_SCORE')`, `('501_V2','ANALYTICS','VISUAL_BOARD')` appended to `0007_ruleset_version_capabilities.sql`, per precedent.
- No migration; no view change.

## Wiring

`501_V2` added beside `501_V1` in: `RULESET_CONFIGS` / type unions (`lib/game/rulesets/types.ts`), `capabilities.ts`, `games-visibility.ts`, `session-seats.service.ts`, `lib/stats/constants.ts`, `session-progress.module.ts`. `five-oh-one-play.data.ts` and `five-oh-one-setup.data.ts` reference both keys (engine gate). New sessions start on `501_V2`; V1 sessions resume and replay on `501_V1`.

## Stats — `modules/stats/x01-checkout-sessions.module.ts`

Today it rebuilds facts from `v_x01_checkout_darts`, which has no `SET` rows (it joins darts), and sorts stages by `sequence` (:57) and turns by `(stageSequence, turnSequence)` (:115-119) — nested legs from different sets would collide.

Change: load each session's stage tree from `v_replay_stages`, order stages by the pre-order walk already in `replay.module.ts`, and order turns by their leg's tree position then turn `sequence`. V1 sessions produce the same order as today.

---

## UI

- **Setup** (`five-oh-one-setup.data.ts` + setup component): format (first to / best of), sets on/off, sets count, legs per set (best of 3 / best of 5 presets, or custom), win by 2 on/off, margin scope (sets on only), cap (default target + 2). Client validation mirrors the zod refinements. Play again copies the full V2 config.
- **Play** (`five-oh-one-play.data.ts`): subtitle `SET k · LEG n · FIRST TO S SETS` with sets on, unchanged otherwise; `DECIDING SET` / `SUDDEN DEATH` badge from state; `turnsInCurrentLeg` reads the last `LEG` stage; scoreboard leg bars sized to the current set's leg target (or the cap once past it) with a sets tally.
- **Results** (`FiveOhOneResults.astro`, `ComparisonSummary.astro`): set score first, then per-set leg scores; per-side stats unchanged.
- **Replay** (`replay-presenters.ts:138-161`): a leg win is detected from a `LEG` stage closing, not by summing `legsWon`.
- **Resume** (`session-progress.module.ts`): `Set k · Leg n` and the set tally with sets on.

---

## Docs

- Decision block in `decisions/game-engine.md`: 501 V2 match format; nested `SET`→`LEG` with per-parent sequence; per-set rotation.
- `501.md` `Current version:` bumped to V2 by the implementation PR, not before.
- Context map / File Inventory rows for `match-format.module.ts` and the seed, per `context-maintenance`.

---

## Testing

TDD, red first, under `app/tests/` mirroring `app/src/`.

- **`match-format.module`** (table-driven): first to / best of for legs and sets; win by 2 every set and deciding set only; cap reached (X + 1 wins without margin); 3–4 sides (margin against every side, deciding set needs all at target − 1); V1 adapter.
- **Engine:** full V2 sets match through record → rehydrate → undo, undo exact inverse including the SET+LEG pair; `wouldComplete` truth table; contradictory prior trees throw; **V1 golden** — a recorded V1 fact log folds to an identical `state()` before and after.
- **Rota:** sets off matches today for 2–4 seats; sets on, set k opens on seat k for 2, 3, 4 seats.
- **Stats:** nested sessions with same-sequence legs in different sets give correct checkout counts; V1 fixtures unchanged.
- **Config:** zod accepts/rejects each refinement case.
- **UI data:** subtitle, badges, results snapshot, session progress, replay leg-win detection.
- **Gates:** `check-game-engines.sh`, `check-game-rules.sh`, `validate:app` (0 errors / 0 warnings / 0 hints), `run-all-gates`.
