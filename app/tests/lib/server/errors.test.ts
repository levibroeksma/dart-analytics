import { describe, it, expect } from "vitest";
import { ERROR_HTTP } from "@server/errors";

describe("ERROR_HTTP registry", () => {
  it("maps VALIDATION_FAILED to 422 per the frozen contract", () => {
    expect(ERROR_HTTP.VALIDATION_FAILED.status).toBe(422);
  });
});
