import { describe, it, expect } from "vitest";
import { classifyRoute } from "@utils/route-class";

describe("classifyRoute", () => {
  it("classifies /login as public-page", () => {
    expect(classifyRoute("/login")).toBe("public-page");
  });

  it("classifies /login/ as public-page", () => {
    expect(classifyRoute("/login/")).toBe("public-page");
  });

  it("classifies provision endpoint", () => {
    expect(classifyRoute("/api/players/provision")).toBe("api-provision");
  });

  it("classifies auth proxy paths", () => {
    expect(classifyRoute("/api/auth/sign-in/email")).toBe("api-auth-proxy");
    expect(classifyRoute("/api/auth/get-session")).toBe("api-auth-proxy");
    expect(classifyRoute("/api/auth")).toBe("api-auth-proxy");
  });

  it("still classifies other /api/ paths as api-protected", () => {
    expect(classifyRoute("/api/sessions")).toBe("api-protected");
  });

  it("classifies / as protected-page", () => {
    expect(classifyRoute("/")).toBe("protected-page");
  });
});
