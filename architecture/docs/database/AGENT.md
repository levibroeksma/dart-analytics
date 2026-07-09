# Agent Rules — `architecture/docs/database/`

Scope: SQL migrations and seeds.

## Primary Goal

Maintain a valid, sequential, auditable migration/seed chain aligned with architecture docs.

## Must Read Before DB Changes

1. `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`
2. `architecture/docs/architecture/05-Database/06-Database-Specification.md`
3. `architecture/docs/architecture/05-Database/03-Migrations.md`
4. `architecture/docs/architecture/05-Database/11-Neon-Integration.md`
5. `architecture/docs/database/README.md`

## Hard Constraints

- Never modify applied migrations.
- New schema change => new numbered migration.
- Migrations are schema-only; seeds contain controlled data only.
- Keep IDs strategy intact:
  - UUIDv7 for domain/runtime entities (app/worker generated)
  - SMALLINT for controlled lookups
- No database-generated UUIDs or SERIAL identifiers for domain entities.
- No direct statistics tables for derivable analytics; use views.
- If documentation files in this scope are updated, include an ISO date (`YYYY-MM-DD`) on every newly added and/or changed row entry.

## Validation Checklist

- Migration numbering is contiguous and single-responsibility.
- New constraints/indexes match documented access patterns.
- View naming uses `v_*`.
- Any schema change is reflected in canonical DB specification.
- For `app/` integration updates tied to DB changes, standard validation includes `npx fallow`.
