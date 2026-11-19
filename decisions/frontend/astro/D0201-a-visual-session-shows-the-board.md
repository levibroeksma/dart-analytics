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
<!-- backfill: pending -->

# A visual session shows the board in place of the keypad, with markers for the visit's darts

## Context and Problem Statement
Two input surfaces stacked on one play screen read as a broken layout, not as a choice: the board is the session's input, and a keypad below it invites a visit total the player never meant to enter. Markers are what make the board an input a player can check — without them a landed dart leaves no trace, and a mis-aimed one is only discoverable from the running total.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "While `$store.game.inputModeKey === 'VISUAL_BOARD'`, both play pages hide `ScoreInput.astro` and show `BoardInputPanel.astro` alone. The panel carries its own `Undo dart` control, because the keypad's undo button goes with the keypad. The board draws a marker per located dart of the most recent turn — still open, or just closed by its last dart — so a finished visit's grouping stays visible until the next visit's first dart replaces it. Unseen darts carry no coordinate and are not drawn. Only D199's final sentence is reversed; the press-drag-release mechanism it describes is unchanged.".

### Consequences
The keypad is no longer the always-available accessible alternative on a visual session, which is a real accessibility cost accepted at the owner's direction; the server still accepts a dartless keypad visit inside a visual session, so nothing in the persistence path assumes darts and the fallback can be restored as a per-session toggle without a schema or validator change. Markers render into `DartBoard.astro`'s slot, which overlays the SVG rather than sitting inside it: Alpine's `x-for` needs a real HTML `<template>`, and the HTML parser puts a `<template>` written inside `<svg>` into the SVG namespace, where it has no `.content` and `x-for` cannot clone it. Positions are a percentage of the board's own `-220 -220 440 440` box, so they track the board at any size.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-09
