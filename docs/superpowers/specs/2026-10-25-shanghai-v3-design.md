# Shanghai V3 (SHANGHAI_V3) — Round range presets and Score-only — Design

Date: 2026-10-25. Rules: `docs/game-rules/rulesets/shanghai.md` (rows `V3`, amended 2026-10-25). Precedent, read first: `docs/superpowers/specs/2026-08-28-shanghai-v2-target-mode-design.md` (V2 added a setting as a new ruleset version) and `docs/superpowers/specs/2026-10-24-cricket-v2-design.md` (latest registration checklist and seed pattern).

## 1. Intent

V1/V2 fix the range at 1–20 and always end the match on a Shanghai. V3 lets the player play a shorter or later slice of the board and switch the instant win off.

Locked with the user (2026-10-25):

- Scope: round range presets and Score-only mode. Match structure (first to N, best of N) stays `V2+`.
- Range input: presets only — 1–7, 1–10, 1–20, 11–20, 13–20. No free start/end (`V2+`).
- A new ruleset version `SHANGHAI_V3` beside the untouched V1 and V2 (D245).
- Hard-mode halving, guest and DartBot seats, 1v1 rules and capture are unchanged.

## 2. Classification

Execution model: game. Entry points: standalone. Kernel: TRACK. Additive, applies to `All`, `V3`. V1 and V2 behaviour is untouched, so no shipped rule changes. One decision block in `decisions/game-engine.md` (id from `scripts/next-decision-id.sh`, re-run before the PR) records the vehicle and the range-generalised path.

## 3. Rules recap (authority: `shanghai.md`)

- The round-*n* active number is `rangeStart + n − 1`; the session ends after `rangeEnd`. 1–20 is byte-identical to V1/V2.
- Score-only: a Shanghai visit scores like any other. Every seat plays the whole range; highest total wins; equal totals tie (1v1, no tiebreak).
- Normal/Hard composes with every range and with Score-only. A Hard blank still halves the running total.

## 4. Capture and state (Hard Invariant)

- Capture/input mode, intended fact (nothing stored), stage type (one `EXERCISE_BLOCK` per seat), `score` (board score): unchanged from V1/V2.
- Nothing new is stored. No new fact field, no migration. The round's number is recovered from the visit index plus the session's `rangeStart`, which lives in the config snapshot the session already holds.
- Derived, never stored: totals, per-round scores, halving, and whether a visit was a Shanghai.

## 5. Config schema

`app/src/lib/game/rulesets/types.ts`:

```ts
export const ShanghaiV3Config = z
  .object({
    difficulty: z.enum(["NORMAL", "HARD"]),
    rangeStart: z.number().int().min(1).max(20),
    rangeEnd: z.number().int().min(1).max(20),
    instantWin: z.boolean(),
  })
  .strict()
  .refine((c) => c.rangeStart <= c.rangeEnd, { message: "rangeStart must not exceed rangeEnd" });
```

Presets are a UI list, not a schema enum, so a later free start/end needs no new version. The schema accepts any valid range; the setup controller only offers the five presets. Registered as `RULESET_CONFIGS.SHANGHAI_V3`, `ConfigSnapshotFor`, `ShanghaiV3Snapshot`.

## 6. Engine

`app/src/modules/game/shanghai.engine.module.ts`:

- `ShanghaiEngineConfig` gains `Seated<ShanghaiV3Snapshot>`. A `settingsOf(config)` normaliser (the `difficultyOf` pattern) returns `{ difficulty, rangeStart, rangeEnd, instantWin }`, defaulting to `NORMAL`, 1, 20, `true` for any config without those keys, so V1/V2 fold unchanged by construction.
- `shanghaiRules(settings)`: `target: pathTarget(PATH.slice(rangeStart − 1, rangeEnd))`; `advance = advanceToEnd(rangeEnd − rangeStart)`; `onVisitClose` applies `shanghaiWin` only when `instantWin`. In Score-only the Shanghai flag is never set, so no seat reaches `SHANGHAI` and the existing fold ends on `COMPLETE`/`TIE` unchanged.
- `activeTargetOf(state, config?)` now uses `config` for the range offset (its optional, unused parameter becomes real). `initialShanghaiState`, `applyShanghaiDart` take the settings object; `difficulty` positional parameter is kept for V1/V2 callers as a default (see §10 risk).
- `shanghaiSpec.rulesetVersionKeys` gains `"SHANGHAI_V3"`; a third `dartGameEngineFactory(..., "SHANGHAI_V3")` is registered.
- `LAST_TARGET_INDEX = 19` and the module comments naming 1–20 and "round 20" are replaced by the range.

## 7. Registration

One commit with the validator (`check-game-engines.sh`): `rulesets/types.ts` (key union, config, snapshot, `ConfigSnapshotFor`), `services/rulesets/registry.ts` and `shanghai.validator.ts` (`shanghaiV3Validator`, `ShanghaiV3Config`), `session-seats.service.ts` (`SHANGHAI_V3: 2`), `capabilities.ts` (capabilities `[DETAILED_DARTS, VISUAL_BOARD]`, `["board", "intent-derived", "target-sequence"]`, game type `SHANGHAI`, `RULESET_DARTBOT.SHANGHAI_V3: true`), `session-progress.module.ts` (detail `Round n of <length>`, `Round 3 of 7`), `games-visibility.ts` and the resume-deck map `GAME_TYPE_BY_RULESET.SHANGHAI_V3` (pinned by a test), `lib/stats/constants.ts` if V2 is listed there (verify at execution; V2 is not today, so check how V2 reaches its stats layout and follow it).

Seed `0053_shanghai_v3_ruleset.sql`: a `ruleset_versions` row under game type `0198f000-0000-7000-8000-000000000007`, id next free after `…000022` (verified at execution), `ON CONFLICT DO NOTHING`. No `configuration_templates` row: the V3 setup controller reuses 0008's `{}` preset and always supplies all four fields through `configOverrides`, as V2 does (D245). Capability triple into `0007` and `verification/0007_capability_seed_checks.sql` (count +2), `database/README.md` seed row. No migration, so the applied chain `0001`–`0046` is untouched.

## 8. Setup and play

- `shanghai-setup.data.ts`: new fields `range` (a preset key, default `1-20`) and `instantWin` (default `true`); `configOverrides` maps them to `rangeStart`, `rangeEnd`, `instantWin`, `difficulty`; `rulesetVersionKey: "SHANGHAI_V3"` for every new session (V1 and V2 sessions only resume and replay).
- `ShanghaiSetupForm.astro`: a Range toggle (five options) and a "Shanghai wins instantly" toggle beside the Difficulty toggle; hint text per state; the info copy no longer says "Twenty rounds".
- `shanghai-play.data.ts`: `SHANGHAI_ROUNDS` and `targetNumberAt(targetIndex)` read the session's range (`rangeStart + index`); `subtitle` is `ROUND n OF <length>`; `roundLabelFor` is `n/<length>`; `statsFor` computes each dart's number from `rangeStart`; `resultsTitle` is unchanged (`SHANGHAI` status cannot occur in Score-only, so the plain winner/tie titles apply); `RESUMABLE_RULESET_VERSIONS` gains V3; `playAgain` uses `variantsPlayAgain` for V2 and V3 so range and flags carry over.
- `derived-aims.module.ts`: passes the config's range to `activeTargetOf` so heatmap and aim derivation stay correct for 11–20 and 13–20; `rulesetVersionKey.startsWith("SHANGHAI_")` already covers V3.
- DartBot: aims at the active number through the existing flow; the bot reads the target from engine state, not a hard-coded 1–20 (test pins an 11–20 bot round).

## 9. Testing (TDD, failing test first)

1. Engine: range 13–20 → round 1 targets 13, session ends after 20, round 9 refused; 1–7 ends after 7; single-round range (rangeStart = rangeEnd) is valid.
2. Instant win off: a S+D+T visit scores its sum, seat advances, no `SHANGHAI` status; 1v1 plays the whole range, higher total wins, equal totals `TIE`.
3. Hard composes: blank round in 11–20 halves; Hard + Score-only.
4. Differential: V1 and V2 goldens fold byte-identically after the `settingsOf` refactor.
5. Schema: `rangeStart > rangeEnd`, out-of-range, non-integer, missing key all rejected; validator, registry, seat cap, capability, session-progress and resume-deck tests gain V3.
6. Setup: each preset maps to the right start/end; default is `1-20`, instant win on; overrides always carry all four fields.
7. Play data: subtitle and round label for 11–20; stats per-dart numbering with an offset; play again carries range and flags; V3 resumes.
8. Derived-aims: aims for a 13–20 session match the offset numbers.
9. Seed verification: capability counts from the file at execution.
10. Visual check (Playwright, mocked API, 390×844): setup form with all toggles; a 13–20 play screen header and tap row.

## 10. Out of scope

Free start/end, match structure, any change to V1/V2 config or behaviour, a Shanghai-count result stat, a stats section, existing seeds or migrations.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Range offset missed at one of the many "20 rounds" call sites | The call-site list in §6–§8 is exhaustive from a grep of `20`, `SHANGHAI_ROUNDS`, `targetAt(numbersPath()` and `activeTargetOf`; a test per site with an 11–20 session |
| V1/V2 regress through the settings refactor | `settingsOf` defaults; differential goldens (§9.4) |
| `applyShanghaiDart`'s positional `difficulty` parameter and a new settings object coexist awkwardly | Replace the positional parameter with a settings object in one task and update all callers (`derived-aims`, tests); no overloads kept |
| Score-only players lose the "Shanghai" moment | Out of scope; the visit still shows its zone chips. Revisit with a result stat if wanted |
| Stats layout membership for V3 missed | Follow how V2 is routed; add a test if V2 is listed anywhere |
