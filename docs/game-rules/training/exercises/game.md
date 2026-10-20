# Game

Current version: V1 (shipped 2026-09-20)
Entry points: routine step
Kernel: HAND_WRITTEN

**Read the two caveats in `## Exercise type` before this file's header fields
or its `## Tags` table are quoted anywhere.** `Game` is the wrapper that runs
a whole game as a routine step. It has no rules of its own, so two fields the
exercise template requires are not claims about any game: `Kernel:` is the
wrapper's, and the Tags table satisfies the rules gate and nothing else.

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Wraps one game, pinned per template | V1 | Single | |
| The exercise owns the lifecycle; the game owns the mechanics | V1 | Single | |
| The step's duration is the game's own timed-mode clock | V1 | Single | |
| The game's own end is the step's end | V1 | Single | |
| Eligibility: a native timed mode | V1 | Single | |
| Eligibility: the ruleset declares `ANALYTICS` and `VISUAL_BOARD` | V1 | Single | |
| Eligibility: the ruleset version is listed on both the server and the client | V1 | Single | |
| A step whose game is not eligible is refused, at build time and at start | V1 | Single | |
| Eligible games: Ten Up One Down, Score Training, 121, Around the Clock | V1 | Single | |
| The step's minutes are bounded by the wrapped game's own range | V1 | Single | |
| Generated catalog tags | Dropped | All | `app/scripts/generate-tag-seed.ts` skips the `GAME` key by design, so this file's Tags table produces no `exercise_type_tags` rows. A routine step's tags come from the wrapped game's own `### Routine step` block instead — see Exercise type |
| Standalone entry | Dropped | All | A game played on its own is simply that game, reached from `app/src/pages/games/`. The wrapper exists only to make a game a routine step; there is nothing for it to do outside a routine |

## Identity

- Put a whole game inside a training: ten minutes of Ten Up One Down as the
  finisher, or Score Training as the scoring block, counted and summarised by
  the routine the same way a drill step is.
- It adds no dartboard rule at all. Scoring, targets, busts and the end
  condition are the wrapped game's, unchanged from playing it standalone.

## Tags

**Derived, and never generated.** Every value below is the union of the four
routine-eligible games' own `### Routine step` tag blocks
(`../../rulesets/ten-up-one-down.md`, `../../rulesets/score-training.md`,
`../../rulesets/121.md`, `../../rulesets/around-the-clock.md`). It describes
what a GAME step can be, not what one is: no single step is all of these, and
the wrapper itself has no skill, mechanic or difficulty. See Exercise type for
why nothing reads it.

| Axis | Tags |
| --- | --- |
| Skill | CHECKOUT (primary), DOUBLES, SCORING, ACCURACY |
| Session role | CORE, FINISHER, WARM_UP |
| Format | SOLO |
| Difficulty | BEGINNER (Score Training), INTERMEDIATE (Around the Clock — 1 dart), ADVANCED (Ten Up One Down / 121 / Around the Clock — 2 darts), EXPERT (Around the Clock — 3 darts) |
| Mechanic | COUNTDOWN, LADDER, ACCUMULATION, SEQUENTIAL |
| Pressure | SETBACK |

Two rows are narrower than the union, for reasons in the vocabulary rather
than the rules:

- **Pressure** should also carry `NONE` (Score Training and 121), but `NONE`
  is exclusive in `../../TAGS.md` §Axes and may not share a row. The stricter
  value is listed, the same choice Switching made.
- **Difficulty** takes one value unless every value carries a label (D473,
  `decisions/context-system.md`), so each is labelled with the game it comes
  from. Labelling them all means the block links no Difficulty tag at all —
  which is correct here: a GAME template's level is its own, set through
  `exercise_templates.difficulty_tag_id`.

## Exercise type

- Type constant: `GAME` (`database/seeds/0014_exercise_types.sql`).
- **The shipped date is the delegation boundary's, not the constant's.** The
  type was seeded earlier, but what this document describes — one clock, the
  game's own, resolved from an eligibility table — landed with migration
  `0040` and seeds `0021`/`0022` on 2026-09-20 (§11, §17 Game Exercise).
- **It has no exercise ruleset version.** Every other exercise type seeds one
  or more `exercise_ruleset_versions` rows; `GAME` seeds none. A GAME step's
  `exercise_ruleset_version_id` is `NULL` and the template pins a *game*
  ruleset version instead (`exercise_templates.game_ruleset_version_id`,
  seeds `0021`, `0022`, `0028`).
- **It has no engine module.** There is no `game.engine.module.ts` under
  `app/src/modules/training/exercises/`, and so no row in
  `scripts/engine-kernels.txt`. The work a dart exercise's engine does is done
  by the wrapped game's `GameEngine`.

### Caveat 1 — `Kernel:` is the wrapper's, not any game's

`Kernel: HAND_WRITTEN` is a statement about this wrapper: it is not built on a
rule kernel, because it holds no rules to fold. **It is not a claim about the
game a step wraps.** Each eligible game's kernel is its own row in
`scripts/engine-kernels.txt` — Ten Up One Down and 121 are `CHECKOUT`, Score
Training is `VISIT_POINTS`, Around the Clock is `TRACK` — and reading this
file's header as the step's kernel would be wrong for all four.

The field cannot be left out: `scripts/check-game-rules.sh` requires a
`Kernel:` header wherever `Entry points:` is required, and its six legal
values (Pattern 18 §Rule-kernel families) have no "not applicable".

### Caveat 2 — the Tags table is never generated

`app/scripts/generate-tag-seed.ts` skips the `GAME` key explicitly
(`if (!key || key === "GAME" || …) continue;`), so this file contributes no
`exercise_type_tags` rows and the catalog never shows these values. That is
deliberate, not an omission: the generator derives a `ROUTINE_STEP` tag block
for every game ruleset from its own `## Tags` section (`withRoutineStep()`),
so a routine step's tags are already the wrapped game's, read from the game's
own rules file. A tag on `GAME` would be a second, worse answer to a question
already answered.

The table still has to be here and still has to be valid: the gate requires a
`## Tags` section on every exercise, with all six non-Family axes in
`../../TAGS.md` order.

## Objective

- Play the wrapped game, to that game's own objective, for the step's
  minutes. The routine adds no goal on top.
- A good run is a good run of that game. Every number in the step summary is
  the game's — Ten Up One Down's ladder, Score Training's points, 121's
  ladder, Around the Clock's laps and accuracy (§17 Game Exercise).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Game | Fixed by the template; one pinned ruleset version | Chosen by template, not edited |
| Duration | The template's default minutes (10 for every seeded template) | Routine step configuration |
| Everything else | The template's `default_configuration` for that game | Chosen by template, not edited |

A routine step may override the duration (`routine_steps.duration_value`);
the step's minutes replace the template's and are written into the game's own
`duration_type` / `duration_value` keys at start (`injectGameStepDuration`,
`app/src/services/training-session.service.ts`). The minutes are rejected
outside the wrapped game's own timed range — 3 to 30 for all four today
(`tuodDurationBounds`, `scoreTrainingDurationBounds`,
`oneTwentyOneDurationBounds`, `aroundTheClockDurationBounds`).

## How to practise

**Single:** one player per run. A GAME step seats exactly one participant
(`gameAdapter`'s `open`, `app/src/lib/training/routines/adapters/game.adapter.ts`),
even where the game supports 1v1 standalone.

### Visit

- The wrapped game's. Visit length, what a dart may be thrown at and what it
  scores are all defined in that game's rules file; this document restates
  none of it.

### Progress

- **The exercise owns the lifecycle, the game owns the mechanics**
  (`09-Training/01-Routines.md` §11). The training starts the step and reads
  its result; everything between is the `GameEngine`, which never learns it
  is inside a routine (§2, §10).
- **One clock, not two.** The step's duration *is* the game's native
  timed-mode clock, not a step timer running alongside it. The step's minutes
  are written into the game's own duration keys before the game starts, so
  the game ends the way its standalone timer would, and **that end is the
  step's end** (migration `0040`, 2026-09-20). The exercise layer never wraps
  or races the game's expiry.
- **Eligibility.** A game may be a step only when all three hold at once
  (§11):
  1. it has a native timed mode, so the step's minutes become that mode's own
     duration value rather than a bolted-on clock;
  2. its ruleset version declares both `ANALYTICS` and `VISUAL_BOARD` in
     `RULESET_CAPABILITIES` (`app/src/lib/game/rulesets/capabilities.ts`);
  3. its ruleset version key is listed in **both** `ROUTINE_GAME_STEPS`
     (server, `app/src/services/routines/game-step.ts`) and `STEP_ADAPTERS`
     (client,
     `app/src/lib/training/routines/adapters/step-adapter.registry.ts`).
- **The two tables are hand-mirrored.** The client may never import server
  code, so there is no shared constant: they are two lists kept in agreement
  only by
  `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`,
  not by the type system. A key added to one and not the other is a test
  failure, and nothing else catches it.
- **Currently eligible:** `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`,
  `AROUND_THE_CLOCK_V2` (D360, `decisions/game-engine.md`). `121_V1` is
  **not**: it is TARGET-only, with no timed mode, even though it declares the
  same capture pair as `121_V2`. Declaring the pair is necessary and not
  sufficient.
- **A refusal reads the same from both ends.** A step whose pinned ruleset
  resolves no hook fails `VALIDATION_FAILED` with reason `game not
  routine-eligible` — when the routine is saved (`routine.service.ts`) and
  again when the step is started (`training-session.service.ts`).

### Bound

- **The wrapped game's timed mode, set to the step's minutes.** There is no
  exercise-level bound to describe, because there is no exercise-level clock.
- A game with no timed mode has nothing to bind and is not eligible, which is
  why the first eligibility rule exists at all.

## Later versions

### Variants

- None of its own. The wrapper gains a "variant" only when another game
  becomes eligible, and that is a change to that game's rules file and to the
  two eligibility tables — not to this document's rules.

### Other

- More eligible games, as timed modes land. Each addition is a row in
  `ROUTINE_GAME_STEPS`, a matching `STEP_ADAPTERS` entry, and an update to the
  eligible list above and in §11.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair — `ROUTINE_CAPTURE_MODE_KEY` and
  `ROUTINE_INPUT_MODE_KEY` (`app/src/services/routines/game-step.ts`), the
  same pair a dart exercise step uses. Unlike a dart exercise step, a GAME
  step's session row also carries the game pair: one `exercise_sessions` row
  holds the `GAME` exercise type *and* the game type, the pinned ruleset
  version and the capture pair (`startGameStep`,
  `app/src/services/training-session.service.ts`).
- **One dart's fact:** the wrapped game's. The wrapper records nothing — its
  step adapter returns no facts of its own (`facts()` returns `null`,
  `game.adapter.ts`) and the game's engine writes the darts, with whatever
  intended target and zone that game sets.
- **Stage type:** the wrapped game's stages. A GAME step opens no
  `EXERCISE_BLOCK` stage; that stage belongs to the dart exercises.
- **Derived, never stored:** the step summary rows, folded from the finished
  game's own results snapshot (`summariseTuodStep` and its three siblings,
  `game.adapter.ts`). The routine stores no number of its own for the step.
- The wrapper produces no score. The wrapped game produces whatever score it
  produces; an exercise engine need not produce a conventional one (§13).

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Eligibility** | V1 | The three conditions a game ruleset version must meet at once to be a routine step |
| **Standalone entry** | Dropped | Playing a run outside a routine |

## Open questions

- **The eligible list goes stale silently here.** Nothing gates this file
  against `ROUTINE_GAME_STEPS`; the list above, §11's and the registry test's
  are three hand-kept copies. Should the kernel/rules gate learn to check it,
  the way `check-engine-kernels.sh` checks a `Kernel:` header?
- **The Tags union goes stale the same way.** A fifth eligible game changes
  what a GAME step can be, and nothing reads this table, so nothing would
  fail. Is a never-read table worth keeping accurate, or should the gate grow
  an "intentionally empty" Tags form instead?
- **Is a 1v1 GAME step wanted?** Three of the four eligible games are 1v1
  standalone; a step seats one. No decision records whether that is a
  limitation or the design.
