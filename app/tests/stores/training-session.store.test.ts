import { describe, it, expect } from "vitest";
import { trainingSessionStore } from "@stores/training-session.store";

describe("trainingSessionStore", () => {
  it("starts inactive, with the clock at zero and no step label", () => {
    const store = trainingSessionStore();

    expect(store.active).toBe(false);
    expect(store.elapsedSeconds).toBe(0);
    expect(store.stepLabel).toBe("");
  });

  it("reports the routine clock as mm:ss", () => {
    const store = trainingSessionStore();

    store.tick(2538);

    expect(store.elapsedLabel).toBe("42:18");
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
  });

  it("markComplete() freezes the elapsed time and relabels the step", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("finishing");
    store.tick(1934);

    store.markComplete();

    expect(store.elapsedSeconds).toBe(1934);
    expect(store.stepLabel).toBe("complete");
  });

  it("reset() clears a completed session's step label", () => {
    const store = trainingSessionStore();
    store.startSession();
    store.setStep("finishing");
    store.tick(1934);
    store.markComplete();

    store.reset();

    expect(store.stepLabel).toBe("");
  });

  it("setGameSession stores the id and reset clears it", () => {
    const store = trainingSessionStore();

    store.setGameSession("s1");
    expect(store.gameSessionId).toBe("s1");

    store.reset();
    expect(store.gameSessionId).toBeNull();
  });
});
