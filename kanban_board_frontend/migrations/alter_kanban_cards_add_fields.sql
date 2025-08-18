-- Migration: Add new fields to kanban_cards table for Impact, Market Need, Estimated Effort, and Category

-- Create ENUM type for impact if not already existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_type') THEN
        CREATE TYPE impact_type AS ENUM (
            'High Impact - Low Effort',
            'High Effort - Low Impact',
            'High Effort - High Impact',
            'Low Effort - Low Impact'
        );
    END IF;
END
$$;

-- Add impact column if not exists
ALTER TABLE public.kanban_cards
    ADD COLUMN IF NOT EXISTS impact impact_type;

-- Create ENUM type for market_need if not already existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_need_type') THEN
        CREATE TYPE market_need_type AS ENUM ('Demand', 'USP', 'Usability', 'Nice to Have');
    END IF;
END
$$;

-- Add market_need column if not exists
ALTER TABLE public.kanban_cards
    ADD COLUMN IF NOT EXISTS market_need market_need_type;

-- Add estimated_effort column if not exists
ALTER TABLE public.kanban_cards
    ADD COLUMN IF NOT EXISTS estimated_effort integer;

-- Create ENUM type for category if not already existing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_category_type') THEN
        CREATE TYPE card_category_type AS ENUM ('Feature', 'Enhancement', 'Feedback');
    END IF;
END
$$;

-- Add category column if not exists
ALTER TABLE public.kanban_cards
    ADD COLUMN IF NOT EXISTS category card_category_type;
