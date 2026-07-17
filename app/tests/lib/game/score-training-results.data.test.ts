import { describe, it, expect, afterEach, vi } from 'vitest';
import { scoreTrainingResults } from '@lib/game/score-training-results.data';

describe('scoreTrainingResults', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes total/average/visits from the query string', () => {
    vi.stubGlobal('location', { search: '?total=80&average=40&visits=2' });

    const component = scoreTrainingResults();

    expect(component.total).toBe('80');
    expect(component.average).toBe('40');
    expect(component.visits).toBe('2');
  });

  it('defaults to "0" for each value when no query params are present', () => {
    vi.stubGlobal('location', { search: '' });

    const component = scoreTrainingResults();

    expect(component.total).toBe('0');
    expect(component.average).toBe('0');
    expect(component.visits).toBe('0');
  });
});
