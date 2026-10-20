# Switching Merge — Design

**Status:** approved for build, 2026-10-19
**Ships in:** PR #1025 (`feat/tag-cards`), before it merges
**Closes:** #799

## Intent

`SWITCHING` and `SWITCHING_TARGET_SCORING` are two seeded exercise types that
train the same skill at two levels. Splitting them was a design mistake: it
costs a type, a ruleset, an adapter, a panel, a stats entry and a card in the
routine builder, and it hides from the player that one is the step up from the
other.

They become **one exercise, Switching, with two configs**:

| Config | Difficulty | What it is today |
| --- | --- | --- |
| Standard | Beginner | `SWITCHING` |
| Chain | Intermediate | `SWITCHING_TARGET_SCORING` |

The merge is end to end — one exercise type, one rules document, one card, one
entry in history and stats — not a grouping in the picker.

`TARGET_SCORING` is a different exercise and is **not** touched.

## Goals

- One `exercise_types` row, one rules document, one card in the routine
  builder, two config rows inside it.
- Each config carries its own difficulty, shown as its own meter on its row.
- Switching gains the catalog tags it has never had.
- #799's four missing rules documents are written.
- Balanced Training's Switching trend survives the merge unbroken.

## Non-goals

- Changing what either config does. Standard and Chain keep their present
  rules, dart for dart.
- A standalone play page for Switching. It stays a routine step, as every
  exercise is.
- Touching Target Scoring, Double Pattern or the GAME wrapper's behaviour.
  Their rules documents are written, not their code.

## Anti-goals

- **A merged engine.** The two configs are not one algorithm with different
  numbers (see Constraints). Forcing them into one fold would be a rewrite of
  both, with no gain a player can see.
- **Migrating the Standard engine onto the Track kernel.** Its row in
  `scripts/engine-kernels.txt` stays `PENDING`.
- **Keeping `SWITCHING_TARGET_SCORING` as a hidden alias.** The type goes, so
  the next reader cannot resurrect the split.
- **Preserving the dropped sessions.** See Data.

## Constraints discovered

Verified in the engines, not inferred from the docs.

| | Standard | Chain |
| --- | --- | --- |
| Engine | hand-written fold (`switching.engine.module.ts`) | Track kernel (`switching-target-scoring.engine.module.ts`) |
| Visit | one full pass through the target list | always 3 darts |
| Targets | 1–20, list of 1–20 entries | exactly 3, distinct, bull allowed |
| Scoring | configurable single/double/treble | fixed: single 1, treble 3, double is a miss |
| Progress | points accumulate, no chain | chain, wiped on any miss |
| Miss | advances to the next target | restarts the sequence from the first target |
| Headline stat | Points | Best chain |

The bull is legal in Chain and illegal in Standard (D297 — every Standard dart
is stamped `TREBLE`, and the bull has no treble). That stays true after the
merge: it is a property of the config, not of the exercise.

**Consequence:** the config must say which mode it is, and the code must branch
on it. A single config schema covering both would accept target lists that are
legal in neither.

## The merged exercise

### Identity

Switching trains moving the aim between targets without losing rhythm. Standard
builds the habit: one dart at each target in turn, every dart scores what it
hits. Chain adds the cost of a miss: the hits have to come in an unbroken run,
and one miss sends you back to the start.

### Standard config

Unchanged from today's Switching.

- Target list: any 1–20 targets from 1 to 20; default 20 → 19 → 18.
- One dart at the current target, then the aim moves on — hit or miss.
- The list cycles. A visit is one full pass through it.
- Points by the ring hit on the target number: single 1, double 2, treble 3 by
  default, each configurable 0–100. Off the target number scores nothing.
- Time-bound. Readout: points, darts, hit rate.

### Chain config

Unchanged from today's Switching Target Scoring.

- Target sequence: exactly 3 distinct targets, each 1–20 or the bull; default
  20 → 19 → 18.
- A hit moves the aim to the next target and adds to the chain. Single 1,
  treble 3; outer bull 1, bullseye 3; **a double is a miss**.
- A miss wipes the chain and restarts the sequence at the first target, even
  mid-visit.
- The chain and the sequence carry across visits. A visit is 3 darts.
- Time-bound. Readout: best chain, completed sequences, darts, hit rate, and
  the best finished chain as the mark to beat.

### What the player sees

One **Switching** card in the routine builder, with two rows:

| Row | Meter |
| --- | --- |
| Standard | Beginner |
| Chain | Intermediate |

One tap on a row's `+` adds that config as a step, exactly as Around the Clock
works now.

## Stats

Standard and Chain do not share a scale: Standard's headline is total points,
Chain's is the best chain. **Bests and trends stay separate per config** inside
the one exercise. A Chain personal best never appears on a Standard run and the
reverse.

## Erasure first

There is exactly one active player — the author — on both dev and prod
(author's statement, 2026-10-19). That removes the usual reason to migrate
data forward, and the merge therefore begins with a **complete erasure of
Switching Target Scoring**, finished and verified before any of the merge is
built. The target is a repository and a pair of databases in which the type
was never implemented, so that nothing left behind — a cached stats key, an
orphan ruleset row, a dangling adapter key — can surface later.

Erased from the databases:

- every played session of the type, with its steps, turns and darts;
- every `routine_steps` row referencing its template, in seeded and custom
  routines alike, with the surviving steps renumbered to close the gap in
  `uq_routine_steps_sequence`; a routine left with no steps is left in place,
  empty;
- the `exercise_templates`, `exercise_ruleset_versions` and `exercise_types`
  rows themselves, and its `exercise_type_tags` rows;
- any stats rows or materialised values keyed to it.

Erased from the repository:

- the engine module, step adapter, panel component, ruleset config schema,
  validator, registry entries, stats spec, replay wiring and every test that
  names the type;
- `database/seeds/0024_switching_target_scoring_exercise_type.sql` and
  `database/verification/0024_switching_target_scoring_seed_checks.sql`, with
  the `database/README.md` verification row that points at the latter;
- `docs/game-rules/training/exercises/switching-target-scoring.md`, whose
  `Dropped` rows move to `switching.md` first;
- the type's rows in `database/seeds/0042_catalog_tags.sql`, by regeneration.

Erased on the client:

- the stats cache version is bumped so every stored entry keyed to the old
  type is discarded rather than rehydrated;
- any other persisted client state naming the type (local storage keys,
  service-worker caches) is enumerated during the plan and cleared the same
  way.

**Done means:** a repository-wide search for the type's name and key returns
nothing but the historical record in `decisions/` and in this document; a fresh
`db:migrate` + `db:seed` on an empty database produces no trace of it; and the
app runs clean with a cold client cache.

Deleting the seed files outright, rather than emptying them in place, is
deliberate: an erasure that leaves a tombstone seed is not an erasure. The
migration chain still records the removal.

## What survives

**Played Switching sessions are untouched, and their trend continues.**
Standard's stored configuration and its ruleset version key stay
byte-identical, so the `step_key` fingerprint
(`database/migrations/0045_stats_routine_views.sql`) is unchanged and no run
falls into the collapsed "earlier steps" bucket. Switching is step 2 of
Balanced Training and stays so.

Chain is then built fresh under the Switching type — a new ruleset version and
a new template — rather than inherited from the erased rows.

## Documents

Four new files under `docs/game-rules/`, which together close #799:

| File | Covers |
| --- | --- |
| `training/exercises/switching.md` | the merged exercise, both configs |
| `training/exercises/double-pattern.md` | `DOUBLE_PATTERN`, as built |
| `training/exercises/game.md` | the GAME wrapper: eligibility, duration delegation, results |
| `training/routines/balanced-training.md` | the seeded Balanced Training routine |

`training/exercises/switching-target-scoring.md` is **deleted**, and its
`Dropped` rows — the per-dart-position targets and the restart-every-visit
variant, both decided against on 2026-09-23 — move into `switching.md` so the
record of what was rejected survives. The same applies to Target Scoring's
double-scores-2 and double-keeps-the-chain rows where they bear on Chain.

Double Pattern, the GAME wrapper and Balanced Training are all **already
built**; their documents describe what exists and must not invent rules.

### Tag consequences

- `switching.md` gives Switching catalog tags for the first time. It has none
  today, because the tag seed is generated from the rules documents and
  Switching had none.
- `switching-target-scoring.md`'s tag rows disappear with the type.
- `double-pattern.md` adds Double Pattern's tags.
- `game.md` adds none: the generator skips the `GAME` key by design.
- `balanced-training.md` adds none: routines carry no tags.

`database/seeds/0042_catalog_tags.sql` is regenerated, never hand-edited. Tag
ids are positional and append-only, so no value may be inserted mid-table in
`TAGS.md`.

## Calls made by the author of this document

Settled here rather than asked, because a sensible builder would settle them
the same way. Each is reversible.

1. **Config names are Standard and Chain** — approved by the author.
2. **The ruleset version key carries the mode**, not the configuration.
   Standard stays `SWITCHING_V1` with its config untouched, which is what
   preserves its trend; Chain gets a new ruleset version under the Switching
   type. Putting a `mode` field in the configuration was rejected outright: it
   changes Standard's `step_key` and breaks the trend.

   Chain's *rules* are carried over verbatim from the erased type — the fold
   is re-created, not re-invented — but it carries over as new code under new
   names, not as a renamed file. Erasure comes first; the Track-kernel spec it
   is rebuilt from is the one already in the repository.
3. **The two difficulties are labelled in the rules document**, as a game's
   routine-step block already does — `BEGINNER (Standard), INTERMEDIATE
   (Chain)` — and pinned per template through
   `exercise_templates.difficulty_tag_id` (migration 0047). This requires
   widening the tag grammar; see Scope added below.
4. **The type-level Pressure tag is `RESET`.** The tag vocabulary allows an
   exercise exactly one value per axis for Pressure, so per-config pressure
   cannot be expressed: `NONE` is exclusive and cannot sit beside `RESET`.
   `RESET` describes Chain and overstates Standard. The alternative, `NONE`,
   understates Chain, which is the config a player would filter for. *Known
   imprecision — see Open questions.*
5. **The migration deletes by predicate**, not by named session id: one file
   runs against both dev and prod and the ids differ. It raises the deleted
   counts as a `NOTICE` and stays replayable on a fresh database.
6. **`switching.md` declares `Kernel: TRACK`**, matching both engines' rows in
   `scripts/engine-kernels.txt`, and states plainly that the Standard engine's
   fold is still hand-written and its Track migration still `PENDING`. That
   migration is not in scope here.
7. **`game.md` is written as an exercise document** and satisfies the gate,
   with an explicit line naming the fields that do not apply to a wrapper: its
   kernel is the wrapped game's, and its tags are never generated because the
   seed generator skips the `GAME` key by design.
8. **`DartExerciseKind` becomes a composite key** — `SWITCHING:STANDARD` and
   `SWITCHING:CHAIN` — so each config keeps its own metric set and headline.
   The client stats cache version is bumped with it.

## Scope added by call 3

Letting an exercise's tag table carry labelled difficulties is a change to the
tag design, not just to this exercise. It touches:

- `docs/game-rules/TAGS.md` — the Routine step rule, which today restricts
  multi-value Difficulty to a game's `### Routine step` block;
- `app/scripts/tags/parse-tags.ts` — `checkAxisRule` and the label rules;
- `scripts/check-game-rules.sh` — the mirrored gate;
- `app/scripts/generate-tag-seed.ts` — which today drops the Difficulty axis
  entirely when a block is multi-labelled;
- `app/tests/integration/template-difficulty-parity.itest.ts` — the doc-to-
  database parity check;
- a decision record in `decisions/context-system.md`, as TAGS.md requires for
  any change to the tag rules.

## Left to the builder

- How the ruleset version key reaches the engine, the panel, the summary and
  the stats spec.
- Chain's new ruleset version key and number, and whether
  `(exercise_type_id, version_number)` carries a unique constraint that
  constrains the choice.
- The seed and migration numbering, and how the erasure splits across
  migrations.
- The exact copy on the two config rows beyond their names.
- The full list of persisted client state to clear, found by search rather
  than assumed.

## Open questions

- **Per-config pressure tags.** Difficulty now escapes the one-value-per-axis
  rule through labels and `difficulty_tag_id`; pressure has no equivalent, so
  an exercise whose configs differ in pressure still cannot say so. Worth its
  own decision if a second exercise hits it. Not blocking: call 4 picks a
  value and says what it costs.
