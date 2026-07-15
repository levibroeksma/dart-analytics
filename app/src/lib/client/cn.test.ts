import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('joins non-conflicting classes', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });
});
