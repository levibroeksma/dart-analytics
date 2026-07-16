import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authClient } from '@client/auth/client';
import { authStore } from '@stores/auth.store';

describe('authStore.init', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('location', { pathname: '/login', replace: vi.fn() });
  });

  it('treats getSession failure as anonymous on a public page', async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(
      new Error('HTTP 401 Unauthorized'),
    );
    const store = authStore();
    await store.init();
    expect(store.status).toBe('anonymous');
    expect(store.ready).toBe(true);
  });
});

describe('authStore.signIn', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets authenticated on success', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
      error: null,
    });
    const store = authStore();
    await store.signIn('a@b.nl', 'secret');
    expect(store.status).toBe('authenticated');
  });

  it('throws on SDK error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });
    const store = authStore();
    await expect(store.signIn('a@b.nl', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
  });
});

describe('authStore.signOut', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets anonymous after signOut resolves', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue(undefined);
    const store = authStore();
    store.status = 'authenticated';
    await store.signOut();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(store.status).toBe('anonymous');
  });
});
