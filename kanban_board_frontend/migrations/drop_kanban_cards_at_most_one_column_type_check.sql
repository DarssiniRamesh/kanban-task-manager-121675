-- Migration: Drop CHECK constraint to allow cards to belong to both product and market columns simultaneously.
-- Constraint to drop: kanban_cards_at_most_one_column_type_chk on public.kanban_cards
-- This removes the restriction that prevented both (column_id) and (market_kanban_column_id) from being non-null at the same time.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_cards_at_most_one_column_type_chk'
  ) THEN
    ALTER TABLE public.kanban_cards
      DROP CONSTRAINT kanban_cards_at_most_one_column_type_chk;
  END IF;
END
$$;
