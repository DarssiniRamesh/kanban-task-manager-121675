# Neon Postgres Schema Setup (Kanban Board)

## Goal

Create the same tables/indexes/triggers in **Neon Postgres** as currently defined for Supabase in:
- `supabase_schema_kanban.sql`

This keeps the schema identical:
- `public.kanban_columns`
- `public.kanban_cards`
- indexes on `position` and `column_id`
- `updated_at` trigger function + triggers

## Why this is separate from the React frontend

A Neon connection string is a **database credential** and must not be used from a browser application.
The React app in this repo currently talks directly to Supabase via `@supabase/supabase-js`.

To use Neon at runtime, add a backend/API layer that:
- stores `DATABASE_URL` securely in server env vars
- performs CRUD against Neon
- exposes HTTP endpoints for the frontend

This document focuses on **schema alignment** only.

---

## Canonical connection source

Per project convention for Postgres operations, the connection is stored in:

- `db_connection.txt` (contains a `psql "postgresql://..."` command)

Do not commit secrets anywhere else.

---

## Apply schema to Neon (one-time)

### 1) Confirm you can connect

Use the command in `db_connection.txt`:

```bash
# from this folder
$(cat db_connection.txt)
```

### 2) Ensure required extensions / functions are available

The schema uses `gen_random_uuid()` which typically comes from `pgcrypto`.

Run (execute individually):

```bash
psql "..." -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### 3) Create tables, indexes, triggers

This repo contains the authoritative DDL in `supabase_schema_kanban.sql`.

Because our workflow rule is “execute SQL one at a time”, apply each statement from that file sequentially using:

```bash
psql "..." -c "<ONE SQL STATEMENT>"
```

Statements to apply (in order):

1. `CREATE TABLE public.kanban_columns (...)`
2. `CREATE TABLE public.kanban_cards (...)`
3. `CREATE INDEX idx_kanban_cards_column_id ...`
4. `CREATE INDEX idx_kanban_columns_position ...`
5. `CREATE INDEX idx_kanban_cards_position ...`
6. `CREATE OR REPLACE FUNCTION update_updated_at_column() ...`
7. `CREATE TRIGGER set_updated_at_columns ...`
8. `CREATE TRIGGER set_updated_at_cards ...`

---

## Verify schema matches Supabase

Run these checks:

```bash
psql "..." -c "\dt public.*"
psql "..." -c "\d+ public.kanban_columns"
psql "..." -c "\d+ public.kanban_cards"
psql "..." -c "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgrelid::regclass::text, tgname;"
```

Expected:
- both tables exist in `public`
- `id` defaults to `gen_random_uuid()`
- `updated_at` triggers exist for both tables
- indexes exist as in `supabase_schema_kanban.sql`

---

## Migration policy (keeping tables “the same as now”)

The source of truth for schema in this repo is:
- `supabase_schema_kanban.sql`

If schema changes are needed later:
1. Update `supabase_schema_kanban.sql` first
2. Re-apply *only the required* ALTER/CREATE statements to Neon
3. Re-run verification queries above
"""
