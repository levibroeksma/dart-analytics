import { describe, expect, it } from "vitest";
import {
  BullseyeCheckoutEngine,
  bullseyeCheckoutEngineFactory,
  foldBullseyeCheckoutState,
} from "@modules/training/exercises/bullseye-checkout.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { BullseyeCheckoutConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: BullseyeCheckoutConfigData = { startScore: 81 };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S19 = dart(19, "SINGLE");
const S12 = dart(12, "SINGLE");
const S11 = dart(11, "SINGLE");
const S13 = dart(13, "SINGLE");
const T20 = dart(20, "TREBLE");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function play(
  engine: BullseyeCheckoutEngine,
  darts: DartObservation[],
): ReturnType<BullseyeCheckoutEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

function intents(engine: BullseyeCheckoutEngine) {
  return engine
    .facts()
    .turns.flatMap((turn) => turn.darts)
    .map((d) => [d.intendedTargetNumber, d.intendedZoneKey]);
}

describe("BullseyeCheckoutEngine", () => {
  it("starts at 81 with no visits and no last result", () => {
    const engine = bullseyeCheckoutEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      startScore: 81,
      checkouts: 0,
      visits: 0,
      lastVisitCheckout: null,
      currentLeft: 81,
      dartsInVisit: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a 31 setup and the inner bull as a checkout", () => {
    const state = play(new BullseyeCheckoutEngine(CONFIG), [S19, S12, BULL]);

    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(1);
    expect(state.lastVisitCheckout).toBe(true);
    expect(state.currentLeft).toBe(81);
    expect(state.dartsInVisit).toBe(0);
  });

  it("does not count the outer bull as a finish", () => {
    const state = play(new BullseyeCheckoutEngine(CONFIG), [S19, S12, OUTER]);

    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
    expect(state.lastVisitCheckout).toBe(false);
  });

  it("needs a setup of exactly 31", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const state = play(engine, [S19, S11, BULL, S19, S13, BULL]);

    expect(state.visits).toBe(2);
    expect(state.checkouts).toBe(0);
  });

  it("counts bulls on setup darts at board value", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const first = play(engine, [OUTER, dart(6, "SINGLE"), BULL]);
    expect(first.checkouts).toBe(1);

    engine.record(BULL);
    expect(engine.state().currentLeft).toBe(31);
  });

  it("shows what is left after each setup dart", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);

    expect(play(engine, [S19]).currentLeft).toBe(62);
    expect(play(engine, [S12]).currentLeft).toBe(50);
    expect(engine.state().dartsInVisit).toBe(2);
    expect(engine.state().visits).toBe(0);
  });

  it("lets Left go negative when the setup overshoots", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);

    expect(play(engine, [T20, T20]).currentLeft).toBe(-39);
    const state = play(engine, [BULL]);
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
  });

  it("records no intent on setup darts and the bull on dart 3", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19]);

    expect(intents(engine)).toEqual([
      [null, null],
      [null, null],
      [25, "INNER_BULL"],
      [null, null],
    ]);
  });

  it("keeps the bull intent on dart 3 after missed setup darts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const state = play(engine, [MISS, MISS, BULL]);

    expect(intents(engine)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
  });

  it("re-applies the bull intent when dart 3 is undone and re-thrown", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, OUTER]);

    expect(engine.undo()).toBe(true);
    expect(engine.state().visits).toBe(0);
    expect(engine.state().currentLeft).toBe(50);

    const state = play(engine, [BULL]);
    expect(intents(engine)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.checkouts).toBe(1);
  });

  it("gives the bull intent to dart 3 after rehydrating mid-visit", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12]);

    const resumed = new BullseyeCheckoutEngine(CONFIG, engine.facts());
    const state = play(resumed, [BULL]);

    expect(intents(resumed)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.checkouts).toBe(1);
  });

  it("leaves an unfinished visit unjudged at timer expiry", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19, S12]);
    engine.expireTimer();

    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(1);
    expect(state.dartsThrown).toBe(5);
  });

  it("un-completes before undoing a dart", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
  });

  it("refuses to record once complete", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(MISS)).toThrow();
  });

  it("rehydrates in-progress state from prior facts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, T20]);

    const resumed = bullseyeCheckoutEngineFactory.create(
      CONFIG,
      engine.facts(),
    );

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects a start score other than 81", () => {
    expect(
      () => new BullseyeCheckoutEngine({ startScore: 61 } as never),
    ).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("BULLSEYE_CHECKOUT_V1")).toBe(
      bullseyeCheckoutEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldBullseyeCheckoutState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19]);

    expect(foldBullseyeCheckoutState(engine.facts(), CONFIG, false)).toEqual(
      engine.state(),
    );
  });
});
