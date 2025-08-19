-- Migration: Create market_kanban_columns and add market_kanban_column_id to kanban_cards
-- This script:
-- 1) Creates public.market_kanban_columns as an exact structural copy of public.kanban_columns
--    (id uuid PK default gen_random_uuid(), title text NOT NULL, position int NOT NULL,
--     created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL),
--    and applies the same updated_at trigger.
-- 2) Adds a nullable UUID column market_kanban_column_id to public.kanban_cards with a FK to
--    public.market_kanban_columns(id) ON DELETE CASCADE, and creates an index on it.

-- 1) Create table public.market_kanban_columns mirroring public.kanban_columns
CREATE TABLE IF NOT EXISTS public.market_kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: mirror useful index from kanban_columns for ordering/filtering
CREATE INDEX IF NOT EXISTS idx_market_kanban_columns_position ON public.market_kanban_columns(position);

-- Ensure trigger function used for updated_at exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the same updated_at trigger behavior to market_kanban_columns
DROP TRIGGER IF EXISTS set_updated_at_market_columns ON public.market_kanban_columns;
CREATE TRIGGER set_updated_at_market_columns
BEFORE UPDATE ON public.market_kanban_columns
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- 2) Add market_kanban_column_id to kanban_cards with FK and index
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS market_kanban_column_id uuid;

-- Add FK constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_cards_market_kanban_column_id_fkey'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_market_kanban_column_id_fkey
      FOREIGN KEY (market_kanban_column_id)
      REFERENCES public.market_kanban_columns(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- Create index for performant lookups/joins on the new FK column
CREATE INDEX IF NOT EXISTS idx_kanban_cards_market_kanban_column_id
  ON public.kanban_cards(market_kanban_column_id);
