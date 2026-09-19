# Shape: Game Ruleset

Template: `docs/game-rules/templates/GAME_RULESET_TEMPLATE.md`
Folder: `docs/game-rules/rulesets/`
Translation target: `docs/architecture/05-Database/10-Database-Agent-Guide.md`
§"Add a new game type"

## What makes it a game

A seeded `game_types` row and a `GameEngine`. Nothing else does — not being
standalone-playable, not being scored, not involving darts. If the subject
needs neither, it is an exercise or a trivia tool.

## Required headings

`Features` · `Identity` · `Objective` · `Config & presets` · `How to play`
(with `### Ends when` and `### Result` when standalone) · `Later versions` ·
`Capture` · `Glossary` · `Open questions`

`Known limitations` is optional — add it when the chosen capture mode cannot
recover something the player would expect to see. `501.md` is the worked
example: under QUICK_SCORE a bust is indistinguishable from a scoreless visit,
so bust rate is not computable at all.

## Header fields

```
Current version: none (V1 in design)
Entry points: standalone
```

A game is `standalone` unless it is also usable as a routine step, in which
case `standalone, routine step`.

## The V1 cut test here

> One player reaches a start state from config, resolves **every** legal visit
> deterministically (score, bust, advance), reaches a terminal state, and sees
> a result.

"Every legal visit" is the load-bearing phrase. A game whose rules leave one
visit outcome undefined is not at V1 however complete the feature list looks —
that undefined case becomes a runtime decision made by whoever writes the
engine, which is exactly what this document exists to prevent.

## Capture

All four questions, always:

- **Capture / input mode** — RECREATIONAL + QUICK_SCORE (visit totals, no dart
  rows), RECREATIONAL + DETAILED_DARTS (a row per dart), or ANALYTICS (full
  intention and result per dart). A game may implement more than one;
  `501.md` documents both QUICK_SCORE and ANALYTICS + VISUAL_BOARD.
- **One dart's fact** — intended target and ring, what the hit records, and
  what `score` holds. `score` is always the dart's **board** score. A
  game-specific point value (Bob's 27 points, Shanghai multipliers) is derived,
  never stored.
- **Stage type** — `LEG`, `ROUND`, `EXERCISE_BLOCK`, … and when a new one opens.
- **Derived, never stored** — running score, leg wins, averages, ratios.

The engine-side contract this feeds is
`docs/architecture/04-Architecture-patterns.md` Pattern 18.

## Common traps

- **Writing the engine.** "The engine keeps a `remaining` field" is
  implementation. "Each scoring dart subtracts from the remaining total" is a
  rule.
- **Re-teaching the dartboard.** Singles, doubles, triples and bulls are
  assumed. Explain only what this game does differently — Bob's 27 counting
  only the target double, Doubles Training treating outer bull as a miss.
- **A variant with no Glossary row.** Every named in/out rule, format or mode
  needs its definition, marked with the version it arrives in.
- **Match structure smuggled into V1.** "Best of N" usually waits for
  multiplayer. If V1 is single-player, say "first to N" and defer the rest with
  a reason.
