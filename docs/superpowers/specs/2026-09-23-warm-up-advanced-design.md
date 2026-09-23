# Warm-Up Advanced — design

Date: 2026-09-23
Input: `docs/game-rules/training/exercises/warm-up.md` (Warm-Up Advanced row)
Precedent: Warm-Up template `0199b000-…-000000000001` (`database/seeds/0015_warm_up_routine.sql`, phases as of `0017`)

## 1. Scope

Second `WARM_UP` system template, "Warm-Up Advanced". Same `WARM_UP_V1`
rules; only the section targets differ. Offered by the routine builder via
`v_exercise_template_catalog`. No routine seeded, no engine, schema, adapter
or UI change.

## 2. Persistence

Unchanged from Warm-Up: no capture pair (D277), no darts, one
`EXERCISE_SECTION` stage per section entered.

## 3. Configuration

```json
{"phases":[
  {"name":"Upper","targets":[20],"weight":1},
  {"name":"Lower","targets":[3],"weight":1},
  {"name":"Right","targets":[6],"weight":1},
  {"name":"Left","targets":[11],"weight":1},
  {"name":"Bull","targets":[25],"weight":1}
]}
```

Parses under `WarmUpV1Config`. `dartboardHighlightPath([n])` outlines the
single slice from the bull ring to the rim; `[25]` outlines the bull ring,
as before.

## 4. Seed `0026_warm_up_advanced_template.sql`

Template `0199b000-…-00000000000a`, type `0199a000-…-000000000002`
(`WARM_UP`), ruleset resolved by `implementation_key = 'WARM_UP_V1'`,
`game_type_id NULL`. Verification `0026_warm_up_advanced_seed_checks.sql`:
template pinned, config exact, catalog lists both `WARM_UP` templates.

## 5. Docs

Routines §16 note; File Inventory; seed ranges → `0026`; database README;
D359; context-map history.
