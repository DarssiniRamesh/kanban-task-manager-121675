# Neon Postgres Schema Setup (Kanban Board)

## Goal

Apply the **same schema** (tables/indexes/triggers) to **Neon Postgres** as currently defined for Supabase in:

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

### 0) Important note about running the connection command

`db_connection.txt` contains a `psql ...` command with embedded quoting. To safely run it with additional flags, invoke it like:

```bash
sh -c "$(cat db_connection.txt) -c 'SELECT 1;'"
```

(Using `sh -c` ensures the embedded quotes are honored.)

### 1) Confirm you can connect

```bash
sh -c "$(cat db_connection.txt) -c 'SELECT 1;'"
```

### 2) Ensure required extension exists (for `gen_random_uuid()`)

```bash
sh -c "$(cat db_connection.txt) -c \"CREATE EXTENSION IF NOT EXISTS pgcrypto;\""
```

### 3) Create tables and indexes (one statement at a time)

These statements match `supabase_schema_kanban.sql` but are idempotent with `IF NOT EXISTS`.

```bash
sh -c "$(cat db_connection.txt) -c \"CREATE TABLE IF NOT EXISTS public.kanban_columns ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, position integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL );\""

sh -c "$(cat db_connection.txt) -c \"CREATE TABLE IF NOT EXISTS public.kanban_cards ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), column_id uuid REFERENCES public.kanban_columns(id) ON DELETE CASCADE, feature text NOT NULL, description text, assignee text, notes text, priority text, status text, due_date date, position integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL );\""

sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_id ON public.kanban_cards(column_id);\""
sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_columns_position ON public.kanban_columns(position);\""
sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_cards_position ON public.kanban_cards(position);\""
```

### 4) Create/update the `updated_at` trigger function (safe `$$` handling)

Some shells will expand `$$` if you inline it. The safest approach is to pipe SQL into `psql` via stdin:

```bash
cat <<'SQL' | sh -c "$(cat db_connection.txt) -v ON_ERROR_STOP=1 -f -"
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';
SQL
```

### 5) Create triggers (idempotent)

```bash
cat <<'SQL' | sh -c "$(cat db_connection.txt) -v ON_ERROR_STOP=1 -f -"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_columns') THEN
    CREATE TRIGGER set_updated_at_columns
    BEFORE UPDATE ON public.kanban_columns
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END
$$;
SQL

cat <<'SQL' | sh -c "$(cat db_connection.txt) -v ON_ERROR_STOP=1 -f -"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_cards') THEN
    CREATE TRIGGER set_updated_at_cards
    BEFORE UPDATE ON public.kanban_cards
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END
$$;
SQL
```

---

## Verify schema matches Supabase

Run:

```bash
sh -c "$(cat db_connection.txt) -c \"\\dt public.*\""
sh -c "$(cat db_connection.txt) -c \"\\d+ public.kanban_columns\""
sh -c "$(cat db_connection.txt) -c \"\\d+ public.kanban_cards\""

# verify triggers by name
sh -c "$(cat db_connection.txt) -c \"SELECT tgname, tgrelid::regclass::text AS table_name FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('set_updated_at_columns','set_updated_at_cards');\""
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
2. Apply only the required ALTER/CREATE statements to Neon
3. Re-run the verification queries above
