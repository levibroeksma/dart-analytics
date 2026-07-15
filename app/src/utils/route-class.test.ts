import { describe, it, expect } from 'vitest';
import { classifyRoute } from './route-class';

describe('classifyRoute', () => {
  it('classifies /login as public-page', () => {
    expect(classifyRoute('/login')).toBe('public-page');
  });

  it('classifies /login/ as public-page', () => {
    expect(classifyRoute('/login/')).toBe('public-page');
  });

  it('classifies provision endpoint', () => {
    expect(classifyRoute('/api/players/provision')).toBe('api-provision');
  });

  it('classifies / as protected-page', () => {
    expect(classifyRoute('/')).toBe('protected-page');
  });
});
