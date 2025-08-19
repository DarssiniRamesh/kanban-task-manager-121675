-- Migration to add reference_link column to kanban_cards table
ALTER TABLE public.kanban_cards
ADD COLUMN IF NOT EXISTS reference_link text;
