import { describe, it, expect } from "vitest";
import { readyGate } from "@lib/training/routines/ready-gate";

describe("readyGate", () => {
  it("counts the steps and their minutes, and lists each step", () => {
    expect(
      readyGate([
        { title: "Warm-Up", durationSeconds: 300 },
        { title: "Switching", durationSeconds: 270 },
      ]),
    ).toEqual({
      eyebrow: "2 STEPS · 10 MIN",
      rows: [
        { number: "01", title: "Warm-Up", duration: "5:00" },
        { number: "02", title: "Switching", duration: "4:30" },
      ],
    });
  });

  it("rounds the total up to a whole minute and says STEP for one", () => {
    expect(
      readyGate([{ title: "Catch 40", durationSeconds: 61 }]).eyebrow,
    ).toBe("1 STEP · 2 MIN");
  });
});
