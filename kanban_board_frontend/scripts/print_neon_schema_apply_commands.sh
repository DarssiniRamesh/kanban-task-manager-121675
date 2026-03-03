#!/usr/bin/env bash
set -euo pipefail

# Prints the exact command sequence to apply the Supabase schema to Neon Postgres
# using the canonical connection command stored in db_connection.txt.
#
# Usage:
#   bash scripts/print_neon_schema_apply_commands.sh
#
# Then copy/paste each command and run them one at a time.

if [[ ! -f "db_connection.txt" ]]; then
  echo "ERROR: db_connection.txt not found. Run this from the kanban_board_frontend folder." >&2
  exit 1
fi

cat <<'TXT'
# 1) Connectivity check
sh -c "$(cat db_connection.txt) -c 'SELECT 1;'"

# 2) Extension needed for gen_random_uuid()
sh -c "$(cat db_connection.txt) -c \"CREATE EXTENSION IF NOT EXISTS pgcrypto;\""

# 3) Tables
sh -c "$(cat db_connection.txt) -c \"CREATE TABLE IF NOT EXISTS public.kanban_columns ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, position integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL );\""

sh -c "$(cat db_connection.txt) -c \"CREATE TABLE IF NOT EXISTS public.kanban_cards ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), column_id uuid REFERENCES public.kanban_columns(id) ON DELETE CASCADE, feature text NOT NULL, description text, assignee text, notes text, priority text, status text, due_date date, position integer NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL );\""

# 4) Indexes
sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_id ON public.kanban_cards(column_id);\""
sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_columns_position ON public.kanban_columns(position);\""
sh -c "$(cat db_connection.txt) -c \"CREATE INDEX IF NOT EXISTS idx_kanban_cards_position ON public.kanban_cards(position);\""

# 5) Trigger function (stdin avoids $$ shell expansion)
cat <<'SQL' | sh -c "$(cat db_connection.txt) -v ON_ERROR_STOP=1 -f -"
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';
SQL

# 6) Triggers (idempotent)
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

# 7) Verify
sh -c "$(cat db_connection.txt) -c \"\\dt public.*\""
sh -c "$(cat db_connection.txt) -c \"\\d+ public.kanban_columns\""
sh -c "$(cat db_connection.txt) -c \"\\d+ public.kanban_cards\""
sh -c "$(cat db_connection.txt) -c \"SELECT tgname, tgrelid::regclass::text AS table_name FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('set_updated_at_columns','set_updated_at_cards');\""
TXT
