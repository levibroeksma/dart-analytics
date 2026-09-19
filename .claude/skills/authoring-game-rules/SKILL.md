---
name: authoring-game-rules
description: Use when writing or changing the rules of a dartboard game, training exercise, routine or trivia tool in docs/game-rules/ — a new game or drill, a new mode/variant/setting on an existing one, deciding what a playable V1 must contain, or recording what was deferred and why. Runs before superpowers:brainstorming and produces its input; it designs rules, never engines.
---

# Authoring Game & Training Rules

Produces the rules document that `superpowers:brainstorming` later designs a
spec from. In scope: the **rules**. Out of scope: the engine, the schema, the
UI.

These files are permanent. A rules file is the standing register of what a
version deferred and why — not a disposable note. It is amended with targeted
edits, never regenerated.

## Verify, never assume

**Write only what you verified in a named file.** Cite where each rule was
confirmed — a file and line, or an architecture section.

Never assume:

- that a rule holds because a sibling ruleset states it;
- that something shipped because `Features` says `V1` — `Current version:` is
  the only source, and the engine in `app/` confirms it;
- that an engine supports a mode because a rules document describes it;
- that a player count works because `Features` claims it — the `Config &
  presets` row and the engine are the check;
- that an `Open question` is still open, or still closed;
- that something is a game because it is standalone-playable, or an exercise
  because it appears in a routine — `game_type_id` in the seed and the engine
  it runs on are the check, never the folder the doc sits in.

**When a claim cannot be confirmed: halt.** Say what could not be verified and
where you looked, then ask. Do not write the claim, do not mark it unverified,
do not downgrade it to an open question and continue. An unverified rule is
worse than a missing one — the next reader cannot tell which it is.

## Step 0 — which mode

Does a rules file already exist for this subject?

- **No** → author mode, below.
- **Yes** → [amend mode](references/amending.md). Never re-run author mode over
  an existing file.

## Step 1 — which shape

| Shape | Folder | Reference |
| --- | --- | --- |
| Game | `docs/game-rules/rulesets/` | [game.md](references/game.md) |
| Exercise type | `docs/game-rules/training/exercises/` | [exercise.md](references/exercise.md) |
| Routine | `docs/game-rules/training/routines/` | [routine.md](references/routine.md) |
| Trivia tool | `docs/game-rules/training/trivia/` | [trivia.md](references/trivia.md) |

Load that one reference file and copy the matching template from
`docs/game-rules/templates/`.

**Two independent axes — state both before writing.** Conflating them is the
likeliest error here:

| Axis | Values |
| --- | --- |
| Execution model | **game** (`GameEngine`, seeded `game_types` row) · **exercise** (`ExerciseEngine`, `game_type_id` nullable) · **trivia** (neither, no persistence) |
| Entry points | **standalone** · **routine step** · **both** |

Standalone playability does **not** make something a game. Warm-Up is seeded
with `game_type_id NULL` (`database/seeds/0015_warm_up_routine.sql:32`) and is
used both standalone and inside Balanced Training
(`docs/architecture/09-Training/01-Routines.md:379`).

## Step 2 — brain-dump

Every feature, mode, setting, variant and format the author can name. Breadth
first. Do not cut yet, and do not sort.

## Step 3 — the V1 cut test

> A feature is **V1 only if, without it, the thing cannot be used at all.**

| Shape | "Used at all" means |
| --- | --- |
| Game | One player reaches a start state from config, resolves **every** legal visit deterministically (score, bust, advance), reaches a terminal state, and sees a result |
| Exercise | One player starts it, resolves every visit against its current target, and it ends on its own bound |
| Routine | It starts, steps through in order, and completes — and **every** exercise it names is itself at V1 |
| Trivia | One player is shown a question, answers it, is told whether they were right, and finishes a set |

Apply it to each item, one at a time. Record the verdict.

Two corollaries:

- **A routine cannot ship above its weakest exercise.** A routine naming a
  `V2+` exercise type is itself `V2+`.
- **A game or exercise is not V1 until `Capture` is answered.** A state shape
  that cannot be persisted is not playable, only demoable.

## Step 4 — force the defer list

Every non-`V1` verdict gets a row **and a reason**. A row without a reason is
not finished.

| Value | Meaning |
| --- | --- |
| `V1` | Ships in the first playable version |
| `V2`, `V3`, … | Scheduled for that version — being built now |
| `V2+` | Wanted, not scheduled |
| `Deferred` | Postponed on a named blocker; the reason names it |
| `Dropped` | Decided against; the reason says why |

`TBD` is not a version. An undecided item goes to `## Open questions`, never
into the `Version` column.

**Deferring is not dropping.** A deferred feature is still described in full,
in the same document. That list is the deliverable, not a residue. A `Dropped`
row is never deleted — its reason is what stops the idea being re-proposed.

A named variant lands in **every** slot at once: a `Features` row, a definition
under `Later versions` §Variants, a `Glossary` term, and a `Config & presets`
row only if the player picks it. The Glossary term must appear verbatim inside
its `Features` row name.

## Step 5 — player-count applicability

`Applies to` takes `All`, `Single`, `1v1` or `2+` (games, exercises and
routines; trivia has no seats). A row that is not `All` needs at least one
token-prefixed statement in the body:

```
**1v1:** first to check out 170 wins; the match ends immediately.
```

A file declaring any `1v1`/`2+` feature must not also present `Players` as
locked to single player.

## Step 6 — capture

Games and exercises only; **absent** for routines and trivia. Answer all four:
capture/input mode, one dart's fact, stage type, and what is derived rather
than stored.

`score` is always the dart's **board** score — never a game- or
exercise-specific point value.

Unanswerable → the V1 scope is wrong. Return to step 3.

## Step 7 — standalone requirements

If `Entry points:` includes `standalone` (or the shape is a routine or trivia
tool, which always are), `### Ends when` and `### Result` are both required,
plus a non-empty `Config & presets`. A routine step inherits all three from its
routine; a standalone run has nothing to inherit.

## Step 8 — open questions and gate

Write `## Open questions` for what is genuinely undecided. Then:

```bash
bash scripts/check-game-rules.sh
```

## Relationship to other skills

- **`superpowers:brainstorming`** runs *after* this skill and consumes its
  output. Brainstorming owns the spec; this skill owns the rules document the
  spec is designed from.
- **`capturing-discovered-work`** — a contradiction you notice in a file the
  task did not ask you to change is a GitHub issue, never a fix in this pass.
- **`context-maintenance`** — a new rules file needs no File Inventory row
  (`docs/game-rules/` is non-canonical), but a new template or gate change
  does.
