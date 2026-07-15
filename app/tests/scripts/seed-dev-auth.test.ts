import { describe, it, expect } from 'vitest';
import { isAlreadyExistsError } from '../../scripts/seed-dev-auth';

describe('isAlreadyExistsError', () => {
  it('detects existing user messages', () => {
    expect(isAlreadyExistsError('User already exists')).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isAlreadyExistsError('Network failure')).toBe(false);
  });
});
