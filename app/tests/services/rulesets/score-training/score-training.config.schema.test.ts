import { describe, it, expect } from 'vitest';
import { ScoreTrainingConfig } from '@services/rulesets/score-training/score-training.config.schema';

describe('ScoreTrainingConfig', () => {
  it('accepts a valid ROUNDS config', () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: 'ROUNDS',
      duration_value: 10,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid MINUTES config', () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: 'MINUTES',
      duration_value: 15,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects duration_value above 50 for ROUNDS', () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: 'ROUNDS',
      duration_value: 51,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects duration_value above 180 for MINUTES', () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: 'MINUTES',
      duration_value: 181,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_darts_per_turn above 3', () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: 'ROUNDS',
      duration_value: 10,
      max_darts_per_turn: 4,
    });
    expect(result.success).toBe(false);
  });
});
