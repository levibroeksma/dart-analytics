# Database SQL Artifacts

This directory contains SQL source-of-truth artifacts used by the application.

## Structure

```text
architecture/docs/database/
├── migrations/   # ordered schema migrations (0001–0012)
└── seeds/        # controlled reference/system data
```

## Execution Model

- Migrations are applied with `dbmate`.
- Migration files must include `-- migrate:up` and `-- migrate:down` markers (see `03-Migrations.md`).
- Seeds run after migrations in deterministic order.
- App schema ownership stays in SQL files here (not ORM-generated migrations).

## Standard Local Flow

From `app/`:

```sh
npm run db:status
npm run db:migrate
npm run db:seed
drizzle-kit introspect
npx fallow
astro check
```

## Seed Order

1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`

## References

- [`../architecture/05-Database/03-Migrations.md`](../architecture/05-Database/03-Migrations.md)
- [`../architecture/05-Database/10-Database-Agent-Guide.md`](../architecture/05-Database/10-Database-Agent-Guide.md)
- [`../architecture/05-Database/11-Neon-Integration.md`](../architecture/05-Database/11-Neon-Integration.md)
- [`../../../app/CLAUDE.md`](../../../app/CLAUDE.md)
- [`./AGENT.md`](./AGENT.md)
