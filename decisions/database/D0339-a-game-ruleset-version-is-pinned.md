---
id: D0339
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, constraint, view, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A game ruleset version is pinned on the exercise template, not the session, mirroring `0035`

## Context and Problem Statement
`startGameStep` hardcoded `TUOD`/`TUOD_V1` from the first game-backed exercise (Finishing) onward, so no second GAME template could ever be seeded — the exact gap `05-Database/06-Spec/02-Template-Layer.md` had documented, inaccurately, as "a GAME template pins a game ruleset version on its session instead": nothing on the session ever pinned one, and nothing else did either. The column belongs on the template for the identical reason D295 put `exercise_ruleset_version_id` there: `default_configuration` and the ruleset version defining its shape are both the template's, and a per-step override would let one step's configuration diverge from its own template's. The foreign key is composite, mirroring D295's shape exactly, so a template cannot pin another game's ruleset version — a simple key would accept a Score-Training-configured template pinned to `TUOD_V1` and validate it against the wrong ruleset with nothing reporting it. The CHECK is one-directional because the both-or-neither pair it was first written as is not true of the data and never was: `seeds/0002` inserts `501 Match`, `Singles Accuracy` and two more with a `game_type_id` and no ruleset version, and they stay that way — only a game with a native timed mode is routine-eligible (D340), so the rest pin nothing by design. The first draft added the pair `NOT VALID` on the deploy-order reasoning that D295's pair and `0020`'s capability FK use (issue #378: every migration runs before any seed), which misread what `NOT VALID` buys: it exempts rows already in the table, and a seed run against a fresh database INSERTs those templates rather than inheriting them, so the constraint fired on `501 Match` and failed the deploy rehearsal. The composite FK already carries the guarantee that mattered — no template pins another game's ruleset version — and this CHECK now adds only the other half of it, that a pin names a game at all.

## Decision Drivers
* `startGameStep` hardcoded `TUOD`/`TUOD_V1`, so no second GAME template could be seeded.
* `default_configuration` and the ruleset version defining its shape are both the template's, as D295 argued for the exercise-side column.
* A template must not pin another game's ruleset version.

## Considered Options
* Pin on `exercise_templates` with a composite foreign key and a one-directional `CHECK`, added validated (chosen).
* Add a both-or-neither `CHECK` pair, as the first draft did, `NOT VALID` (rejected in Context: the pair is not true of the seeded data, and the deploy rehearsal failed on `501 Match`).
* A per-step override (rejected in Context: one step's configuration could diverge from its own template's).

## Decision Outcome
Chosen option: "migration `0040` adds `exercise_templates.game_ruleset_version_id` (nullable `UUID`), a composite foreign key on `(game_type_id, game_ruleset_version_id)` referencing a new `uq_ruleset_versions_game_type_id` pair on `ruleset_versions (game_type_id, id)`, and `chk_exercise_templates_game_ruleset_pair` — `game_ruleset_version_id IS NULL OR game_type_id IS NOT NULL`, added validated. Seed `0021` backfills the Finishing system template to `TUOD_V1`; `startGameStep` (`app/src/services/training-session.service.ts`) reads the pin off the resolved step instead of a hardcoded `TUOD`/`TUOD_V1` pair. `v_routine_execution` and `v_exercise_template_catalog` are recreated with `game_ruleset_version_key` (LEFT JOIN, additive).".

### Consequences
`services/routines/game-step.ts`'s `ROUTINE_GAME_STEPS` table (D340) is what actually gates which pinned ruleset versions a step may start from — the schema permits pinning any ruleset version of the named game, whether or not that version is routine-eligible, and `routineGameStepHook` is what refuses an ineligible one at read time. Neither the migration nor the seed was executed here — no `DATABASE_URL` in this environment (D193) — and `app/src/db/schema.ts` was **not** hand-edited to match, as `0034`–`0039` were: `.claude/settings.json` denies every tool on that path (D314), which in this session blocked reading, grepping and writing it alike, so the branch lands with the introspection artifact one migration behind the chain. That is visible and not silent: `app/tests/db/schema-view-drift.test.ts` fails on both recreated views, `astro check` reports 3 errors where the two routine repositories select `gameRulesetVersionKey`, and six repository tests fail building a Drizzle query against a column the view object does not yet carry. Clearing all eleven is one `drizzle-kit introspect` by someone whose session can write the file. `database/verification/0040_exercise_template_game_ruleset_checks.sql` is what proves the FK, the CHECK and both views, once a human runs it against a live database. `docs/architecture/05-Database/06-Spec/02-Template-Layer.md`'s "on its session" sentence is corrected in the same doc pass this decision lands with.

* Bad, because the schema permits pinning any ruleset version of the named game, routine-eligible or not. `routineGameStepHook` refuses an ineligible one at read time.
* Bad, because `app/src/db/schema.ts` was not hand-edited in the authoring session, so the branch landed with the introspection artifact one migration behind the chain.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0040_exercise_template_game_ruleset_checks.sql` proves the foreign key, the `CHECK` and both views once a human runs it against a live database. The Consequences list the tests that failed while `schema.ts` was behind.

## Pros and Cons of the Options
### Pin on the template with a composite FK and a one-directional `CHECK`
* Good, because the composite foreign key makes a template pinned to another game's ruleset version unrepresentable, which a simple key would accept.
* Good, because the pin sits next to `default_configuration`, which the ruleset version defines.
* Bad, because the schema does not enforce routine eligibility (Consequences).

### Both-or-neither `CHECK` pair, `NOT VALID`
* Bad, because seeded templates such as `501 Match` carry a `game_type_id` and no ruleset version by design, and the constraint failed the deploy rehearsal.

### Per-step override
* Bad, because one step's configuration could diverge from its own template's (Context).

## Evidence / More Information
Decided: 2026-09-20

* `docs/superpowers/specs/2026-09-18-routine-step-kind-generalisation-design.md` (§ 3, § 8): the original design (mirror `0035`, composite FK, view columns) and the owed decision. Its first draft proposed the both-or-neither `CHECK`. Rebuilt Decision Drivers and Considered Options.
* `docs/superpowers/plans/2026-09-18-routine-step-kind-generalisation.md` (Architecture line): planned a `NOT VALID` pair `CHECK`.
* Commit `38947f7a` (PR #534, 2026-09-20; adds the D339 row and migration `0040`): rebuilt Consequences, Confirmation and Pros and Cons.
