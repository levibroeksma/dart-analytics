import { describe, it, expect } from 'vitest';
import { ProvisionPlayerRequest, ProvisionPlayerResponse } from '../../../src/types/api/players';

describe('ProvisionPlayerRequest', () => {
  it('accepts empty object', () => {
    expect(ProvisionPlayerRequest.safeParse({}).success).toBe(true);
  });

  it('accepts displayName', () => {
    expect(
      ProvisionPlayerRequest.safeParse({ displayName: 'Levi' }).success,
    ).toBe(true);
  });

  it('rejects empty displayName', () => {
    expect(ProvisionPlayerRequest.safeParse({ displayName: '' }).success).toBe(
      false,
    );
  });
});

describe('ProvisionPlayerResponse', () => {
  it('parses valid response', () => {
    const result = ProvisionPlayerResponse.safeParse({
      playerId: '018f1234-5678-7000-8000-000000000001',
      authUserId: 'auth-1',
      created: true,
    });
    expect(result.success).toBe(true);
  });
});
