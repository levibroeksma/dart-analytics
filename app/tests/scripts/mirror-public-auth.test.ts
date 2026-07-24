import { describe, it, expect } from "vitest";
import { mirrorPublicNeonAuthBaseUrl } from "../../scripts/mirror-public-auth";

describe("mirrorPublicNeonAuthBaseUrl", () => {
  it("appends PUBLIC_NEON_AUTH_BASE_URL when missing", () => {
    const input = [
      "NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
      "NEON_BRANCH=dev",
      "",
    ].join("\n");

    const result = mirrorPublicNeonAuthBaseUrl(input);

    expect(result.changed).toBe(true);
    expect(result.content).toContain(
      "PUBLIC_NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
    );
    expect(result.content).toContain(
      "NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
    );
  });

  it("updates PUBLIC_NEON_AUTH_BASE_URL when it drifts", () => {
    const input = [
      "NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
      "PUBLIC_NEON_AUTH_BASE_URL=https://stale.example/auth",
      "",
    ].join("\n");

    const result = mirrorPublicNeonAuthBaseUrl(input);

    expect(result.changed).toBe(true);
    expect(result.content).toContain(
      "PUBLIC_NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
    );
    expect(result.content).not.toContain("stale.example");
  });

  it("no-ops when PUBLIC_ already matches", () => {
    const input = [
      "NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
      "PUBLIC_NEON_AUTH_BASE_URL=https://auth.example/neondb/auth",
      "",
    ].join("\n");

    const result = mirrorPublicNeonAuthBaseUrl(input);

    expect(result.changed).toBe(false);
    expect(result.content).toBe(input);
  });

  it("throws when NEON_AUTH_BASE_URL is missing", () => {
    expect(() => mirrorPublicNeonAuthBaseUrl("NEON_BRANCH=dev\n")).toThrow(
      /NEON_AUTH_BASE_URL/,
    );
  });
});
