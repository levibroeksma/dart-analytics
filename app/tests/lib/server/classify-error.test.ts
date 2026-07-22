import { describe, it, expect } from "vitest";
import { classifyThrownError } from "@server/classify-error";

describe("classifyThrownError", () => {
  it("classifies fetch/connection failures as SERVICE_UNAVAILABLE", () => {
    expect(classifyThrownError(new TypeError("fetch failed"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
    expect(
      classifyThrownError(new Error("Connection terminated unexpectedly")),
    ).toBe("SERVICE_UNAVAILABLE");
    expect(classifyThrownError(new Error("ETIMEDOUT"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("classifies everything else as INTERNAL_ERROR", () => {
    expect(
      classifyThrownError(new Error("Cannot read properties of undefined")),
    ).toBe("INTERNAL_ERROR");
    expect(classifyThrownError("weird")).toBe("INTERNAL_ERROR");
    expect(classifyThrownError(null)).toBe("INTERNAL_ERROR");
  });
});
