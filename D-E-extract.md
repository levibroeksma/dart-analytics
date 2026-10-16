# Extracted data for D-E - `architecture/08-DartBot.md`

**Used query:**

```sql
SELECT d.intended_target_number,
       d.intended_zone_id,
       d.location_x,
       d.location_y
FROM   darts d
JOIN   turns t        ON t.id = d.turn_id
JOIN   participants p ON p.id = t.participant_id
WHERE  p.participant_type_id = 1
  AND  d.intended_target_number IS NOT NULL
  AND  d.location_x IS NOT NULL;
```

## `missMargin()` query result

**Used query:**

```sql
SELECT d.intended_target_number,
       dz.implementation_key AS intended_zone_key,
       d.location_x,
       d.location_y
FROM   darts d
JOIN   turns t         ON t.id = d.turn_id
JOIN   participants p  ON p.id = t.participant_id
JOIN   dart_zones dz   ON dz.id = d.intended_zone_id
WHERE  p.participant_type_id = 1
  AND  d.intended_target_number IS NOT NULL
  AND  d.intended_zone_id IS NOT NULL
  AND  d.location_x IS NOT NULL
  AND  d.location_y IS NOT NULL;
```
