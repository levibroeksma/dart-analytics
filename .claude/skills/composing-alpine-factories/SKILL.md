---
name: composing-alpine-factories
description: Use when creating or changing an Alpine x-data factory (*.data.ts) or store — adding a method, a state field or a new factory.
paths: ["app/src/lib/**/*.data.ts", "app/src/stores/**"]
---

# Composing Alpine Factories

The pattern and its rules: `docs/architecture/07-Frontend/03-Alpine-Patterns.md` § Method groups (D553). This skill is the procedure.

## Adding a method

1. Find the factory's `<factory>Methods` constant in the same file. Add the method there, with `this: <Context>` as its first parameter.
2. The method reads a factory parameter or local: it stays in the factory literal instead.
3. Add the method's signature to the context type in the folder's `types.ts`.

## Adding state

Put the field in the factory literal. An array, object, Map, engine or timer handle is created there, per call; never in a module constant.

## Adding a factory

1. State first, then `...<factory>Methods`. Keep the factory under 60 lines.
2. Getters and setters stay in the literal: a spread would read a getter once.
3. Its methods rely on the literal's own inferred `this`: write the context type first. A separate constant cannot see an inferred `this` (TypeScript reports a circular reference).

## Proof

- In the factory's test, with `app/tests/support/factory-shape.ts`:
  - `expect(shapeOf(factory())).toMatchSnapshot()` — keys in order;
  - `expect(sharedStateKeys(factory(), factory())).toMatchInlineSnapshot(`[]`)` — no shared state.
- `cd app && npx --no-install fallow health src/<file> --format json -q | jq '.large_functions'` → `null` or `[]`.
- The `unit-size-note` hook says so at edit time when a function passes 60 lines.
