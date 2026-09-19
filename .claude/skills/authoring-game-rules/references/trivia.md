# Shape: Trivia Tool

Template: `docs/game-rules/templates/TRIVIA_TEMPLATE.md`
Folder: `docs/game-rules/training/trivia/`
Architecture: `docs/architecture/09-Training/02-Trivia.md`

## What a trivia tool is

A standalone practice or study tool — a quiz, a drill, a flashcard set — played
**outside the `game_types` model entirely**. No `GameEngine`, no
`ExerciseEngine`, no runtime rows.

The precedent is Quick Subtract (D261): a `modules/training/trivia/` client
tool, class-based, outside the `GameEngine` contract, with no `game_types` row
and no persistence. A new tool follows that precedent rather than re-deciding
it. Checkout Trivia's architecture is written in `02-Trivia.md` but unbuilt.

## Required headings

`Features` · `Identity` · `Objective` · `Question model` ·
`Answer & feedback` · `Set structure` · `Config & presets` · `Ends when` ·
`Result` · `Persistence` · `Later versions` · `Glossary` · `Open questions`

**No `Capture` section** — nothing is persisted, so there is no fact to
capture. **No `Applies to` column** — a trivia tool has no seats and no
opponents, so the column would read `All` on every row forever. The Features
table is `| Feature | Version | Reason |`.

**No `Entry points:` field** — a trivia tool is standalone by definition
(`02-Trivia.md`: "fully standalone … no dependency on `01-Routines.md`").

## Header fields

```
Current version: none (V1 in design)
```

## The V1 cut test here

> One player is shown a question, answers it, is told whether they were right,
> and finishes a set.

Explanations, better-route hints, custom ranges and statistics are all above
that line. Checkout Trivia's "show a better route with an info button" is a
good example of something that reads as essential and is not: the tool is
usable without it.

## Persistence is a rule, not an omission

State plainly what survives a session. For a tool following the Quick Subtract
precedent, the answer is **nothing**. Write that down — silence reads as an
unanswered question, and the next reader will assume a table is needed.

## Common traps

- **Designing the interface.** A keypad layout sketch is useful raw material,
  but the rule is "the player builds an answer dart by dart", not the button
  grid. Keep the sketch under `Answer & feedback` if it clarifies; do not let
  it become the specification.
- **Assuming a `game_types` row.** Trivia tools have none. If the subject needs
  one, it is not a trivia tool.
- **Smuggling in a score history.** Persistence is a deliberate exclusion, not
  an oversight to be corrected.
