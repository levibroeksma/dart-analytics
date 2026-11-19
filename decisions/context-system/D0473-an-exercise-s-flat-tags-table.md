---
id: D0473
status: accepted
date: 2026-10-20
origin: contemporaneous
original-date:
tags: [context-system, docs, skill]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# An exercise's flat `## Tags` table may label a Difficulty per config

## Context and Problem Statement
the Switching merge (`docs/superpowers/plans/2026-10-19-switching-merge.md`) folds two exercise types into one whose Standard and Chain configs sit at different levels, which the single per-type Difficulty of D461 cannot express. D470 had already solved the same problem for a game — Around the Clock's 1/2/3-dart presets — by labelling the routine-step values and pinning each template's level in `exercise_templates.difficulty_tag_id`; an exercise's flat table is assigned the `ROUTINE_STEP` context already, so the restriction to games was an accident of the first implementation rather than a rule anyone wanted. Requiring labels before allowing several keeps the stricter reading for every exercise written so far: a bare `BEGINNER, INTERMEDIATE` is still the old error, not a new grammar.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the `## Tags` grammar of D461/D470 treats an exercise's one flat table as a routine-step block in full, so it may list several Difficulty values, each labelled with the config it describes, exactly as a game's `### Routine step` subsection already could: `| Difficulty | BEGINNER (Standard), INTERMEDIATE (Chain) |`. One rule, mirrored by hand in both gates — `allowsSeveral()` in `app/scripts/tags/parse-tags.ts` and `allows_several()` in `scripts/check-game-rules.sh`: several values on a `one` axis only in a routine-step block, and in an exercise's flat table only when every value carries a label. Nothing else widens. An unlabelled second Difficulty is still an error in both shapes (`needs a preset label` in a game's routine step, `Difficulty takes exactly one value` in an exercise); an exercise still has one flat table and no subsections (`an exercise has one flat table, no subsections`); a game's standalone or flat table still rejects a label (`unexpected label`); the single `(primary)` Skill, `NONE` on Pressure, axis order and the rulesets-only Family axis are untouched. `docs/game-rules/TAGS.md` states it as the **Per-config difficulty** rule; `app/tests/scripts/tags/parse-tags.test.ts` and `scripts/test-check-game-rules.sh` carry the same four cases on both sides.".

### Consequences
`app/scripts/generate-tag-seed.ts` drops the DIFFICULTY axis from any block that labels several values, an exercise's included, so such an exercise type links no Difficulty tag in `exercise_type_tags`; `v_exercise_template_catalog`'s type-level fallback requires exactly one (`HAVING count(*) = 1`) and finds none, which makes `exercise_templates.difficulty_tag_id` the only source of that type's template levels — hand-seeded as `database/seeds/0043_exercise_template_difficulty.sql` does for Around the Clock. A type that adopts the grammar without seeding per-template difficulty therefore reads as `NULL` on its cards, and `app/tests/integration/template-difficulty-parity.itest.ts` fails it; that test now guards that it reaches exercise types, not only game types. No rules file uses the grammar yet, so the generated seed `0042_catalog_tags.sql` is byte-identical under this entry. The two gates stay mirrored by hand: a change to one of the two functions without the other is a silent disagreement, which only the fixture suites catch.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-20
