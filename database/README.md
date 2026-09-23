<!--
status: canonical
scope: database/sql-artifacts
read-when: applying migrations and seeds
updated: 2026-09-20
-->

# Database SQL Artifacts

This directory contains SQL source-of-truth artifacts used by the application.

## Structure

```text
database/
├── migrations/     # ordered schema migrations (0001–0042)
├── seeds/          # controlled reference/system data
└── verification/   # rollback-safe checks run against a live database
```

## Execution Model

- Migrations are applied with `dbmate`.
- Migration files must include `-- migrate:up` and `-- migrate:down` markers (see `03-Migrations.md`).
- Seeds run after migrations in deterministic order.
- App schema ownership stays in SQL files here (not ORM-generated migrations).

## Standard Local Flow

From `app/`:

```sh
npm run db:status
npm run db:migrate     # expected to STOP at 0020 — see below
npm run db:seed        # 0007 fills the capability table
npm run db:migrate     # 0020 and 0021 now apply
npm run db:drift        # applied versions + live views vs this chain
npm run db:introspect
bash ../scripts/fallow-gate.sh
astro check
```

`db:drift` exists because `db:status` cannot see an applied migration whose file is absent from this checkout: dbmate enumerates the files, so a `schema_migrations` row from a branch you are not on prints nothing and the summary still reads `Pending: 0`. Introspecting that database rewrites `app/src/db/schema.ts` to the wrong shape. (2026-09-19, D333, #503)

`0020` adds a composite foreign key from `exercise_sessions` to `ruleset_version_capabilities` and requires seed `0007` to have already run — applying `0020` before `0007` (or against a populated database whose sessions use a combination `0007` does not declare) fails on constraint validation.

**The first `db:migrate` failing at `0020` is expected, not a broken migration.** `db:migrate` is `dbmate up`, which takes no target version and applies every pending migration in one run. Against a populated database it will commit `0019`, then stop at `0020` because the capability table is still empty. Run `db:seed`, then `db:migrate` again to apply `0020` and `0021`. On an empty `exercise_sessions` the first run succeeds straight through — the stop is data-dependent, so do not treat its absence as a sign the order does not matter.

## Seed Order

1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`
3. `seeds/0003_game_engine_reference.sql`
4. `seeds/0004_score_training_minutes_preset.sql`
5. `seeds/0005_visual_board_input_mode.sql`
6. `seeds/0006_single_band_dart_zones.sql`
7. `seeds/0007_ruleset_version_capabilities.sql`
8. `seeds/0008_shanghai_game_engine_reference.sql`
9. `seeds/0009_121_game_engine_reference.sql`
10. `seeds/0010_around_the_clock_game_engine_reference.sql`
11. `seeds/0011_one_twenty_one_v2_game_engine_reference.sql`
12. `seeds/0012_shanghai_v2_game_engine_reference.sql`
13. `seeds/0013_singles_training_v2_game_engine_reference.sql`
14. `seeds/0014_exercise_types.sql`
15. `seeds/0015_warm_up_routine.sql`
16. `seeds/0016_switching_double_pattern_exercise_types.sql`
17. `seeds/0017_balanced_training_routine.sql`
18. `seeds/0018_singles_training_v3_game_engine_reference.sql`
19. `seeds/0019_exercise_template_ruleset_versions.sql`
20. `seeds/0020_finishing_default_configuration.sql`
21. `seeds/0021_exercise_template_game_rulesets.sql`
22. `seeds/0022_routine_game_templates.sql`
23. `seeds/0023_target_scoring_exercise_type.sql`
24. `seeds/0024_switching_target_scoring_exercise_type.sql`
25. `seeds/0025_score_threshold_exercise_type.sql`
26. `seeds/0026_warm_up_advanced_template.sql`
27. `seeds/0027_around_the_clock_v2_game_engine_reference.sql`

`npm run db:seed` runs this list twice per invocation (2026-08-29, D248). `0007` is a running ledger that a later-numbered seed's ruleset can be appended to before that ruleset's own `ruleset_versions` row exists yet in the same run — the first pass's join then matches nothing and silently inserts zero rows. The second pass re-runs `0007` after every file has committed, so the join now matches. All seeds are `ON CONFLICT DO NOTHING`, so running the full list twice is safe.

## Verification Scripts

`verification/` holds SQL that asserts behaviour only a real database can show — constraints firing, view expressions resolving, derived columns reading correctly. Each script builds its own fixture inside one transaction, resolves every lookup row by `implementation_key` rather than by hardcoded id, prints a PASS/FAIL row per check, and ends in `ROLLBACK`. Nothing survives the run, so they are safe against a seeded dev database.

From `app/`:

```sh
npm run db:verify              # every script
npm run db:verify 0018         # only scripts whose filename matches
```

Expect `ALL n CHECKS PASSED`; the command exits non-zero if any check fails. It runs through `postgres.js` rather than `psql`, which is not installed locally — this project uses a Neon `dev` branch instead of a local PostgreSQL server (D24), so the client binaries are not there either. `psql "$DATABASE_URL" -f <file>` works identically if you do have it.

These are not a substitute for the Vitest suite: they cover the SQL layer, which unit tests cannot reach. They are not part of `npm test` — they need a live `DATABASE_URL` and are run deliberately, per environment.

| Script | Covers |
| ------ | ------ |
| `verification/0007_capability_seed_checks.sql` | `seeds/0007` row count, per-triple resolution, zero undeclared `exercise_sessions`, parity with `capabilities.ts` (32 checks) |
| `verification/0018_visual_board_checks.sql` | `chk_dart_location_pair`, `v_dart_locations` angles and filtering, bust divergence (11 checks) |
| `verification/0020_capability_fk_checks.sql` | `fk_sessions_capability` exists over the exact composite columns, refuses an undeclared capture/input mode combination, permits a declared one (4 checks) |
| `verification/0021_player_settings_checks.sql` | `v_player_settings` exists with the exact expected columns, translates known mode ids to implementation keys, omits a row for a player with no settings, and preserves the `LEFT JOIN` (NULL mode ids still yield a row with NULL keys) (7 checks) |
| `verification/0022_player_profile_checks.sql` | `v_player_profile` exists with the exact expected columns, resolves configured and unconfigured players correctly, `chk_players_darts_description_not_empty`/`chk_players_darts_weight_grams_range` fire on invalid input and accept valid/NULL input (11 checks) |
| `verification/0008_shanghai_capability_checks.sql` | `seeds/0008`+`0007` combined: `SHANGHAI_V1`/`RECREATIONAL`/`DETAILED_DARTS` resolves, zero undeclared `exercise_sessions` — full-table triple-count parity lives in `verification/0007_capability_seed_checks.sql` alone (2 checks) |
| `verification/0009_121_capability_checks.sql` | `seeds/0009`+`0007` combined: `121_V1`/`RECREATIONAL`/`QUICK_SCORE` resolves, zero undeclared `exercise_sessions` (2 checks) |
| `verification/0010_around_the_clock_capability_checks.sql` | `seeds/0010`+`0007` combined: `AROUND_THE_CLOCK_V1`/`RECREATIONAL`/`DETAILED_DARTS` resolves, zero undeclared `exercise_sessions` (2 checks) |
| `verification/0023_target_scoring_seed_checks.sql` | seed `0023`: the `TARGET_SCORING` type is published, `TARGET_SCORING_V1` is its version 1, the system template pins it with `{"targets":[20,19,18,25]}`, and `v_exercise_template_catalog` offers it (4 checks) (2026-09-23) |
| `verification/0024_switching_target_scoring_seed_checks.sql` | seed `0024`: the `SWITCHING_TARGET_SCORING` type is published, `SWITCHING_TARGET_SCORING_V1` is its version 1, the system template pins it with `{"targets":[20,19,18]}`, and `v_exercise_template_catalog` offers it (4 checks) (2026-09-23) |
| `verification/0025_score_threshold_seed_checks.sql` | seed `0025`: the `SCORE_THRESHOLD` type is published, `SCORE_THRESHOLD_V1` is its version 1, the system template "65 or More" pins it with `{"threshold":65}`, and `v_exercise_template_catalog` offers it (4 checks) (2026-09-23) |
| `verification/0026_warm_up_advanced_seed_checks.sql` | seed `0026`: the "Warm-Up Advanced" system template is `WARM_UP`, pinned to `WARM_UP_V1`, its sections aim at 20, 3, 6, 11, then the bull, and `v_exercise_template_catalog` offers both `WARM_UP` templates (3 checks) (2026-09-23) |
| `verification/0023_owner_scoped_dart_view_checks.sql` | `v_dart_analytics`/`v_dart_locations` return only the session owner's own dart for a PLAYER+GUEST fixture, `v_game_replay` deliberately returns both participants' turns, anti-vacuity guard (7 checks) |
| `verification/0011_one_twenty_one_v2_capability_checks.sql` | `seeds/0011`+`0007` combined: `121_V2`/`RECREATIONAL`/`QUICK_SCORE` and `121_V2`/`ANALYTICS`/`VISUAL_BOARD` resolve, all three `121_V2` presets carry the right `duration_type`, zero undeclared `exercise_sessions` (4 checks) |
| `verification/0012_shanghai_v2_capability_checks.sql` | `seeds/0012`+`0007` combined: `SHANGHAI_V2`/`RECREATIONAL`/`DETAILED_DARTS` and `SHANGHAI_V2`/`ANALYTICS`/`VISUAL_BOARD` resolve, zero undeclared `exercise_sessions` (3 checks) |
| `verification/0013_singles_training_v2_capability_checks.sql` | `seeds/0013`+`0007` combined: `SINGLES_V2`/`RECREATIONAL`/`DETAILED_DARTS` and `SINGLES_V2`/`ANALYTICS`/`VISUAL_BOARD` resolve, zero undeclared `exercise_sessions` (3 checks) |
| `verification/0025_player_visit_facts_view_checks.sql` | `v_player_visit_facts` reports `dart_count = 0` for a QUICK_SCORE turn and the real count for a VISUAL_BOARD turn, `configured_max_darts_per_turn` reads the JSONB snapshot, an open turn and a guest's turn never appear (5 checks) |
| `verification/0026_player_leg_facts_view_checks.sql` | `v_player_leg_facts` sums real darts across a complete-capture leg, excludes a leg with any QUICK_SCORE turn entirely, a non-LEG stage never appears (3 checks) |
| `verification/0027_exercise_type_reference_checks.sql` | `exercise_types`/`exercise_ruleset_versions` accept a fixture, reject a duplicate `implementation_key`, and RESTRICT a referenced type's deletion (3 checks) |
| `verification/0029_session_generalization_checks.sql` | a warm-up-shaped session is accepted past `fk_sessions_capability`, both pair CHECKs reject a half-set pair, a capture pair without a game pair is accepted (5 checks) |
| `verification/0030_activity_configuration_checks.sql` | the training snapshot round-trips as JSONB, is unique per activity, and CASCADEs with its activity (3 checks) |
| `verification/0015_warm_up_routine_checks.sql` | seeds `0014`/`0015` resolve end to end: both exercise types, `WARM_UP_V1`, `EXERCISE_SECTION`, a one-step system routine on a WARM_UP template with five phases, no unbackfilled session (7 checks) |
| `verification/0031_singles_training_v3_capability_checks.sql` | `seeds/0018`+`0007` combined: `SINGLES_V3`/`RECREATIONAL`/`DETAILED_DARTS` and `SINGLES_V3`/`ANALYTICS`/`VISUAL_BOARD` resolve, zero undeclared `exercise_sessions` (3 checks) |
| `verification/0027_around_the_clock_v2_capability_checks.sql` | `seeds/0027`+`0007` combined: `AROUND_THE_CLOCK_V2`/`RECREATIONAL`/`DETAILED_DARTS` and `AROUND_THE_CLOCK_V2`/`ANALYTICS`/`VISUAL_BOARD` resolve, zero undeclared `exercise_sessions` (3 checks) (2026-09-23) |
| `verification/0034_single_active_session_checks.sql` | `uq_sessions_single_active` after migration `0034`: a second open session of the same exercise type is rejected, a different exercise type stays startable, closing the first frees the key (4 checks) |
| `verification/0017_balanced_training_checks.sql` | seeds `0016`/`0017` resolve end to end: both new exercise types and their v1 rulesets, seed `0017`'s in-place Warm-Up JSONB update landed (five phases, all weighted, no `durationSeconds` left), the four-step Balanced Training routine sums to 30 MINUTES across distinct templates, the Finishing step holds exactly `TuodConfig`'s six keys on a TUOD-bound template, anti-vacuity guard (11 checks) |
| `verification/0035_exercise_template_ruleset_version_checks.sql` | migration `0035` + seed `0019`: the pin column and its composite FK exist, a ruleset version of another exercise type is rejected and the template's own is accepted, an unpinned template is still allowed, RESTRICT blocks deleting a pinned version, all three non-game system templates were backfilled to their own v1, the GAME template stays unpinned, anti-vacuity guard (11 checks) |
| `verification/0036_read_model_view_consumers_checks.sql` | migration `0036`: the unique on `exercise_configurations.exercise_session_id` still makes the checkout-darts LEFT JOIN non-fanning and every checkout-darts row carries its own session's configuration snapshot (both re-pointed at `v_x01_checkout_darts` when `0039` dropped `v_double_out_checkout_darts`; that view's own column set is asserted by `0039`'s script), `v_routine_execution` exposes the nine columns `findRoutineTemplateSteps` reads and returns all four Balanced Training steps (three of them non-game) with no fan-out, every non-game step carries its template's pinned ruleset version, anti-vacuity guard (8 checks) |
| `verification/0037_exercise_configuration_constraint_naming_checks.sql` | migration `0037`: `uq_exercise_configurations_exercise_session` and `fk_exercise_configurations_exercise_session` both exist on `exercise_configurations.exercise_session_id`, neither pre-rename name (`uq_exercise_configuration_session`, `fk_exercise_configuration_session`) survives, anti-vacuity guard (4 checks) |
| `verification/0038_custom_routine_checks.sql` | migration `0038` + seed `0020`: `chk_routine_templates_player_ownership` rejects an ownerless user routine, `trg_routine_templates_duration_bounds`/`trg_routine_steps_duration_bounds` refuse a user routine outside 30-60 MINUTES and a stepless user routine, the seeded system Warm-Up routine stays valid under the trigger, deleting a user routine does not trip the bound on its cascaded steps, `v_routine_execution` exposes `player_id`/`routine_description`/`exercise_description`, `v_exercise_template_catalog` lists the four `0199b000-*` routine-composable templates all with defaults after seed `0020` and still surfaces a template with none (11 checks) |
| `verification/0039_x01_checkout_darts_view_checks.sql` | migration `0039`: `v_x01_checkout_darts` exists and `v_double_out_checkout_darts` does not, the view exposes every documented column, only 501/TUOD/ONE_TWENTY_ONE game types and only VISUAL_BOARD sessions appear, every row's participant belongs to the session's owning player, anti-vacuity guard (9 checks) |
| `verification/0040_exercise_template_game_ruleset_checks.sql` | migration `0040` + seeds `0021`/`0022`: the pin column and its composite FK exist, a ruleset version of another game is rejected, a pin naming no game is rejected while a GAME template pinning nothing is accepted, seed `0021` backfilled Finishing to `TUOD_V1`, the three routine-eligible templates each pin a version, both routine views expose `game_ruleset_version_key`, seed `0022`'s two templates are present (10 checks) |
| `verification/0041_training_schedule_checks.sql` | migration `0041`: two active schedules for one player raise `unique_violation`, `day_of_week` 0/8 raise `check_violation`, a duplicate weekday within one schedule raises `unique_violation`, deleting a scheduled routine template raises `foreign_key_violation`, deleting a schedule cascades its days, deleting a player cascades their schedules, `v_training_schedules.day_count` and `v_training_schedule_days.routine_minutes` both read correctly (7 checks) |
| `verification/0042_training_completions_view_checks.sql` | migration `0042`: `v_training_completions` lists a completed training with its snapshot routine id/name and excludes abandoned, active and snapshot-less activities (2026-09-22) |

## References

- [`../docs/architecture/05-Database/03-Migrations.md`](../docs/architecture/05-Database/03-Migrations.md)
- [`../docs/architecture/05-Database/10-Database-Agent-Guide.md`](../docs/architecture/05-Database/10-Database-Agent-Guide.md)
- [`../docs/architecture/05-Database/11-Neon-Integration.md`](../docs/architecture/05-Database/11-Neon-Integration.md)
- [`../app/CLAUDE.md`](../app/CLAUDE.md)
- [`./CLAUDE.md`](./CLAUDE.md)
