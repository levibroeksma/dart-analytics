import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@client/errors';
import { ProvisionError } from '@client/api/players';

describe('getErrorMessage', () => {
  it('maps a known ProvisionError code to UX copy', () => {
    expect(
      getErrorMessage(new ProvisionError('PLAYER_NOT_PROVISIONED', 'Player profile not provisioned')),
    ).toBe('Account setup failed. Contact support.');
  });

  it('falls back to the raw message for an unmapped ProvisionError code', () => {
    expect(
      getErrorMessage(new ProvisionError('SERVICE_UNAVAILABLE', 'Service temporarily unavailable')),
    ).toBe('Service temporarily unavailable');
  });

  it('maps a credential-pattern SDK error message to UNAUTHORIZED copy', () => {
    expect(getErrorMessage(new Error('Invalid credentials'))).toBe(
      'Email or password is incorrect.',
    );
  });

  it('falls back to a generic message for an unrecognized error', () => {
    expect(getErrorMessage(new Error('fetch failed'))).toBe(
      'Could not reach the server. Try again.',
    );
  });
});
