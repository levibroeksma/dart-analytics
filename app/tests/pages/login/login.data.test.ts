import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/players', () => ({
  provision: vi.fn(),
  ProvisionError: class ProvisionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ProvisionError';
    }
  },
}));
vi.mock('@client/auth/client', () => ({
  authClient: {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { user: { name: 'Levi' }, session: {} } }),
  },
}));

import { provision } from '@client/api/players';
import { authClient } from '@client/auth/client';
import {
  loginForm,
  mapProvisionError,
  mapSignInError,
  type LoginFormContext,
} from '@pages/login/login.data';
import { ProvisionError } from '@client/api/players';

describe('mapSignInError', () => {
  it('maps invalid credentials', () => {
    expect(mapSignInError(new Error('Invalid credentials'))).toBe(
      'Email or password is incorrect.',
    );
  });

  it('maps network errors', () => {
    expect(mapSignInError(new Error('fetch failed'))).toBe(
      'Could not reach the server. Try again.',
    );
  });
});

describe('mapProvisionError', () => {
  it('maps provision forbidden', () => {
    expect(
      mapProvisionError(
        new ProvisionError('UNAUTHORIZED', 'Authentication required'),
      ),
    ).toBe('Account setup failed. Contact support.');
  });
});

describe('loginForm.submit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { name: 'Levi' }, session: {} },
    });
  });

  it('calls provision after signIn and redirects', async () => {
    vi.mocked(provision).mockResolvedValue({
      playerId: 'p1',
      authUserId: 'a1',
      created: true,
    });
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });

    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi.fn().mockResolvedValue(undefined),
      },
    };
    form.email = 'levi@broeksma.nl';
    form.password = 'admin';

    await (form as unknown as LoginFormContext).submit();

    expect(provision).toHaveBeenCalledWith({ displayName: 'Levi' });
    expect(replace).toHaveBeenCalledWith('/');

    vi.unstubAllGlobals();
  });

  it('sets error message on signIn failure', async () => {
    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi
          .fn()
          .mockRejectedValue(new Error('Invalid email or password')),
      },
    };
    await (form as unknown as LoginFormContext).submit();
    expect(form.error).toBe('Email or password is incorrect.');
    expect(form.loading).toBe(false);
  });
});
