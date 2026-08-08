-- ============================================================
-- Seed: 0006_single_band_dart_zones.sql
--
-- Adds the two single bands as distinct dart_zones rows: a
-- single is not one region but two disjoint bands separated by
-- the treble ring, and both are analytically meaningful.
--
-- Existing rows (1 SINGLE .. 6 MISS) are untouched — SINGLE
-- stays the unbanded value keypad capture records when it has
-- no coordinate to resolve a band from.
-- ============================================================
BEGIN;

INSERT INTO dart_zones (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        7,
        'INNER_SINGLE',
        'Inner Single',
        'Single scoring band between the outer bull and the treble ring, 15.9-97mm from the bull centre.',
        now()
    ),
    (
        8,
        'OUTER_SINGLE',
        'Outer Single',
        'Single scoring band between the treble ring and the double ring, 107-162mm from the bull centre.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
