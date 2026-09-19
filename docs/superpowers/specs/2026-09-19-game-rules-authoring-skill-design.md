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
| D-i | The doc carries a one-line `Current version:` header field — the only as-built fact it holds |
| D-j | Post-V1 scope takes an explicit number (`V2`, `V3`, …) once it is being built; `V2+` stays the unscheduled bucket |
| D-k | The gate enforces `Features` ↔ `Glossary` agreement for named variants |
| D-l | An amendment that changes an **already-shipped** rule is blocked until a `decisions/**` block exists, in the domain `DECISIONS.md` routes to |
| D-m | A training-only rule never becomes a training-aware branch in a game ruleset; a test routes it to a game variant or to its own exercise type |
| D-n | `Features` gains an `Applies to` column (`All` / `Single` / `1v1` / `2+`); seat-conditional statements carry the same token |
| D-o | The skill writes only what it verified in a named file; unverifiable → halt and ask |
| D-p | Execution model and entry points are **independent axes**; standalone playability does not make something a game |
| D-q | `Entry points:` is a second header field; gaining `standalone` forces config, end condition and result in the same pass |
| D-r | A genuine execution-model change is `git mv` + a `decisions/**` block, no pointer stub |
| D-s | `### Ends when` and `### Result` are required subsections whenever `Entry points:` includes `standalone` |
| D-t | A `Glossary` term matches a `Features` row when the bold term appears verbatim inside the row's name |
| D-u | Assertions bind per shape, per the matrix below — not uniformly |
| D-v | A `Dropped` row stays in `Features` permanently; the reason is what prevents re-proposal |

### D-h supersedes today's README

`docs/game-rules/README.md` currently states the raw-notes file "is disposable
once translated". Under D-b + D-h it is not: it is the only place the deferred
V2+ scope and its reasons live. The README's "Translation mechanism" paragraph
and the Context Map's "Non-Canonical Source Material" section must both be
amended. The file stays **non-canonical** — an input, never authority — but it
is now maintained: when a deferred feature is picked up, its row moves
`V2+` → `V<n>` in the same PR. It never moves to `V1` — V1 is whatever
shipped first, and is not reopened (see amend mode).

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
| `V2`, `V3`, … | Scheduled for that specific later version — it is being built; reason required |
| `V2+` | Wanted, not scheduled; reason required |
| `Deferred` | Postponed on a named blocker; reason required and must name the blocker |
| `Dropped` | Decided against; reason required |

A `Dropped` row is never deleted (D-v). The row and its reason are the only
thing standing between the project and the same idea being re-proposed in a
year; git history does not surface at authoring time. The table grows slowly
and that is the intent of a permanent register (D-h).

`TBD` is banned from the **`Version` column** — an undecided item belongs in
`## Open questions

- **Sequencing (blocking).** Does the gate land only after the #464/#465
  backfill, or warn-only first and flipped to blocking by the backfill PR?
  Nothing else here can be implemented until this is chosen.
- Backfill must add `Current version:` to all 11 rulesets — is the shipped
  date taken from the engine's design spec, or the merge date of its PR?
- Does the routine template name exercises by filename or by exercise-type
  constant (`SWITCHING`), and does the gate resolve that reference? The
  routine V1 corollary ("every exercise it names is itself at V1") is a
  cross-file check that needs a resolvable key to be enforceable at all.
- Does `training/routines/` need per-step config validation in the gate, or is
  that the engine's problem?
- Where does an exercise type record that it wraps a game — a named field in
  `EXERCISE_TEMPLATE.md`, or prose? The gate can only cross-check a field.
- Is `2+` enough, or do `2v2` and free-for-all need distinct tokens once
  `501.md`'s `sideKey` folding is used for real teams?
- Assertion 9 runs Glossary → Features only, so a named variant that never
  reaches the Glossary is invisible to the gate. Accepted; the skill's amend
  step 4 is what catches it. Revisit if it leaks.
