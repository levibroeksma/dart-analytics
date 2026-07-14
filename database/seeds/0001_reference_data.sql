-- ============================================================
-- Seed: 0001_reference_data.sql
--
-- Purpose:
-- Insert controlled application reference data.
--
-- This data is required for the application to function.
--
-- Seed data uses fixed identifiers to guarantee
-- consistency across environments.
--
-- ============================================================
BEGIN;
-- ============================================================
-- Game statuses
-- ============================================================
INSERT INTO game_statuses (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'ACTIVE',
        'Active',
        'Session is currently in progress.',
        now()
    ),
    (
        2,
        'COMPLETED',
        'Completed',
        'Session completed successfully.',
        now()
    ),
    (
        3,
        'ABANDONED',
        'Abandoned',
        'Session was started but not completed.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Capture modes
-- ============================================================
INSERT INTO capture_modes (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'RECREATIONAL',
        'Recreational',
        'Stores gameplay with minimal required detail.',
        now()
    ),
    (
        2,
        'ANALYTICS',
        'Analytics',
        'Stores detailed dart-level information.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Input modes
-- ============================================================
INSERT INTO input_modes (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'QUICK_SCORE',
        'Quick Score',
        'Fast score entry without individual dart capture.',
        now()
    ),
    (
        2,
        'DETAILED_DARTS',
        'Detailed Darts',
        'Individual dart entry for analytics.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
INSERT INTO duration_types (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'ROUNDS',
        'Rounds',
        'Exercise duration is measured in rounds.',
        now()
    ),
    (
        2,
        'MINUTES',
        'Minutes',
        'Exercise duration is measured in minutes.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Game features
-- ============================================================
INSERT INTO game_features (
        id,
        implementation_key,
        name,
        description,
        created_at,
        updated_at
    )
VALUES (
        1,
        'TIMED_MODE',
        'Timed Mode',
        'Game can be configured using a countdown timer.',
        now(),
        now()
    ),
    (
        2,
        'ROUNDS_MODE',
        'Rounds Mode',
        'Game can be configured using a fixed amount of rounds.',
        now(),
        now()
    ),
    (
        3,
        'OPPONENT_SUPPORT',
        'Opponent Support',
        'Game supports opponents.',
        now(),
        now()
    ),
    (
        4,
        'DARTBOT_SUPPORT',
        'DartBot Support',
        'Game supports AI opponents.',
        now(),
        now()
    ),
    (
        5,
        'DOUBLE_OUT',
        'Double Out',
        'Game requires finishing on a double.',
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Game types
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000001',
        '501',
        '501',
        'Standard 501 darts game.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000002',
        'TUOD',
        'Ten Up One Down',
        'Progressive target training game.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000003',
        'SINGLES_TRAINING',
        'Singles Training',
        'Singles accuracy training.',
        TRUE,
        now(),
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000004',
        'SCORE_TRAINING',
        'Score Training',
        'Scoring practice exercise.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Game feature mappings
-- ============================================================
-- 501
INSERT INTO game_type_features (
        game_type_id,
        game_feature_id,
        created_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000001',
        3,
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000001',
        4,
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000001',
        5,
        now()
    ),
    -- TUOD
    (
        '0198f000-0000-7000-8000-000000000002',
        1,
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000002',
        2,
        now()
    ),
    -- Singles
    (
        '0198f000-0000-7000-8000-000000000003',
        1,
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000003',
        2,
        now()
    ),
    -- Score training
    (
        '0198f000-0000-7000-8000-000000000004',
        1,
        now()
    ),
    (
        '0198f000-0000-7000-8000-000000000004',
        2,
        now()
    ) ON CONFLICT DO NOTHING;
-- ============================================================
-- Ruleset versions
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000001',
        '0198f000-0000-7000-8000-000000000001',
        '501_V1',
        1,
        'Initial 501 ruleset.',
        now()
    ),
    (
        '0198f100-0000-7000-8000-000000000002',
        '0198f000-0000-7000-8000-000000000002',
        'TUOD_V1',
        1,
        'Initial Ten Up One Down ruleset.',
        now()
    ),
    (
        '0198f100-0000-7000-8000-000000000003',
        '0198f000-0000-7000-8000-000000000003',
        'SINGLES_V1',
        1,
        'Initial Singles Training ruleset.',
        now()
    ),
    (
        '0198f100-0000-7000-8000-000000000004',
        '0198f000-0000-7000-8000-000000000004',
        'SCORE_TRAINING_V1',
        1,
        'Initial Score Training ruleset.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Participant types
-- ============================================================
INSERT INTO participant_types (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'PLAYER',
        'Player',
        'Authenticated application player.',
        now()
    ),
    (
        2,
        'GUEST',
        'Guest',
        'Temporary guest opponent.',
        now()
    ),
    (
        3,
        'DARTBOT',
        'DartBot',
        'Artificial opponent.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Stage types
-- ============================================================
INSERT INTO stage_types (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'MATCH',
        'Match',
        'Complete competitive match.',
        now()
    ),
    (
        2,
        'SET',
        'Set',
        'Collection of legs.',
        now()
    ),
    (
        3,
        'LEG',
        'Leg',
        'Individual 501 leg.',
        now()
    ),
    (
        4,
        'ROUND',
        'Round',
        'Training or scoring round.',
        now()
    ),
    (
        5,
        'EXERCISE_BLOCK',
        'Exercise Block',
        'Individual routine exercise block.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Dart zones
-- ============================================================
INSERT INTO dart_zones (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        1,
        'SINGLE',
        'Single',
        'Single scoring segment.',
        now()
    ),
    (
        2,
        'DOUBLE',
        'Double',
        'Double scoring ring.',
        now()
    ),
    (
        3,
        'TREBLE',
        'Treble',
        'Treble scoring ring.',
        now()
    ),
    (
        4,
        'OUTER_BULL',
        'Outer Bull',
        'Outer bull scoring area.',
        now()
    ),
    (
        5,
        'INNER_BULL',
        'Inner Bull',
        'Inner bull scoring area.',
        now()
    ),
    (
        6,
        'MISS',
        'Miss',
        'Thrown dart that misses a scoring segment.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;