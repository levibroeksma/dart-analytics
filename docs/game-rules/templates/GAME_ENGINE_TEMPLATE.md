# Game Engine Template

Copy this shape into each ruleset under `games/rulesets/`. Fill every section; use `N/A` only when a section truly does not apply.

These files are **descriptive human rules** — the source for later engine specifications, not the specs themselves.

---

## Authoring rules (do not copy into rulesets)

- Describe **how the game is played**, not how software implements it.
- Prefer plain language over algorithms, state machines, or UI flows.
- **Board scoring is assumed** (singles, doubles, triples, bulls). Re-explain only if this game breaks those norms.
- **Version-first:** write so someone can play **V1** without reading later sections.
- Every game starts from a **config screen**. V1 shows presets; most are locked. Later versions unlock more fields.
- Name formats explicitly (**first to N** vs **best of N**). Default V1 length format is typically **first to N**; **best of N** usually waits for multiplayer.
- Every named variant gets a short plain-language definition. Mark **V1** vs **V2+**. Document deferred options in full even when V1 only uses the default.
- Define terms before you rely on them (e.g. **visit** before **bust**).

### Versioning

| Version | Scope |
| --- | --- |
| V1 | Single player, default rules, config presets (mostly locked), plus any simple editable knobs |
| V2+ | Extra players, richer match formats, optional rules, selectable variants |

---

## Ruleset sections (copy from here down)

# [Game name]

## Features

Master list of product/rules capabilities. Fill **Version** when declaring what ships when (`V1`, `V2+`, `Deferred`, …).

| Feature | Version |
| --- | --- |
| … | TBD |

## Identity

- One short pitch: what it is and why someone would play it
- Note if standard dartboard scoring is assumed

## Objective

- How you win a **leg** (or equivalent unit)
- How you win the **session / match** under V1

## Config & presets (V1)

- State that play starts from a config screen
- Table of settings:

| Setting | V1 preset | On config screen (V1) |
| --- | --- | --- |
| … | … | Shown, locked / Editable |

- For editable fields: default, min, max (or allowed values)
- Brief prose: what those presets mean for the session

## How to play (V1)

Core rules needed to play the default game. Typical subsections:

### Visit
- Up to three darts, then play passes (even in single-player)
- Early end cases (checkout, bust, …)

### Scoring / progress
- How the board state moves toward the objective (without re-teaching dartboard values unless needed)

### Finishing
- How a leg is completed under the V1 out rule

### Bust (if applicable)
- When a visit is void and what happens to the score

Add only the subsections this game needs.

## Later versions (V2+)

Everything deferred from V1, grouped clearly:

### Variants
- Selectable rule switches (start score, in/out, …) with short definitions or a pointer to Glossary

### Match structure
- Best of N, sets, margins, deciding-set quirks, multiplayer notes

### Other
- Anything else unlocked later

## Glossary

Named rules and terms used above (especially options that are locked in V1 but defined for later). Keep definitions short and human.

| Term | Version | Meaning |
| --- | --- | --- |
| … | V1 / V2+ | … |

## Open questions

- Undecided rules, ranges, or product choices still TBD
