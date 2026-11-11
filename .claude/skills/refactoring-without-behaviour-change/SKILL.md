---
name: refactoring-without-behaviour-change
description: Use when a task changes code shape but must not change behaviour — folding a clone, splitting a long function, moving methods or markup.
---

# Refactoring Without Behaviour Change

Pairs with `superpowers:test-driven-development`: for a refactor the red step is a characterization test that passes on the old code.

## Steps

1. **Name the observable outputs** of the code you will move: HTTP body, SQL text, persisted facts, rendered HTML, returned object keys, thrown-error order.
2. **Pin each one, green on the old code.** One test per output, committed or at least run before the first edit.
   - Markup: `bash scripts/check-html-parity.sh --save`.
   - An Alpine factory: `shapeOf(factory())` and `sharedStateKeys(factory(), factory())` from `app/tests/support/factory-shape.ts`.
   - SQL: assert the rendered statement text where a rendering test exists (`tests/repositories/`).
3. **Change the shape.** One shape change per commit. A helper takes data, never a flag that picks a branch. Under three copies, do not share (D513).
4. **Prove it.** Run each and read the output:
   - the pinned tests, then `cd app && npm test` (report the count);
   - `npm run check` and read the three `- 0 …` lines, never a truncated tail;
   - markup: `bash scripts/check-html-parity.sh` → `html parity: 49 files identical`;
   - `bash scripts/check-dupes.sh` and `bash scripts/check-quality-benchmarks.sh`.
5. **State accepted differences.** Key order, error-column naming, whitespace: name each in the decision and the PR body.

## Traps met here

- An argument evaluated inside a `try` moves outside it when the call becomes a helper. Pass a thunk, or keep the expression inside.
- `...object` copies every runtime key. Spread only an object whose keys you built; otherwise name the fields.
- A test that reads a source file's text breaks when the code becomes data. Re-point it at the same guarantee, then mutate the data and the template once each to see it fail.
- `git commit` runs only the staged gates; the full suite runs at push. Run `npm test` yourself after the last edit.
