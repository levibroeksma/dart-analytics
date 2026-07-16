import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/configuration-templates', () => ({ fetchConfigurationPresets: vi.fn() }));
vi.mock('@client/api/sessions', () => ({ createSession: vi.fn() }));

import { fetchConfigurationPresets } from '@client/api/configuration-templates';
import { createSession } from '@client/api/sessions';
import { scoreTrainingSetup } from '@lib/game/score-training-setup.data';

describe('scoreTrainingSetup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads presets on init', async () => {
    vi.mocked(fetchConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: 'c1', gameTypeKey: 'SCORE_TRAINING', name: '10 Rounds', description: null, configuration: { duration_type: 'ROUNDS', duration_value: 10, max_darts_per_turn: 3 }, isSystemTemplate: true },
    ]);
    const component = scoreTrainingSetup();
    await component.init();
    expect(component.presets).toHaveLength(1);
  });

  it('starts a session from the selected preset and stores it in game.store', async () => {
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 's1',
      participants: [{ ref: 'p1', participantTypeKey: 'PLAYER', displayName: 'Levi' }],
    });
    const gameStub = { startSession: vi.fn() };
    const component = {
      ...scoreTrainingSetup(),
      selectedTemplateId: 'c1',
      presets: [
        { configurationTemplateId: 'c1', gameTypeKey: 'SCORE_TRAINING', name: '10 Rounds', description: null, configuration: { duration_type: 'ROUNDS', duration_value: 10, max_darts_per_turn: 3 }, isSystemTemplate: true },
      ],
      $store: { game: gameStub },
    };
    await component.start.call(component);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ gameTypeKey: 'SCORE_TRAINING', rulesetVersionKey: 'SCORE_TRAINING_V1' }),
    );
    expect(gameStub.startSession).toHaveBeenCalledWith({
      gameTypeKey: 'SCORE_TRAINING',
      sessionId: 's1',
      participantRef: 'p1',
      configSnapshot: { durationType: 'ROUNDS', durationValue: 10, maxDartsPerTurn: 3 },
    });
  });
});
