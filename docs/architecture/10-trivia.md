<!--
status: canonical
scope: architecture/trivia
read-when: checkout quiz, trivia tools, standalone practice features
updated: 2026-08-28
-->

# Checkout Trivia Architecture

> **Version:** 0.1.0 (2026-08-28 — initial architecture, from the approved checkout-trivia design)
>
> A standalone, untimed flashcard quiz for drilling checkout routes: what it covers, what it deliberately excludes, and the one piece of existing game code it reuses.
>
> Checkout chart it reuses: `app/src/modules/game/checkout-path.module.ts`. Dart vocabulary it borrows: `app/src/modules/game/types.ts` (`DartZoneKey`). Explicitly not integrated with: `09-training-routines.md`.

---

# Purpose

Checkout Trivia is a standalone flashcard quiz: shown a number, the player answers with the checkout route they would throw. It exists to build the route recall a player needs mid-leg, drilled outside a live game rather than during one.

`docs/game-rules/trivia/README.md` frames "trivia" as a family of standalone practice tools, explicitly outside the `game_types` model. This document is the first tool in that family, and the first to resolve what "standalone" means in practice.

---

# Scope and Status

Nothing described here is implemented. The document exists first, per `01-Principles.md` §Architecture First.

In scope: the question pool and its filters, the answer-evaluation model, the preferred-route explanation mechanism (not its content — see §Preferred-Route Explanations), the input flow, and where the code lives.

Out of scope, deliberately — see §Explicitly Deferred for the reasoning behind each: time pressure or decision-speed training, persisted attempt history, and any integration with `09-training-routines.md`.

---

# Architectural Placement

Checkout Trivia is fully standalone: its own route, its own state, no dependency on `09-training-routines.md` and no code shared with it.

`09-training-routines.md` reserves a `CHECKOUT` Exercise Type and supports exercises that need no game engine, so folding this quiz into that framework was considered and rejected — not because it is a poor conceptual fit, but because three concrete mismatches make it a poor V1 fit: `09` has no implementation at all yet, every exercise there is duration-bound while this quiz's natural unit is question count, and `09`'s only non-dart-input precedent (Warm-Up) evaluates nothing, while this quiz needs to evaluate a keypad tap standing in for a dart that was never thrown.

If `09-training-routines.md` ships later and a `CHECKOUT` Exercise Type becomes real, integrating this quiz into it is a fresh decision made against the code that exists then. Nothing here is shaped to anticipate it.

---

# Question Pool and Configuration

The pool is every target 41–170 — 130 numbers. Single-dart checkouts and everything below 41 are excluded entirely, not filtered out: every number 2–40 finishes in at most two darts, and the twenty even numbers in that range finish in one, which makes the whole range too obvious to drill.

| Bucket | Count |
| ------ | ----- |
| Two-dart finishes | 59 |
| Three-dart finishes | 64 |
| Bogeys (no finish exists) | 7 — 159, 162, 163, 165, 166, 168, 169 |

Configuration:

```ts
export type CheckoutTriviaDartCountFilter = "TWO" | "THREE"; // omitted = both

export type CheckoutTriviaFilter = {
  dartCount?: CheckoutTriviaDartCountFilter;
  rangeMin?: number; // clamped to 41
  rangeMax?: number; // clamped to 170
  questionCount: number; // 10..filtered pool size, default 25
};
```

Filters compose. Dart count defaults to mixing two- and three-dart finishes; narrowing to one bucket excludes bogeys by construction, since a bogey has no dart count to match. Range (e.g. 89–125) clamps to [41, 170] and keeps bogeys inside it — recognizing "this one has no checkout" within a drilled range is realistic, and is exactly what a dart-count filter alone would hide. Question count runs 10 up to whatever the two filters above leave, default 25, drawn as a random subset without replacement; if fewer than 10 targets remain, it clamps down to that smaller size rather than blocking configuration.

---

# Evaluation Model

No general checkout-route solver is needed. The player supplies the candidate route dart by dart; the engine only validates that specific sequence — arithmetic, not search.

```ts
export type DeclaredDart = {
  targetNumber: number | null; // null only for OUTER_BULL / INNER_BULL
  zoneKey: "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL";
};

export type CheckoutTriviaAnswer =
  | { kind: "DECLARED_IMPOSSIBLE" }
  | { kind: "DARTS"; darts: readonly DeclaredDart[] }; // 1–3 entries

export type CheckoutAnswerTier =
  | "PREFERRED"
  | "VALID_ALTERNATE"
  | "INCORRECT"
  | "CORRECTLY_DECLARED_IMPOSSIBLE";

export function isValidFinish(target: number, darts: readonly DeclaredDart[]): boolean;

export function classifyCheckoutAnswer(
  target: number,
  answer: CheckoutTriviaAnswer,
): CheckoutAnswerTier;
```

`DeclaredDart` mirrors the shape of the existing `DartObservation` (`app/src/modules/game/types.ts`) rather than inventing a parallel one — narrowed to the five zones a keypad-only, always-a-deliberate-hit answer can express.

After each entered dart, the running sum is checked against the target: if it matches exactly and the last dart is a double or the inner bull, that is a valid finish and the question ends immediately, however many darts it took. Three darts without a valid finish ends the question unresolved.

A finished sequence is classified against the chart: an exact match to `checkoutPathFor(target)` is `PREFERRED`; a different sequence that still validly finishes is `VALID_ALTERNATE`; three darts with no valid finish is `INCORRECT`. Against one of the seven bogeys, `DECLARED_IMPOSSIBLE` is `CORRECTLY_DECLARED_IMPOSSIBLE` and any `DARTS` answer can only ever be `INCORRECT` — a bogey admits no valid finish by definition, so both outcomes fall out of the same arithmetic with no bogey-specific branch. `DECLARED_IMPOSSIBLE` on a non-bogey target is `INCORRECT`.

**Edge case, intentional:** target 50's chart entry is the two-dart `10, D20`, but a lone inner-bull dart also validly finishes 50. Because the check is real arithmetic rather than chart-matching, a single bull for 50 correctly lands as `VALID_ALTERNATE` and ends the question in one dart — the model working as designed, not a case to special-case away.

`isValidFinish` and `classifyCheckoutAnswer` are the only new logic here; both call the existing `checkoutPathFor` and add nothing to it.

---

# Preferred-Route Explanations

`checkoutPathFor` returns only the route, never why it is preferred over another valid finish — that reasoning does not exist anywhere in the repo. It is new darts-strategy content, one explanation per routable number (up to 123, once a session's filters are applied), and it is writing, not something derivable from the chart.

The mechanism ships with this design; the content is phased in afterward.

```ts
export const CHECKOUT_PREFERENCE_NOTES: Readonly<Partial<Record<number, string>>> = {
  // populated incrementally — an absent key means "not authored yet"
};
```

A target without an authored entry shows a placeholder in the summary instead of the info button. Writing the remaining explanations is separate, later, non-blocking work.

---

# Interface and Input Flow

Per-question flow: the target number is shown. The player either taps **not possible** — available only before any dart is entered for the question, since it is a whole-answer declaration rather than a mid-entry fallback — or builds a route on the keypad. The keypad carries five zone options: single, double, treble, **outer bull (25)**, and **inner bull (50)** — kept distinct because two pool numbers, 125 (`25, T20, D20`) and 135 (`25, T20, BULL`), need the outer-bull value specifically, and it is never the finishing dart.

After each dart, `isValidFinish` runs against the darts entered so far. A valid finish advances immediately; otherwise entry continues up to three darts, then advances unresolved either way. **Back** undoes one dart per tap — two taps undoes two, and so on — scoped to the current question.

No feedback is shown during play. The final question gets a confirmation modal before the whole session submits, so a stray tap on the last answer cannot end the game by accident.

Summary screen, per question — target, the darts entered (or "declared impossible"), and a tier:

- **Teal** — `PREFERRED` or `CORRECTLY_DECLARED_IMPOSSIBLE`.
- **Amber** — `VALID_ALTERNATE`. Has an info button (§Preferred-Route Explanations).
- **Red** — `INCORRECT`. Has an info button, except on a bogey target, which has none — there is no preferred-route content for a number with no route.

---

# Code Placement and Reuse

Routes:

```
app/src/pages/trivia/index.astro            # category landing — today lists one tool
app/src/pages/trivia/checkouts/index.astro  # the quiz itself
```

Sibling to `games/`, never under it — this is not a `game_types` game. No `pages/api/**` route and no `api/sessions/*` call: there is nothing to create or persist server-side.

All new code lives in its own `lib/trivia/` domain folder — the same scale as the existing `lib/auth/` or `lib/ui/` — not a new `modules/` subfolder. A class-based `modules/<domain>/` folder is warranted once logic is used by 2+ routes (`docs/architecture/07-Frontend/02-Folder-Structure.md`, verified current); this quiz is one route, so it colocates.

```
app/src/lib/trivia/
├── checkout-trivia-play.data.ts       # Alpine.data factory — phase, current question, entered darts, results[]
├── checkout-trivia-pool.ts            # buildCheckoutTriviaPool
├── checkout-trivia-evaluation.ts      # isValidFinish, classifyCheckoutAnswer
└── checkout-trivia-explanations.ts    # CHECKOUT_PREFERENCE_NOTES
```

`checkout-trivia-play.data.ts` is a `.data.ts` Alpine factory, which forbids `$persist` by the existing suffix convention — ephemeral by construction.

The only import from existing game code, across all four files, is `checkoutPathFor` from `@modules/game/checkout-path.module`. Nothing under `modules/game/` is modified. No `GameEngine`, no ruleset, no seat or participant concept, no `api/sessions/*`, is touched anywhere in this design.

---

# Testing Strategy

| File | Asserts |
| ---- | ------- |
| `checkout-trivia-evaluation.test.ts` | `isValidFinish`/`classifyCheckoutAnswer` against the real chart across the full 41–170 pool, not a hand-copied subset — including the bull-for-50 case landing `VALID_ALTERNATE` in one dart, every bogey landing `INCORRECT` for any `DARTS` answer and `CORRECTLY_DECLARED_IMPOSSIBLE` for `DECLARED_IMPOSSIBLE`, and 125/135 classifying correctly only when the outer-bull zone is distinguished from the inner bull. |
| `checkout-trivia-pool.test.ts` | Pool composition asserted against `checkoutPathFor` at test time — 59/64/7 — never a hardcoded list, so a future chart correction cannot silently drift out of sync with what these tests expect. Range clamping to [41, 170]; dart-count filters excluding bogeys; question-count bounds. |
| `checkout-trivia-play.data.test.ts` | Phase transitions (configure → play → summary), back-undo depth, auto-advance on a valid finish, the final-question confirmation gate, and that `results[]` accumulates one entry per question in the shape the summary renders from. |

---

# Explicitly Deferred

Decided against for V1, recorded so none of it is re-litigated as an oversight.

- **Time pressure or decision-speed training.** V1 is untimed throughout — no timer field anywhere in the data shapes above. A speed layer, if ever built, is a separate design on top of this one, not a retrofit.
- **Persisted attempt history.** No schema, no API call, nothing server-side. `results[]` in `checkout-trivia-play.data.ts` is already a list of discrete per-question outcomes rather than a running tally, so a future persistence layer folds that list rather than requiring anything here to be re-derived.
- **Integration with `09-training-routines.md`.** No shared contract, no shared code, no seam kept open. See §Architectural Placement.
- **Full explanation content.** See §Preferred-Route Explanations — the mechanism ships, writing the remaining ~123 entries does not block release.

---

# Related Documents

| Document | Relationship |
| -------- | ------------ |
| `docs/game-rules/trivia/README.md` | The category framing this document resolves the "target shape" question for. |
| `docs/game-rules/trivia/checkouts.md` | The raw brief this document formalizes. |
| `app/src/modules/game/checkout-path.module.ts` | The chart this design reuses in full — `checkoutPathFor` is the only import from existing game code. |
| `app/src/modules/game/types.ts` | Source of the `DartZoneKey` vocabulary `DeclaredDart` narrows. |
| `08-DartBot.md` | Sibling document in this folder. Its Module Boundary section describes a proposed extension to the frontend module/folder docs, not current convention — not mirrored here for that reason. |
| `09-training-routines.md` | The framework this document deliberately does not integrate with — see §Architectural Placement. |
