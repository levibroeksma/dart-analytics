# Trivia Tool Template

Copy the shape below into each trivia tool under
`docs/game-rules/training/trivia/`. A **trivia tool** is a standalone practice
or study tool — a quiz, a drill, a flashcard set — played outside the
`game_types` model entirely.

The precedent is Quick Subtract (D261): a `modules/training/trivia/` client
tool, outside the `GameEngine` contract, with **no `game_types` row and no
persistence**. Checkout Trivia's architecture is written in
`docs/architecture/09-Training/02-Trivia.md`. A new tool follows that precedent
rather than re-deciding it.

Because nothing is persisted, a trivia file carries **no `Capture` section**
and **no `Applies to` column values other than `All`** — it has no seats and no
opponents. It carries no `Entry points:` field either: a trivia tool is
standalone by definition (`02-Trivia.md` §"fully standalone").

Authoring and amending are driven by the `authoring-game-rules` skill.

---

## Authoring rules (do not copy into trivia files)

- Describe what the player is asked and how they answer, not the component
  tree.
- If the tool records nothing between sessions, say so explicitly — that is a
  rule, not an omission.
- Headings carry no version number.
- Version vocabulary is identical to `GAME_RULESET_TEMPLATE.md`.

---

## Trivia sections (copy from here down)

# [Tool name]

Current version: none (V1 in design)

## Features

| Feature | Version | Reason |
| --- | --- | --- |
| … | V1 | |

## Identity

- One short pitch: what this drills and why it is worth drilling off the board
- What it deliberately excludes

## Objective

- What a correct answer looks like
- Whether speed, accuracy, or both are what the player is working on

## Question model

- Where the questions come from (a range, a table, a generated set)
- What one question consists of
- Whether a question has exactly one right answer, or several with a preferred
  one

## Answer & feedback

- How the player enters an answer
- What they are told immediately after answering
- Whether a better answer is shown, and whether an explanation is offered

## Set structure

- How many questions in one set, and whether that is configurable
- Whether order is fixed, random, or filtered by a range the player picks

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| … | … | Shown, locked / Editable |

## Ends when

What ends a set — the question count, a time, or the player stopping.

## Result

What the player sees at the end: the score, the answers they gave, and what
is shown about the ones they got wrong.

## Persistence

State plainly what survives the session. For a tool following the Quick
Subtract precedent, the answer is **nothing** — no `game_types` row, no
runtime rows, no history.

## Later versions

### Variants
- Selectable switches, with definitions. Every name has a Glossary row.

### Other
- Anything else unlocked later

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **…** | V1 | … |

Every term here appears verbatim inside a Features row name.

## Open questions

- Undecided choices. A settled question is struck in place —
  `~~question~~ **Resolved:** …` — never deleted.
