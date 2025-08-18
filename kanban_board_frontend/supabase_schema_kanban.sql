-- KanbanSync SQL Schema for Supabase (DDL)
-- Tables: kanban_columns, kanban_cards
-- All field names use camelCase for frontend consistency

-- Table: kanban_columns
CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: kanban_cards
CREATE TABLE public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  feature text NOT NULL,
  description text,
  assignee text,
  notes text,
  priority text,         -- Could be 'Low', 'Medium', 'High', etc.
  status text,           -- Could be 'To Do', 'In Progress', etc.
  due_date date,         -- Due date for the card
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_kanban_cards_column_id ON public.kanban_cards(column_id);
CREATE INDEX idx_kanban_columns_position ON public.kanban_columns(position);
CREATE INDEX idx_kanban_cards_position ON public.kanban_cards(position);

-- Optional: Add trigger functions for auto-updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_updated_at_columns
BEFORE UPDATE ON public.kanban_columns
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER set_updated_at_cards
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- End of schema
