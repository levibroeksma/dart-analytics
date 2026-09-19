# Game & Training Rules Authoring — Template + Skill Design

Date: 2026-09-19
Branch: `claude/game-ruleset-docs-template-6ukabm`
Status: design agreed, not implemented

---

## Problem

`docs/game-rules/` holds the pre-spec rules notes that feed
`superpowers:brainstorming`. Today it serves games only, and unevenly:

1. **Only one shape exists.** `templates/GAME_ENGINE_TEMPLATE.md` fits a
   board game (leg / visit / bust). `training/routines/` holds a README and
   nothing else, despite `09-Training/01-Routines.md` and five roadmap specs.
   `training/trivia/checkouts.md` is free-form prose in no template at all.
2. **A mandatory section is silently skipped.** The template marks `## Capture`
   "Required — do not skip"; it is absent from `around-the-clock`, `cricket`,
   `shanghai` and `tactics`. Around the Clock and Shanghai shipped anyway.
   Nothing enforces the template.
3. **The Version column is ambiguous.** `V1` / `v1` / `TBD` are mixed, and
   `TBD` conflates "undecided" with "deliberately deferred". A deferred
   feature carries no reason, so nothing records *why* it was cut.
4. **No cut rule.** The template asks the author to write a playable V1 but
   gives no test for deciding what V1 must contain. That judgement is the
   part a human most wants help with, and it is exactly what is missing.
5. **No skill.** There is no procedure that walks an author from a rules idea
   to a complete, cut-down, persistable V1 document.

## Scope

In scope: authoring the **rules**. Out of scope: the engine, the schema, the
UI. This work produces the document that `superpowers:brainstorming` consumes;
it never replaces the spec that brainstorming writes.

---

## Decisions

| # | Decision |
| --- | --- |
| D-a | Cover four shapes: game ruleset, exercise type, routine, trivia tool |
| D-b | Rules files record **intent plus an explicit defer reason**, not as-built status |
| D-c | V1 is decided by a hard playability test; every rejected feature is forced onto a defer list |
| D-d | A blocking gate script enforces the required sections |
| D-e | `training/exercises/` is a new folder, split from `training/routines/` |
| D-f | `_drafts/` subfolders are exempt from the gate |
| D-g | One skill, four reference files |
| D-h | A rules file is **permanent** — the standing register of deferred scope |

### D-h supersedes today's README

`docs/game-rules/README.md` currently states the raw-notes file "is disposable
once translated". Under D-b + D-h it is not: it is the only place the deferred
V2+ scope and its reasons live. The README's "Translation mechanism" paragraph
and the Context Map's "Non-Canonical Source Material" section must both be
amended. The file stays **non-canonical** — an input, never authority — but it
is now maintained: when a deferred feature ships, its row moves to `V1` in the
same PR.

---

## The V1 cut test

A feature is **V1 only if, without it, the thing cannot be used at all.**
Per shape, "used at all" means:

| Shape | V1 requires |
| --- | --- |
| Game | One player can reach a start state from config, resolve **every** legal visit deterministically (score, bust, advance), reach a terminal state, and see a result |
| Exercise type | One player can start the exercise, resolve every visit against its current target, and have it end on its own bound (time or count) |
| Routine | The routine can be started, stepped through in order, and completed — and **every** exercise it names is itself at V1 |
| Trivia | One player can be shown a question, answer it, be told whether the answer is right, and finish a set |

Two corollaries the skill enforces:

- **A routine cannot ship above its weakest exercise.** A routine whose steps
  include a V2+ exercise type is itself V2+.
- **A game is not V1 until its `## Capture` section is answered.** A state
  shape that cannot be persisted is not playable, only demoable. This is the
  root `CLAUDE.md` engine-task invariant, restated at rules-authoring time.

Everything failing the test is V2+ by default. **Deferring is not dropping:**
a deferred feature is still described in full, in the same document, with its
reason. That list is the deliverable, not a residue.

---

## Version vocabulary

The `Version` column takes exactly one of:

| Value | Meaning |
| --- | --- |
| `V1` | Ships in the first playable version |
| `V2+` | Planned for a later version; reason required |
| `Deferred` | Postponed on a named blocker; reason required and must name the blocker |
| `Dropped` | Decided against; reason required |

`TBD` is banned from the column — an undecided item belongs in
`## Open questions`, not in a scope table pretending to be a decision.
Lowercase `v1` normalises to `V1`. The feature table gains a third column:

```
| Feature | Version | Reason |
```

`Reason` is empty for `V1` rows and **required** for every other value.

---

## Templates

Four files under `docs/game-rules/templates/`. Shared sections in every shape:
`Features`, `Identity`, `Objective`, `Config & presets (V1)`,
`Later versions (V2+)`, `Glossary`, `Open questions`.

| Template | Adds | Lands in |
| --- | --- | --- |
| `GAME_RULESET_TEMPLATE.md` (revised `GAME_ENGINE_TEMPLATE.md`) | `How to play (V1)`, `Capture` | `10-Database-Agent-Guide.md` §"Add a new game type" |
| `EXERCISE_TEMPLATE.md` (new) | `Exercise type`, `How to practise (V1)`, `Bound` (time/count), `Capture` | `09-Training/01-Routines.md` §Exercise Type / `ExerciseEngine` |
| `ROUTINE_TEMPLATE.md` (new) | `Steps` (ordered exercise type + config + duration), `Total duration` | deferred `ROUTINE_RUN` write path (D64) |
| `TRIVIA_TEMPLATE.md` (new) | `Question model`, `Answer & feedback`, `Set structure`; **no** `Capture` | `09-Training/02-Trivia.md`; Quick Subtract precedent (D261) — no `game_types` row, no persistence |

`Capture` is required for games and exercises, forbidden for trivia (trivia
tools persist nothing), and not applicable to routines (a routine's capture is
its exercises').

Renaming `GAME_ENGINE_TEMPLATE.md` → `GAME_RULESET_TEMPLATE.md` is part of the
work: the file describes rules, not engines, and the old name is what invites
engine detail into a rules document.

---

## Folder layout

```
docs/game-rules/
  README.md
  templates/
    GAME_RULESET_TEMPLATE.md
    EXERCISE_TEMPLATE.md
    ROUTINE_TEMPLATE.md
    TRIVIA_TEMPLATE.md
  rulesets/            # games
  training/
    exercises/         # NEW — exercise types (WARM_UP, SWITCHING, …)
    routines/          # compositions of exercises
    trivia/            # standalone practice tools
  **/_drafts/          # exempt from the gate
```

`training/exercises/` mirrors `09-Training/01-Routines.md` §3.4: an exercise
type binds to an `ExerciseEngine` and a ruleset, and is reused across routines
with different configuration. Writing those rules inside each routine would
duplicate them, which the architecture explicitly forbids.

---

## Skill

`.claude/skills/authoring-game-rules/`

```
SKILL.md                    # shared procedure
references/game.md
references/exercise.md
references/routine.md
references/trivia.md
```

Mirrors `graph-lookup`'s `references/` pattern: the shared procedure loads
always, one shape file loads on demand.

**Procedure in `SKILL.md`:**

1. Identify the shape (game / exercise / routine / trivia) → load that
   reference file and copy that template.
2. Brain-dump every feature, mode, setting and variant the author can name.
   Breadth first — do not cut yet.
3. Apply the V1 cut test to each, one at a time. Record the verdict.
4. Force every non-`V1` verdict onto the defer list with a reason. A row with
   no reason is not finished.
5. Answer `Capture` (games and exercises). Unanswerable → the V1 scope is
   wrong, return to step 3.
6. Write `Open questions` for what is genuinely undecided. Nothing undecided
   may sit in the Version column.
7. Run `bash scripts/check-game-rules.sh`.

**Relationship to `superpowers:brainstorming`:** this skill runs **before** it
and produces its input. It is added to the pairing table in the root
`CLAUDE.md` under `superpowers:brainstorming`. Brainstorming still owns the
spec; this skill owns the rules document that the spec is designed from.

---

## Gate — `scripts/check-game-rules.sh`

Blocking. Scans `docs/game-rules/{rulesets,training/exercises,training/routines,training/trivia}/*.md`,
skipping `README.md` and any path containing `/_drafts/`. Shape is inferred
from the folder.

Assertions:

1. Every required heading for the shape is present (level and spelling exact).
2. A `Features` table exists with `Feature | Version | Reason` columns.
3. Every `Version` cell is one of `V1`, `V2+`, `Deferred`, `Dropped`.
4. Every non-`V1` row has a non-empty `Reason`.
5. `Capture` present for games and exercises; absent for trivia.

Headings must exist but need not be filled — an unfinished note either carries
the heading with `TBD` beneath it, or lives in `_drafts/`.

Wiring: added to the **Always run** block of the `run-all-gates` skill (it is a
fast markdown scan) and to `.husky/pre-commit` alongside the other doc gates.

---

## Context maintenance owed

- `00-File-Inventory.md`: rows for the skill, its four reference files, the
  four templates, the new gate script (`check-skill-pointers.sh` fails
  without the skill rows).
- `00-Context-Map.md`: amend "Non-Canonical Source Material" per D-h; add an
  "Authoring a game or exercise ruleset" context pack.
- `00-Context-Map-History.md`: version entry.
- `docs/game-rules/README.md`: new subfolder table row for
  `training/exercises/`, amended translation/lifecycle paragraph.
- `decisions/context-system.md`: one decision block (derive the id with
  `bash scripts/next-decision-id.sh`, re-run before opening the PR).
- Root `CLAUDE.md`: pairing-table row under `superpowers:brainstorming`.
- `run-all-gates` SKILL.md + `.husky/pre-commit`.

## Migration of existing files

The four rulesets missing `## Capture` (`around-the-clock`, `cricket`,
`shanghai`, `tactics`) and the `Reason` column across all 11 rulesets would
fail the new gate on day one. Backfill is **not** part of this task —
per the root `CLAUDE.md` discovered-work invariant it is captured as GitHub
issues and done in a separate pass. The gate lands only once the backfill has,
or lands warn-only and is flipped to blocking by the backfill PR.

`checkouts.md` must be restructured into `TRIVIA_TEMPLATE.md` shape in the
same backfill.

## Open questions

- Does the gate land blocking-after-backfill (two PRs) or warn-then-flip?
- Does `training/routines/` need per-step config validation in the gate, or is
  that the engine's problem?
- Does the routine template name exercises by filename or by exercise-type
  constant (`SWITCHING`), and does the gate resolve that reference?
