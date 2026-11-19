---
id: D0201
status: accepted
date: 2026-08-09
origin: contemporaneous
original-date:
tags: [frontend/astro, layout, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0199
superseded-by:
---

# A visual session shows the board in place of the keypad, with markers for the visit's darts

## Context and Problem Statement
Two input surfaces stacked on one play screen read as a broken layout, not as a choice: the board is the session's input, and a keypad below it invites a visit total the player never meant to enter. Markers are what make the board an input a player can check — without them a landed dart leaves no trace, and a mis-aimed one is only discoverable from the running total.

## Decision Drivers
* Two input surfaces stacked on one play screen read as a broken layout, not as a choice.
* A keypad below the board invites a visit total the player never meant to enter.
* Without markers a landed dart leaves no trace, and a mis-aimed dart shows only in the running total.

## Considered Options
* Keep the keypad rendered beside the board as the accessible alternative (the final sentence of D199).
* Show the board alone in a visual session, with markers for the visit's darts (chosen).

## Decision Outcome
Chosen option: "While `$store.game.inputModeKey === 'VISUAL_BOARD'`, both play pages hide `ScoreInput.astro` and show `BoardInputPanel.astro` alone. The panel carries its own `Undo dart` control, because the keypad's undo button goes with the keypad. The board draws a marker per located dart of the most recent turn — still open, or just closed by its last dart — so a finished visit's grouping stays visible until the next visit's first dart replaces it. Unseen darts carry no coordinate and are not drawn. Only D199's final sentence is reversed; the press-drag-release mechanism it describes is unchanged.".

### Consequences
The keypad is no longer the always-available accessible alternative on a visual session, which is a real accessibility cost accepted at the owner's direction; the server still accepts a dartless keypad visit inside a visual session, so nothing in the persistence path assumes darts and the fallback can be restored as a per-session toggle without a schema or validator change. Markers render into `DartBoard.astro`'s slot, which overlays the SVG rather than sitting inside it: Alpine's `x-for` needs a real HTML `<template>`, and the HTML parser puts a `<template>` written inside `<svg>` into the SVG namespace, where it has no `.content` and `x-for` cannot clone it. Positions are a percentage of the board's own `-220 -220 440 440` box, so they track the board at any size.

* Bad, because the keypad is no longer the always-available accessible alternative on a visual session. The owner accepted this cost.
* Neutral, because the server still accepts a dartless keypad visit inside a visual session. Nothing in the persistence path assumes darts, so the fallback can return as a per-session toggle without a schema or validator change.
* Neutral, because markers render into the `DartBoard.astro` slot, which overlays the SVG. Alpine's `x-for` needs a real HTML `<template>`, and the HTML parser puts a `<template>` written inside `<svg>` into the SVG namespace, where it has no `.content` and `x-for` cannot clone it.
* Good, because marker positions are a percentage of the board's own `-220 -220 440 440` box, so they track the board at any size.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `8f6cd566` reports 1831 tests, `astro check` with 0 errors and the real Alpine build driven with a pointer drag in Chromium. Markers render at the expected percentages and the unseen dart is skipped.

## Pros and Cons of the Options
### Keep the keypad beside the board
* Good, because the keypad stays an accessible alternative on a visual session.
* Bad, because two input surfaces on one screen read as a broken layout.
* Bad, because a keypad below the board invites a visit total the player never meant to enter.

### Board alone with visit markers
* Good, because the board is the session's input, and markers let a player check where each dart landed.
* Bad, because the keypad stops being the accessible alternative, a cost the owner accepted.

## Evidence / More Information
Decided: 2026-08-09

* Commit `8f6cd566` (2026-08-09; adds the D201 row with `Supersedes: D199`): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons. It reverses only the keypad sentence of D199.
* Applied in: `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md` (Analytics mode shows the board alone), `docs/superpowers/plans/2026-10-08-game-play-redesign.md`, `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`.
