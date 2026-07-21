import { describe, it, expect } from "vitest";
import { parseJsonBody } from "@server/parse-json-body";

describe("parseJsonBody", () => {
  it("parses valid JSON", () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("treats an empty body as {}", () => {
    expect(parseJsonBody("   ")).toEqual({ ok: true, value: {} });
  });

  it("reports malformed JSON as a failure", () => {
    expect(parseJsonBody("{not json")).toEqual({ ok: false });
  });
});
