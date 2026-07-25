import { describe, it, expect, vi, beforeEach } from "vitest";

const parseEnvMock = vi.fn(() => ({
  postgres: { databaseUrlUnpooled: "postgres://unpooled" },
  auth: { jwksUrl: "https://auth.example.com/jwks" },
}));

vi.mock("@neon/env", () => ({ parseEnv: parseEnvMock }));

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    parseEnvMock.mockClear();
  });

  it("does not call parseEnv merely by importing the module", async () => {
    await import("../../src/lib/env");
    expect(parseEnvMock).not.toHaveBeenCalled();
  });

  it("calls parseEnv lazily on first property access", async () => {
    const { env } = await import("../../src/lib/env");
    expect(parseEnvMock).not.toHaveBeenCalled();
    expect(env.postgres.databaseUrlUnpooled).toBe("postgres://unpooled");
    expect(parseEnvMock).toHaveBeenCalledTimes(1);
  });

  it("memoizes the parsed env across multiple property accesses", async () => {
    const { env } = await import("../../src/lib/env");
    void env.postgres.databaseUrlUnpooled;
    void env.auth.jwksUrl;
    expect(parseEnvMock).toHaveBeenCalledTimes(1);
  });
});
