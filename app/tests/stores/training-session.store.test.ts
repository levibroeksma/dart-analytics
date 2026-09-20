import { describe, it, expect } from "vitest";
import { trainingSessionStore } from "@stores/training-session.store";

describe("trainingSessionStore", () => {
  it("starts empty, with no header label before a step is running", () => {
    const store = trainingSessionStore();

    expect(store.active).toBe(false);
    expect(store.elapsedSeconds).toBe(0);
    expect(store.headerLabel).toBe("");
  });

  it("renders the routine clock beside the running step", () => {
    const store = trainingSessionStore();

    store.setStep("warm up");
    store.tick(38);

    expect(store.headerLabel).toBe("00:38 - warm up");
  });

  it("names whatever step label it is given", () => {
    const store = trainingSessionStore();
    const labels = ["warm up", "switching", "doubles", "finishing"].map(
      (label) => {
        store.setStep(label);
        return store.stepLabel;
      },
    );

    expect(labels).toEqual(["warm up", "switching", "doubles", "finishing"]);
  });

  it("keeps counting past an hour's worth of minutes", () => {
    const store = trainingSessionStore();

    store.setStep("finishing");
    store.tick(25 * 60 + 39);

    expect(store.headerLabel).toBe("25:39 - finishing");
  });

  it("startSession() marks the routine running and zeroes the clock", () => {
    const store = trainingSessionStore();
    store.tick(120);

    store.startSession();

    expect(store.active).toBe(true);
    expect(store.elapsedSeconds).toBe(0);
  });

  it("reset() clears the clock and the step", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("switching");
    store.tick(90);

    store.reset();

    expect(store.active).toBe(false);
    expect(store.elapsedSeconds).toBe(0);
    expect(store.stepKey).toBeNull();
    expect(store.headerLabel).toBe("");
  });
  it("markComplete() freezes the elapsed time and relabels the header", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("finishing");
    store.tick(1934);

    store.markComplete();

    expect(store.elapsedSeconds).toBe(1934);
    expect(store.headerLabel).toBe("32:14 - complete");
  });

  it("reset() clears a completed session's header", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("finishing");
    store.tick(1934);
    store.markComplete();

    store.reset();

    expect(store.headerLabel).toBe("");
  });
});
