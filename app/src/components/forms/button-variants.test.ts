import { describe, it, expect } from 'vitest';
import { buttonVariantClass } from './button-variants';

describe('buttonVariantClass', () => {
  it('maps primary to btn-primary', () => {
    expect(buttonVariantClass('primary')).toBe('btn-primary');
  });

  it('maps secondary to btn-secondary', () => {
    expect(buttonVariantClass('secondary')).toBe('btn-secondary');
  });

  it('maps ghost to btn-ghost', () => {
    expect(buttonVariantClass('ghost')).toBe('btn-ghost');
  });
});
