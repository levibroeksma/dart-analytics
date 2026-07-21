import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseAndValidateBody } from "@server/parse-json-body";

const Schema = z.object({ name: z.string() });

describe("parseAndValidateBody", () => {
  it("returns ok:true with parsed data for a valid body matching the schema", async () => {
    const request = new Request("https://example.test/x", {
      method: "POST",
      body: JSON.stringify({ name: "Levi" }),
    });

    const result = await parseAndValidateBody(Schema, request, "req-1");

    expect(result).toEqual({ ok: true, data: { name: "Levi" } });
  });

  it("returns ok:false with a 422 response for malformed JSON", async () => {
    const request = new Request("https://example.test/x", {
      method: "POST",
      body: "{not json",
    });

    const result = await parseAndValidateBody(Schema, request, "req-2");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.response.status).toBe(422);
    const body = await result.response.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        retryable: false,
        details: { reason: "body is not valid JSON" },
      },
      requestId: "req-2",
    });
  });

  it("returns ok:false with a 422 response and issues for schema validation failure", async () => {
    const request = new Request("https://example.test/x", {
      method: "POST",
      body: JSON.stringify({ name: 42 }),
    });

    const result = await parseAndValidateBody(Schema, request, "req-3");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.response.status).toBe(422);
    const body = await result.response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details.issues).toBeDefined();
    expect(Array.isArray(body.error.details.issues)).toBe(true);
  });
});
