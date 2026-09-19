# Game Ruleset Template

Copy the shape below into each game ruleset under `docs/game-rules/rulesets/`.
Fill every section; use `TBD` only where the answer is genuinely not known yet,
and put the open decision under `## Open questions` as well.

These files are **descriptive human rules** — the source a later engine
specification is designed from, never the specification itself. They are
permanent: a ruleset is the standing register of what a version deferred and
why, revised when a later version ships. It is never regenerated.

Authoring and amending are driven by the `authoring-game-rules` skill. Read
that skill rather than reconstructing the procedure from this file.

---

## Authoring rules (do not copy into rulesets)

- Describe **how the game is played**, not how software implements it.
- Prefer plain language over algorithms, state machines, or UI flows.
- **Board scoring is assumed** (singles, doubles, triples, bulls). Re-explain
  only if this game breaks those norms.
- Write so someone can play the current version without reading later sections.
- Every game starts from a config screen. Early versions show presets, most of
  them locked; later versions unlock more fields.
- Name formats explicitly (**first to N** vs **best of N**).
- Every named variant gets a short plain-language definition in the Glossary
  and a row in Features, using the same wording.
- Define terms before you rely on them (e.g. **visit** before **bust**).
- Headings carry no version number. `## Later versions` is correct;
  `## Later versions (V2+)` goes stale the first time a V3 exists.

### Version vocabulary

| Value | Meaning |
| --- | --- |
| `V1` | Ships in the first playable version |
| `V2`, `V3`, … | Scheduled for that specific later version — it is being built |
| `V2+` | Wanted, not scheduled |
| `Deferred` | Postponed on a named blocker; the Reason names the blocker |
| `Dropped` | Decided against; the Reason says why |

`TBD` is not a version. Every value except `V1` requires a `Reason`. A
`Dropped` row is never deleted — the reason is what stops the idea being
re-proposed.

### Applicability vocabulary

`Applies to` takes one of `All`, `Single`, `1v1`, `2+`. A row that is not
`All` must have at least one matching token-prefixed statement in the body:

```
**1v1:** first to check out 170 wins; the match ends immediately.
```

---

## Ruleset sections (copy from here down)

# [Game name]

Current version: none (V1 in design)
Entry points: standalone

## Features

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| … | V1 | All | |

## Identity

- One short pitch: what it is and why someone would play it
- Note if standard dartboard scoring is assumed

## Objective

- How you win a **leg** (or equivalent unit)
- How you win the **session / match** in the current version

## Config & presets

Play starts from a config screen. Table of settings:

| Setting | Preset | On config screen |
| --- | --- | --- |
| … | … | Shown, locked / Editable |

For editable fields: default, min, max (or allowed values). Then a brief prose
note on what those presets mean for the session.

## How to play

Core rules needed to play the default game. Typical subsections:

### Visit
- Up to three darts, then play passes (even in single-player)
- Early end cases (checkout, bust, …)

### Scoring / progress
- How the board state moves toward the objective

### Finishing
- How a leg is completed under the current out rule

### Bust (if applicable)
- When a visit is void and what happens to the score

### Ends when
**Required when `Entry points:` includes `standalone`.** What ends the session
when nothing outside the game bounds it — a leg count, a score, a time, a
number of rounds. A routine step inherits its bound from the routine; a
standalone session has nothing to inherit.

### Result
**Required when `Entry points:` includes `standalone`.** What the player is
shown when it ends: the outcome, and which numbers appear beside it.

## Later versions

Everything deferred, grouped clearly:

### Variants
- Selectable rule switches (start score, in/out, …) with short definitions.
  Every name used here has a Glossary row.

### Match structure
- Best of N, sets, margins, deciding-set quirks, multiplayer notes

### Other
- Anything else unlocked later

## Capture

**Required — do not skip.** A ruleset that cannot answer these four questions
will produce an engine whose state shape cannot be persisted, which is only
discovered once the game is built.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit totals, no dart
  rows), RECREATIONAL + DETAILED_DARTS (a row per dart thrown), or ANALYTICS
  (full intention and result per dart)
- **One dart's fact:** what the intended target and ring are, what the hit
  records, and what `score` holds — always the dart's **board** score, never a
  game-specific point value
- **Stage type:** which stage the game creates (`LEG`, `ROUND`,
  `EXERCISE_BLOCK`, …), and when a new one opens
- **Derived, never stored:** which numbers this game shows the player that are
  folded from the facts rather than kept in a field — running scores, points,
  ratios, averages

Write this in plain rules language. The engine-side contract it feeds is
`docs/architecture/04-Architecture-patterns.md` Pattern 18.

## Known limitations (optional)

What the chosen capture mode cannot recover, and what it would take to fix.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **…** | V1 | … |

Every term here appears verbatim inside a Features row name.

## Open questions

- Undecided rules, ranges, or product choices still TBD. A settled question is
  struck in place — `~~question~~ **Resolved:** …` — never deleted.
