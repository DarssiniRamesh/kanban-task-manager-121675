-- Migration: Add CHECK constraint to ensure cards are assigned to either product columns or market columns, but not both.
-- Constraint: At most one of (column_id, market_kanban_column_id) may be non-null.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_cards_at_most_one_column_type_chk'
  ) THEN
    ALTER TABLE public.kanban_cards
      ADD CONSTRAINT kanban_cards_at_most_one_column_type_chk
      CHECK (NOT ((column_id IS NOT NULL) AND (market_kanban_column_id IS NOT NULL)));
  END IF;
END
$$;
