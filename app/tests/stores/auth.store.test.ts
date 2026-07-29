import { describe, it, expect, vi, beforeEach } from "vitest";
import { authClient } from "@client/auth/client";
import { authStore } from "@stores/auth.store";

describe("authStore.init", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("location", { pathname: "/login", replace: vi.fn() });
  });

  it("treats getSession failure as anonymous on a public page", async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(
      new Error("HTTP 401 Unauthorized"),
    );
    const store = authStore();
    await store.init();
    expect(store.status).toBe("anonymous");
    expect(store.ready).toBe(true);
  });

  it("sets loading true while init is in flight, false once it settles", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { session: { id: "s1" } },
    });
    vi.stubGlobal("location", { pathname: "/", replace: vi.fn() });
    const store = authStore();

    const promise = store.init();
    expect(store.loading).toBe(true);
    await promise;

    expect(store.loading).toBe(false);
  });
});

describe("authStore.signIn", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sets authenticated on success", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
      error: null,
    });
    const store = authStore();
    await store.signIn("a@b.nl", "secret");
    expect(store.status).toBe("authenticated");
  });

  it("throws on SDK error", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });
    const store = authStore();
    await expect(store.signIn("a@b.nl", "wrong")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("sets loading true while signIn is in flight, false after success", async () => {
    let resolveSignIn!: (
      v: Awaited<ReturnType<typeof authClient.signIn.email>>,
    ) => void;
    vi.mocked(authClient.signIn.email).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const store = authStore();

    const promise = store.signIn("a@b.nl", "secret");
    expect(store.loading).toBe(true);
    resolveSignIn({ data: {}, error: null });
    await promise;

    expect(store.loading).toBe(false);
  });

  it("clears loading even when signIn throws", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });
    const store = authStore();

    await expect(store.signIn("a@b.nl", "wrong")).rejects.toThrow(
      "Invalid credentials",
    );

    expect(store.loading).toBe(false);
  });
});

describe("authStore.signOut", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sets anonymous after signOut resolves", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue(undefined);
    const store = authStore();
    store.status = "authenticated";
    await store.signOut();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(store.status).toBe("anonymous");
  });

  it("sets loading true while signOut is in flight, false after", async () => {
    let resolveSignOut!: () => void;
    vi.mocked(authClient.signOut).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const store = authStore();

    const promise = store.signOut();
    expect(store.loading).toBe(true);
    resolveSignOut();
    await promise;

    expect(store.loading).toBe(false);
  });
});
