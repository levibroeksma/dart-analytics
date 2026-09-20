import { describe, it, expect } from "vitest";
import { matchesConstraintError } from "@services/db-errors";

const MATCH = { code: "23514", constraint: "trg_example_bound" };

describe("matchesConstraintError", () => {
  it("matches a direct violation", () => {
    const err = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "trg_example_bound",
    });
    expect(matchesConstraintError(err, MATCH)).toBe(true);
  });

  it("matches the constraint name in message when .constraint is absent", () => {
    const err = Object.assign(
      new Error("violates check constraint trg_example_bound"),
      { code: "23514" },
    );
    expect(matchesConstraintError(err, MATCH)).toBe(true);
  });

  it("matches a violation wrapped one level deep, on cause", () => {
    const pgError = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "trg_example_bound",
    });
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: pgError,
    });
    expect(matchesConstraintError(wrapped, MATCH)).toBe(true);
  });

  it("matches a violation nested more than one wrapper deep", () => {
    const pgError = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "trg_example_bound",
    });
    const wrapped = Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("transaction failed"), {
        cause: pgError,
      }),
    });
    expect(matchesConstraintError(wrapped, MATCH)).toBe(true);
  });

  it("returns false for an unrelated SQLSTATE", () => {
    const err = Object.assign(new Error("not null"), { code: "23502" });
    expect(matchesConstraintError(err, MATCH)).toBe(false);
  });

  it("returns false for the right SQLSTATE on an unrelated constraint", () => {
    const err = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "some_other_check",
    });
    expect(matchesConstraintError(err, MATCH)).toBe(false);
  });

  it("terminates on a self-referencing cause chain rather than hanging", () => {
    const looping = new Error("loop") as Error & { cause?: unknown };
    looping.cause = looping;
    expect(matchesConstraintError(looping, MATCH)).toBe(false);
  });

  it("gives up after MAX_CAUSE_DEPTH wrapper layers", () => {
    let current: Error & { cause?: unknown } = Object.assign(
      new Error("bound"),
      { code: "23514", constraint: "trg_example_bound" },
    );
    for (let i = 0; i < 10; i++) {
      current = Object.assign(new Error(`wrap${i}`), { cause: current });
    }
    expect(matchesConstraintError(current, MATCH)).toBe(false);
  });
});
