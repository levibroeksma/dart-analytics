import { describe, it, expect } from "vitest";
import { routineStart } from "@lib/training/routines/routine-start.data";

describe("routineStart", () => {
  it("start() sets starting=true and navigates to the given path", () => {
    const original = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
    const store = routineStart("/training/balanced-training/play");
    store.start();
    expect(store.starting).toBe(true);
    expect(globalThis.location.href).toBe("/training/balanced-training/play");
    Object.defineProperty(globalThis, "location", {
      value: original,
      configurable: true,
    });
  });
});
