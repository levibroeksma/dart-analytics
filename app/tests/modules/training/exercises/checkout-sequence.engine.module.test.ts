import { describe, expect, it } from "vitest";
import {
  CheckoutSequenceEngine,
  checkoutSequenceEngineFactory,
  foldCheckoutSequenceState,
} from "@modules/training/exercises/checkout-sequence.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { CheckoutSequenceConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: CheckoutSequenceConfigData = {
  firstOutshot: 61,
  lastOutshot: 100,
  dartLimit: 6,
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S1 = dart(1, "SINGLE");
const S2 = dart(2, "SINGLE");
const S9 = dart(9, "SINGLE");
const S20 = dart(20, "SINGLE");
const T15 = dart(15, "TREBLE");
const T19 = dart(19, "TREBLE");
const T20 = dart(20, "TREBLE");
const D8 = dart(8, "DOUBLE");
const D16 = dart(16, "DOUBLE");
const D20 = dart(20, "DOUBLE");
const BULL = dart(25, "INNER_BULL");
const SIX_MISSES = [MISS, MISS, MISS, MISS, MISS, MISS];

function play(
  engine: CheckoutSequenceEngine,
  darts: DartObservation[],
): ReturnType<CheckoutSequenceEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

/** Fails `count` attempts in a row: six misses each. */
function failAttempts(engine: CheckoutSequenceEngine, count: number): void {
  for (let i = 0; i < count; i++) play(engine, SIX_MISSES);
}

describe("CheckoutSequenceEngine", () => {
  it("starts at 61 with nothing scored", () => {
    const engine = checkoutSequenceEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      currentOutshot: 61,
      remaining: 61,
      attemptDart: 0,
      points: 0,
      checkouts: 0,
      attempts: 0,
      lastAttemptPoints: null,
      dartsInVisit: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("scores 3 for a two-dart checkout and moves to the next outshot", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [T15, D8]);

    expect(state.points).toBe(3);
    expect(state.lastAttemptPoints).toBe(3);
    expect(state.checkouts).toBe(1);
    expect(state.attempts).toBe(1);
    expect(state.currentOutshot).toBe(62);
    expect(state.remaining).toBe(62);
    expect(state.attemptDart).toBe(0);
    expect(state.dartsInVisit).toBe(0);
  });

  it("scores 2 for a three-dart checkout", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [S20, S9, D16]);

    expect(state.points).toBe(2);
    expect(state.lastAttemptPoints).toBe(2);
  });

  it("scores 1 for a checkout in the second visit", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [
      MISS,
      MISS,
      MISS,
      T15,
      D8,
    ]);

    expect(state.points).toBe(1);
    expect(state.checkouts).toBe(1);
    expect(state.currentOutshot).toBe(62);
  });

  it("scores 0 and advances after six darts without a checkout", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), SIX_MISSES);

    expect(state.points).toBe(0);
    expect(state.lastAttemptPoints).toBe(0);
    expect(state.checkouts).toBe(0);
    expect(state.attempts).toBe(1);
    expect(state.currentOutshot).toBe(62);
    expect(state.remaining).toBe(62);
  });

  it("carries the remaining score into the second visit", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [S20, S1, MISS]);

    expect(state.remaining).toBe(40);
    expect(state.attemptDart).toBe(3);
    expect(state.currentOutshot).toBe(61);
  });

  it("shows the walked remaining while a visit is open", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [S20]);

    expect(state.remaining).toBe(41);
    expect(state.dartsInVisit).toBe(1);
    expect(state.attemptDart).toBe(1);
  });

  it("busts on leaving 1, ends the visit and restores the remaining", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    const state = play(engine, [T20]);

    expect(state.remaining).toBe(61);
    expect(state.dartsInVisit).toBe(0);
    expect(state.attemptDart).toBe(3);
    expect(state.dartsThrown).toBe(1);
    expect(engine.facts().turns[0].completedAt).not.toBeNull();
  });

  it("busts on reaching 0 without a double", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [S1, T20]);

    expect(state.checkouts).toBe(0);
    expect(state.remaining).toBe(61);
    expect(state.attemptDart).toBe(3);
  });

  it("fails the attempt on a bust in the second visit", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [
      S20,
      MISS,
      MISS,
      T20,
    ]);

    expect(state.remaining).toBe(62);
    expect(state.currentOutshot).toBe(62);
    expect(state.lastAttemptPoints).toBe(0);
    expect(state.attempts).toBe(1);
    expect(state.dartsThrown).toBe(4);
  });

  it("lets a bust in visit one carry into visit two", () => {
    const state = play(new CheckoutSequenceEngine(CONFIG), [T20, T15, D8]);

    expect(state.checkouts).toBe(1);
    expect(state.points).toBe(1);
  });

  it("finishes on the bullseye", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    failAttempts(engine, 9);
    const state = play(engine, [S20, BULL]);

    expect(state.checkouts).toBe(1);
    expect(state.points).toBe(3);
    expect(state.currentOutshot).toBe(71);
  });

  it("scores 3 for 99 in three darts", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    failAttempts(engine, 38);
    expect(engine.state().currentOutshot).toBe(99);

    const state = play(engine, [T19, S2, D20]);

    expect(state.lastAttemptPoints).toBe(3);
  });

  it("ends the run once 100 has been attempted", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    failAttempts(engine, 40);

    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.state().currentOutshot).toBeNull();
    expect(engine.state().attempts).toBe(40);
    expect(() => engine.record(MISS)).toThrow();
  });

  it("completes when the timer expires and leaves the open attempt unscored", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [S20]);
    engine.expireTimer();

    expect(engine.isComplete()).toBe(true);
    expect(engine.state().attempts).toBe(0);
    expect(() => engine.record(MISS)).toThrow();
  });

  it("undo un-expires first, then pops the last dart", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [S20]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.state().dartsThrown).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("undo reopens a busted visit", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [S20, T20]);
    engine.undo();
    const state = play(engine, [S1]);

    expect(state.remaining).toBe(40);
    expect(state.dartsInVisit).toBe(2);
    expect(engine.facts().turns).toHaveLength(1);
  });

  it("records free-aim darts with no intent", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [T15, D8]);

    for (const d of engine.facts().turns.flatMap((turn) => turn.darts)) {
      expect(d.intendedTargetNumber).toBeNull();
      expect(d.intendedZoneKey).toBeNull();
    }
  });

  it("restores state from prior facts", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [T15, D8, S20, MISS, MISS, T20]);

    const resumed = checkoutSequenceEngineFactory.create(
      CONFIG,
      engine.facts(),
    );

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects a config outside the Catch 40 values", () => {
    expect(
      () => new CheckoutSequenceEngine({ ...CONFIG, lastOutshot: 80 } as never),
    ).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("CHECKOUT_SEQUENCE_V1")).toBe(
      checkoutSequenceEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [T15, D8, T20]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldCheckoutSequenceState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new CheckoutSequenceEngine(CONFIG);
    play(engine, [T15, D8, S20, MISS]);

    expect(foldCheckoutSequenceState(engine.facts(), CONFIG, false)).toEqual(
      engine.state(),
    );
  });
});
