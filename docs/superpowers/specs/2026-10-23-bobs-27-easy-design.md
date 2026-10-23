# Bob's 27 Easy (BOBS27_V2) — Design

Date: 2026-10-23. Rules: `docs/game-rules/rulesets/bobs-27.md` (Easy rows `V2`, amended 2026-10-23).

## 1. Intent

A beginner mode of Bob's 27: same path, scoring and bull rule as Traditional, but the score may go negative and nobody dies. The run always finishes the path.

Locked with the user (2026-10-23):

- No win or loss in Easy. Solo completes with a final score. 1v1: higher final score wins, equal is a tie, no elimination.
- A new ruleset version `BOBS27_V2` beside the untouched `BOBS27_V1`.
- Setup switch only; no new games-index card.

## 2. Classification

Execution model: game. Entry points: standalone. Kernel: TRACK (unchanged). Additive, `V2` (V1 is shipped, so the cut test is not re-run). No shipped rule changes; no decision needed for the rule itself. One decision block (`decisions/game-engine.md`) records the vehicle choice, as D243/D245 did.

## 3. Config and types

- `Bobs27V2Config` = V1 fields + `mode: z.literal("EASY")`, `.strict()`, no refine. `RULESET_CONFIGS.BOBS27_V2`, `ConfigSnapshotFor`, key union.
- `Bobs27Snapshot` gains optional `mode`; V1 snapshots carry none.
- `Bobs27SeatState` is unchanged. Under Easy, seat status `WON` means "finished the path"; `LOST` never occurs.
- `Bobs27ResultsSnapshot`/`Bobs27SeatResult` gain no field; the results component reads `mode` from the config.

## 4. Engine

One spec, two factories: `bobs27Spec.rulesetVersionKeys` + a second `dartGameEngineFactory(spec, Bobs27Engine, "BOBS27_V2")` (Singles Training pattern, D462).

- `bobs27Rules(config)`: when `config.mode === "EASY"`, `onVisitClose` skips `outAtOrBelowZero`: `advance(penalise(seat))`. Hits, penalty, bull value, `closeAfter(3)`, `advanceToEnd` untouched.
- `foldBobs27State`: when Easy, always the `scoreCompareOutcome(..., "HIGHEST", "IN_PROGRESS")` branch for 2 seats; `elimination` is never reached. One seat: `status: seats[0].status` (becomes `WON` at the bull visit).
- `wouldComplete` reads `applyBobs27Dart`, which already carries the rules; no change.
- Differential: V1 replay through the shared spec stays byte-identical (all existing goldens unchanged); new Easy goldens added.
- Capture unchanged: a visit's `totalScore` is the sum of its darts' board scores, never negative; the running score is derived.

## 5. Registration (single commit with the validator, per `check-game-engines.sh`)

- `services/rulesets/registry.ts`: `BOBS27_V2: bobs27Validator` pattern. The V2 validator is `createThreeDartValidator` on `Bobs27V2Config`; the label/dartless message are shared with V1 (one helper, no copy).
- `services/session-seats.service.ts` `SEAT_CAPS.BOBS27_V2 = 2`.
- `capabilities.ts`: V2 rows in all three maps (`[DETAILED_DARTS, VISUAL_BOARD]`, `["board", "intent-stored", "target-sequence"]`, game type `BOBS27`) and `RULESET_DARTBOT.BOBS27_V2 = true` (the engine is bot-agnostic; Shanghai V2 precedent).
- `session-progress.module.ts`: V2 summarizer row (reuses `bobs27`).
- `lib/stats/constants.ts`: `BOBS27_V2` added to the analytics-eligible list.
- `scripts/engine-kernels.txt`: no new row (same engine file).
- Seed `0050_bobs27_v2_ruleset.sql`: one `ruleset_versions` row (id next free after `…19`, verified at execution), `ON CONFLICT DO NOTHING`. No new configuration template: the setup controller reuses the V1 preset as `templateRef` and supplies `mode` via `configOverrides` (as 0027 and 0049 did). V2 triples go into seed `0007` and its verification file (count 38 to 40).
- No migration. No schema change.

## 6. Setup and play

- `bobs27-setup.data.ts`: `easy` flag (default false); `rulesetVersionKey: (ctx) => ctx.easy ? "BOBS27_V2" : "BOBS27_V1"`; `configOverrides: (ctx) => ctx.easy ? { mode: "EASY" } : undefined`. Guests and DartBot work under both keys (no clearing).
- `Bobs27SetupForm.astro`: Easy mode `Switch`; the info text gains one Easy sentence. The Mode row is the switch itself.
- `bobs27-play.data.ts`: `RULESET_VERSION_KEY` const becomes the engine's own key (`rulesetKeyOf`-style: `config.mode` present means V2); `resumeEngine` and `playAgain` accept both keys (`variantsPlayAgain`, already shared); `resultsTitle`: Easy solo is "Run complete!", Easy 1v1 is the winner or "It's a tie!"; Traditional unchanged.
- `Bobs27Results.astro`: a `Mode` row for Easy via `x-if`; the score cell renders negatives with a minus sign; the win/loss banner is not shown for solo Easy.
- Replay (`replay-presenters.ts`): Bob's 27 runs show a `Mode` cell (Traditional / Easy).

## 7. Stats

`bobs27-survival` groups by `ruleset_version_key` (already in `CONFIG_SENSITIVE`), so Easy forms its own group with no module change. Under Easy `died` is empty and `completed` means finished the path; `scoreAfter` min may be negative. A test pins both. The Statistics picker and heatmap lists gain `BOBS27_V2` only where they enumerate keys (`heatmap-targets.ts`, `section-registry.ts` if keyed by ruleset; verified at execution).

## 8. Catalog tags

Tags are not versioned (`docs/game-rules/TAGS.md`): Easy inherits `bobs-27.md`'s `## Tags` (Difficulty ADVANCED describes Traditional). No card exists for Easy, so card-level tags (D482) do not apply. Recorded as a ruling; no generator change.

## 9. Testing (TDD, failing test first)

1. Config: V2 accepts `mode: "EASY"`, rejects others and unknown keys; V1 rejects `mode`.
2. Engine: Easy score passes below zero without `OUT`; run finishes at the bull visit (`WON`); 1v1 higher score wins; 1v1 tie; Traditional behaviour unchanged (goldens byte-identical).
3. Registry/validator/seat caps/capabilities/session-progress parity tests (exhaustive lists gain V2).
4. Setup: `easy` selects the V2 key and `mode` override; Traditional default unchanged; bot and guest allowed.
5. Play data: results title for each outcome; resume and play again accept both keys.
6. Stats: Easy group is separate; `died` stays empty.
7. Seed verification: V2 capability triples present (38 to 40).

## 10. Out of scope

- Traditional/Easy within one session, a mid-run mode switch.
- Easy-specific start score or penalty multiplier (V1 config fields stay as they are).
- A games-index card or card tags for Easy.
- Any change to V1 config, engine behaviour, seeds or migrations.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| V2 leaks into V1 sessions | V1 key, schema and factory untouched; golden and V1-replay tests |
| `WON` reads as a win under Easy | Result copy and results title never say "win" for solo Easy; ruling recorded in the ledger |
| Exhaustive key lists miss V2 | Existing parity tests fail until each list gains V2 |
| Stats mix Easy with Traditional | Group key includes `ruleset_version_key`; test pins the split |

## 12. Review focus

- Negative score display everywhere: play tile, results, replay, stats `min`.
- 1v1 under Easy with a DartBot: no early end, tie handling.
- Resume of an Easy session after reload and the resume deck (#1061 is the known pre-existing gap for V2 keys; Bob's 27 V2 must not add to it).
- A V1 session started before deploy replays unchanged.

## 13. Refinements (2026-10-23, from the plan)

1. No fold or outcome change (§4): Easy never yields `LOST`, so `foldBobs27State` and `elimination` are untouched; the score-compare branch decides 1v1. Only `bobs27Rules` changes. Solo `WON` means "finished the path".
2. No Mode row in results and no Mode cell in replay (§6): the results title carries the distinction ("Run complete!").
3. `constants.ts` is not touched (§5, §7): `HEATMAP_ONLY_LAYOUTS` is keyed by primary cards.
4. The #1061 gap is closed on `main` (§12): the `GAME_TYPE_BY_RULESET.BOBS27_V2` row keeps Easy sessions in the resume deck; a test pins it.
5. Validator builder (§5): `bobs27ValidatorFor(schema)` is shared by V1 and V2.
6. Play again and resume read the session's own key from `$store.game.rulesetVersionKey` (§6).
