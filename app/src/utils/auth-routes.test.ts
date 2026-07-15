import { describe, it, expect } from 'vitest';
import { isPublicPage, normalizePath, PUBLIC_PAGES } from './auth-routes';

describe('normalizePath', () => {
  it('strips trailing slash', () => {
    expect(normalizePath('/login/')).toBe('/login');
  });

  it('keeps root', () => {
    expect(normalizePath('/')).toBe('/');
  });
});

describe('isPublicPage', () => {
  it('returns true for /login', () => {
    expect(isPublicPage('/login')).toBe(true);
  });

  it('returns true for /login/ with trailing slash', () => {
    expect(isPublicPage('/login/')).toBe(true);
  });

  it('returns false for protected routes', () => {
    expect(isPublicPage('/')).toBe(false);
    expect(isPublicPage('/games')).toBe(false);
  });
});

describe('PUBLIC_PAGES', () => {
  it('contains /login only in v1', () => {
    expect(PUBLIC_PAGES).toEqual(new Set(['/login']));
  });
});
