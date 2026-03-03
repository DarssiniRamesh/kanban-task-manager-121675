-- Seed script generated from attachments/kanban_cards_export*.csv
-- Target: Neon/Postgres (same schema as supabase_schema_kanban.sql)
--
-- What this script does:
--  1) Ensures pgcrypto exists (for gen_random_uuid if needed elsewhere)
--  2) Creates 3 baseline columns (To Do, In Progress, Done) if they don't exist
--  3) Inserts/Upserts cards from exports (deduplicated by id) and assigns:
--       - column_id based on status
--       - position per column (ordered by due_date asc nulls last, then feature)
--
-- Safe to run multiple times:
--  - columns: ON CONFLICT(title) DO UPDATE (keeps deterministic ids by title)
--  - cards:   ON CONFLICT(id) DO UPDATE (keeps data refreshed)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Baseline columns (ensure a unique constraint on title for conflict handling)
-- If your DB doesn't have it yet, we add it (idempotent DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kanban_columns_title_unique'
  ) THEN
    ALTER TABLE public.kanban_columns
      ADD CONSTRAINT kanban_columns_title_unique UNIQUE (title);
  END IF;
END $$;

-- Deterministic UUIDs per status title, so repeated runs stay stable.
-- Using md5->uuid technique (no extra extensions required).
WITH desired_columns AS (
  SELECT
    (substr(md5('kanban_columns:To Do'),1,8)||'-'||substr(md5('kanban_columns:To Do'),9,4)||'-'||substr(md5('kanban_columns:To Do'),13,4)||'-'||substr(md5('kanban_columns:To Do'),17,4)||'-'||substr(md5('kanban_columns:To Do'),21,12))::uuid AS id,
    'To Do'::text AS title,
    1::int AS position
  UNION ALL
  SELECT
    (substr(md5('kanban_columns:In Progress'),1,8)||'-'||substr(md5('kanban_columns:In Progress'),9,4)||'-'||substr(md5('kanban_columns:In Progress'),13,4)||'-'||substr(md5('kanban_columns:In Progress'),17,4)||'-'||substr(md5('kanban_columns:In Progress'),21,12))::uuid AS id,
    'In Progress'::text AS title,
    2::int AS position
  UNION ALL
  SELECT
    (substr(md5('kanban_columns:Done'),1,8)||'-'||substr(md5('kanban_columns:Done'),9,4)||'-'||substr(md5('kanban_columns:Done'),13,4)||'-'||substr(md5('kanban_columns:Done'),17,4)||'-'||substr(md5('kanban_columns:Done'),21,12))::uuid AS id,
    'Done'::text AS title,
    3::int AS position
)
INSERT INTO public.kanban_columns (id, title, position)
SELECT id, title, position
FROM desired_columns
ON CONFLICT (title) DO UPDATE
SET
  position = EXCLUDED.position,
  updated_at = now();

-- Helper CTE to map a status string to a canonical column title
-- (handles "To do" vs "To Do" seen in exports).
WITH status_map AS (
  SELECT 'to do'::text AS status_key, 'To Do'::text AS column_title
  UNION ALL SELECT 'to do '::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'to do'::text, 'To Do'
  UNION ALL SELECT 'in progress'::text, 'In Progress'::text
  UNION ALL SELECT 'done'::text, 'Done'::text
),
cards_raw AS (
  -- Deduped/merged by id from all exports.
  -- (Each id appears at most once below.)
  SELECT * FROM (VALUES
    ('3c846ddb-a2fd-4b79-b3c6-0ef09250bc5b'::uuid, 'zx'::text, NULL::text, 'Chathura'::text, NULL::text, 'High'::text, 'To Do'::text, '2025-08-29'::date),
    ('7f5c3c3b-49e2-4d61-a33a-600d0ca6510c'::uuid, 'Credit, Cost and Monitoring Dashboard'::text, 'Dashboard for managing credits, cost, and usage monitoring.'::text, 'Nadarajan'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('55ebcc57-e353-4ed3-9401-c6ad9a8be362'::uuid, 'Stripe Integration'::text, 'Payment gateway integration for subscriptions and billing.'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('71a11be5-2aac-4a7f-9ff8-5fdfc9eb8cdd'::uuid, 'B2C Self Signup'::text, 'Self-service sign-up flow for end users.'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('6968ba22-c311-467a-a456-43aec3cf197c'::uuid, 'Website to Beta Integration'::text, 'Website flows integrated with public Beta experience.'::text, 'Sanjay'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('10aabab4-ec46-495a-8c44-edf29d07ce38'::uuid, 'Shared Projects & Cloning'::text, 'Ability to share projects and clone them for collaboration.'::text, 'Anjan'::text, 'Generic'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('bedc0e12-460c-4a44-8636-8c82a60c197e'::uuid, 'Direct CGA & Blueprint'::text, 'Direct access to Code Generation Agent and Blueprint creation.'::text, 'Anjan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('753f6cef-a15f-4aa9-967a-d0760a8f9ce7'::uuid, 'Backend Framework + Preview'::text, 'Add backend frameworks with code preview feature.'::text, 'Raphael'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('7e13b8a4-97ae-4c67-9369-34d38feb3f12'::uuid, 'Auto Bug Fix CGA'::text, 'Auto bug fixing using Code Generation Agent.'::text, 'Zoltan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('222ffb36-4011-4038-8bff-cff684af5b05'::uuid, 'Supabase Integration'::text, 'Connect and use Supabase backend.'::text, 'Nadarajan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('d6b2755c-4dce-4bc6-869f-8f7f752a8264'::uuid, 'Manifest Generation'::text, 'Automatic generation of manifest files per container/project.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('a978f176-2964-4268-881f-650034dec82c'::uuid, 'Multi-web Framework + Preview'::text, 'Support and preview for multiple web frameworks.'::text, 'Raphael'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('5cf52268-e0a4-440f-8116-3522f84e9da0'::uuid, 'Multi-container CGA'::text, 'Code Generation Agent supports multiple containers.'::text, 'Zoltan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('812bb25b-e02b-487c-8f3b-c41896078581'::uuid, 'DB Integration + Preview'::text, 'Database integration with live preview capability.'::text, 'Raphael'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('957e20a2-7cfe-46b9-98ba-6c55f30ddb4b'::uuid, 'Git-Session Handling'::text, 'Git session management for code operations.'::text, 'Praveen'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('e86074ef-0f89-45b1-a303-3bcf66bdd77e'::uuid, 'Image Extraction'::text, 'Extract images from code or documents for project use.'::text, 'Labeeb'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('c6e96f66-f525-41ca-96ff-ea388be16db5'::uuid, 'Mobile Framework + Preview'::text, 'Mobile frameworks support, plus preview features.'::text, 'Raphael'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('710a088c-e269-4337-8446-368f9713a9db'::uuid, 'Swagger Docs'::text, 'Auto-generate Swagger/OpenAPI documentation.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('e36d581a-69f8-4347-9cee-792ab741d3c9'::uuid, 'Code Streaming'::text, 'Stream generated or modified code live to users.'::text, 'Praveen'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('e77bea71-2fce-414c-a2d9-7f4b6ed42933'::uuid, 'File Attachment CGA'::text, 'Attach files for Code Generation Agent operations.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('6e95e98b-791b-4635-991b-c79fcd8e891f'::uuid, 'Figma Extraction'::text, 'Import and extract UI/code from Figma design files.'::text, 'Babu K'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('09eb21dd-b7c0-4a50-a669-29ff3e28a1e2'::uuid, 'Deep Query'::text, 'Advanced deep queries for code and knowledge.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('b8af85ef-1e2d-4c9b-a178-cfb15baa55c1'::uuid, 'Multi-Doc Handling'::text, 'Process and handle multiple document types during ingestion.'::text, 'Jeff'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('c3769e32-b233-47b6-97b4-e68631baba41'::uuid, 'Local Code Ingestion'::text, 'Ingest code from local files/folders into platform.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('8ea36306-ddb1-4a6e-99f6-5c025a1e5bb0'::uuid, 'GitLab Integration'::text, 'Integrate and pull repositories from GitLab.'::text, 'Prasanth'::text, 'Ingestion and Inspect Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('6a8a4e97-647b-4532-beff-225e6d48582b'::uuid, 'LLM Model Selection'::text, 'Let users select large language model for code/Q&A.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('d8de547f-cf69-4e26-8a16-87b0d2ba0f4f'::uuid, 'Save and Export Doc'::text, 'Save and export generated docs and analysis for later use.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('ded4caf9-4a5d-4cde-bb98-b8b6b1bc1c20'::uuid, 'Test Case Generation'::text, 'Auto-generate test cases from requirements/code context.'::text, 'Anjan'::text, 'Plan Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('d6089856-c21a-46f6-8032-19162554ba94'::uuid, 'Reconfiguration'::text, 'Allow live reconfiguration of project/app setup.'::text, 'Veera'::text, 'Plan Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('978f4538-9219-4da7-80e1-9d9647602e05'::uuid, 'Import/Export Plan Details'::text, 'Import/export project plans for external usage.'::text, 'Jay'::text, 'Plan Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('4a73bd92-af63-4771-aef8-e74242a05ae9'::uuid, 'Plan Documentation'::text, 'Automatically maintain documentation for plans and changes.'::text, 'Anjan'::text, 'Plan Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('b915eeeb-381b-4146-b686-adde2bd41977'::uuid, 'DB Design'::text, 'Visualize and design database schema during planning.'::text, 'Anjan'::text, 'Plan Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('6481944f-200c-449a-af54-fa9f768d7972'::uuid, 'ETA for Auto-Config'::text, 'Show estimated completion time for auto configuration steps.'::text, 'Chathura'::text, 'Plan Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('267a94b4-3611-4556-b571-a8ad50980705'::uuid, 'Project Creation'::text, 'Ability to create new projects within the platform from scratch or templates.'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('32afe1da-a5d1-434b-ba02-0daba343001a'::uuid, 'Tenant Configuration'::text, 'Configure and manage tenant-level settings for multi-tenant deployments.'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('a4dc91e2-fdb3-4402-9afc-eda0b6696f96'::uuid, 'Requirement Creation'::text, 'Create and manage epics, user stories, and tasks within project requirements.'::text, 'Veera'::text, 'Plan Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('71e58f58-9b7c-48a4-8b99-080235fa6ac1'::uuid, 'Architecture Configuration'::text, 'Define and configure complete architecture, components, and integrations for a project.'::text, 'Veera'::text, 'Plan Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('2502d0c2-3018-4119-b38b-1666641e3ca0'::uuid, 'Auto Configuration'::text, 'Automatically configure environments, dependencies, and base setup for projects.'::text, 'Anjan'::text, 'Plan Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('625e55cb-cb7e-4bed-b444-2ca6d564525b'::uuid, 'Documentation'::text, 'Automatically generate and maintain project-related documentation.'::text, 'Veera'::text, 'Plan Phase'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('76aa0a50-68df-4650-9320-e4419dc75564'::uuid, 'Code Generation Agent'::text, 'AI-powered agent to generate new code based on requirements or prompts.'::text, 'Labeeb'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('8fa578fa-5905-4257-a09b-35415d205cf3'::uuid, 'Maintenance Agent'::text, 'AI-powered agent to refactor, fix, or enhance existing project code.'::text, 'Zoltan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('55f9ef46-8328-4a64-90c8-65ec8c729f80'::uuid, 'Website Reading Support'::text, 'Ability to read and interpret live website/application content for reverse engineering.'::text, 'Labeeb'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-07-31'::date),
    ('67a90d03-d6b4-41fe-b460-e6549461c641'::uuid, 'Ingestion Support for Code'::text, 'Support for ingesting and indexing code from various sources into the platform.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('9065257f-8cf2-42d3-8b05-f11252965810'::uuid, 'Code Query Implementation'::text, 'Implementation of natural language code querying across ingested codebases.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-07-31'::date),
    ('0493a0ea-d13b-45ba-ba1b-6808d3753827'::uuid, 'Mobile Framework Support'::text, 'Enables code generation for mobile frameworks with live preview options.'::text, 'Raphael'::text, 'Code Gen & Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-08-07'::date),
    ('a53275dc-0d95-4357-a61e-7d7615c117c1'::uuid, 'Frontend Deployment Enhancements'::text, 'Improved deployment workflow for frontend applications and preview.'::text, 'Raphael'::text, 'Code Gen & Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-08-07'::date),
    ('54214c3a-660d-4ccc-8aa2-48fff2c9d646'::uuid, 'New Manifest UI'::text, 'Redesigned manifest management UI for easier code maintenance.'::text, 'Prasanth'::text, 'Code Gen & Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-08-07'::date),
    ('be1c036d-06e0-44d7-b992-c64e9630d4d1'::uuid, 'GitLab Code Query & Maintenance'::text, 'Query and maintain code across GitLab repositories efficiently.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'Medium'::text, 'Done'::text, '2025-08-07'::date),
    ('67b8524c-e65f-41f5-a5d7-9033b1d3235a'::uuid, 'Kavia Help Chat Bot'::text, 'In-app help chat bot for quick support and guidance during workflows.'::text, 'Niku Singh'::text, 'Generic'::text, 'Medium'::text, 'Done'::text, '2025-08-07'::date),
    ('d68103f8-0740-4b69-9e7c-7eeab20c1c22'::uuid, 'Deployed App Dashboard'::text, 'Overview dashboard for deployed applications and their statuses.'::text, 'Babu K'::text, 'Generic'::text, 'Medium'::text, 'Done'::text, '2025-08-07'::date),
    ('231f1ad0-a1d4-4a01-a593-98842d823c2c'::uuid, 'Manifest Setup'::text, 'Simplified process to set up project manifests for code management.'::text, 'Prasanth'::text, 'Code Gen & Maintenance (BUILD)'::text, 'Medium'::text, 'Done'::text, '2025-08-07'::date),
    ('6fc9cc3a-c741-4c04-9622-ac6ee8b8a026'::uuid, 'Credit Downgrade'::text, 'Enabling Auto Credit Downgrade fixes'::text, 'Nadarajan'::text, 'Generic'::text, 'High'::text, 'Done'::text, '2025-08-07'::date),
    ('e7719a56-9ac7-4a8f-846c-832fdb37fd6a'::uuid, 'GitLab OAuth Integration'::text, 'Implement OAuth authentication for private project access on GitLab repositories.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'Done'::text, '2025-08-14'::date),
    ('13c31b8f-536f-44cf-baf8-7144606703dc'::uuid, 'Manifest Edit and Validation'::text, 'Resolve overall manifest editing issues and improve accuracy across all frameworks.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'Done'::text, '2025-08-14'::date),
    ('c9494c9b-24b1-402f-b1a8-7efa1832d0e4'::uuid, 'Figma Preview for Code Gen'::text, 'Generate code directly from Figma designs with instant preview feature.'::text, 'Babu K'::text, 'Code Gen & Maintenance (BUILD)'::text, 'Critical'::text, 'Done'::text, '2025-08-07'::date),
    ('25817bbe-4b18-48db-bf44-9e630ff37883'::uuid, 'Manifest UI Cleanup'::text, 'Clean up all unwanted fields in manifest UI for better user experience.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Critical'::text, 'Review'::text, '2025-08-14'::date),
    ('ad4d603a-e0c0-4cfd-b01c-c59ac11f4bb5'::uuid, 'Figma Enhancements'::text, 'Improve Figma integration features and user experience.'::text, 'Nadarajan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'In Progress'::text, '2025-08-14'::date),
    ('1425dcd4-3332-4f1e-aee2-5bee6852534c'::uuid, 'Extended Sessions'::text, 'Support for extended sessions in application workflows.'::text, 'Zoltan'::text, 'Code Gen & Maintenance (BUILD)'::text, 'Critical'::text, 'In Progress'::text, '2025-08-07'::date),
    ('6f00304b-ba5f-4159-be8c-fe907599dad2'::uuid, 'Referral Code Google Signup'::text, 'Integrate referral code functionality with Google signup process.'::text, 'Babu K'::text, 'Generic'::text, 'Medium'::text, 'Done'::text, '2025-08-14'::date),
    ('15a12e74-4059-4f5d-b835-db5797693db2'::uuid, 'ASP.NET Integration'::text, 'Bring ASP.NET framework support into Kavia Beta production environment.'::text, 'Babu K'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'To do'::text, '2025-08-31'::date),
    ('4cc692c4-d59f-4766-83d6-55ac5d20934b'::uuid, 'Additional Backend Frameworks'::text, 'Add support for new backend frameworks (Node.js, Java Spring Boot, etc.).'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'To do'::text, '2025-08-14'::date),
    ('d8e4be6a-1e71-4bb3-a90d-9dbb17508a56'::uuid, 'Deployment Dashboard'::text, 'Create dashboard to view existing deployments with patch script functionality and apps summary view'::text, 'Praveen'::text, 'Generic'::text, 'Medium'::text, 'To do'::text, '2025-08-14'::date),
    ('ea9cef5d-775b-45fa-94a4-c24e55f420d7'::uuid, 'Unify Code Gen and Maintenance'::text, 'Merge code generation and maintenance workflows into unified experience.'::text, 'Prasanth'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'To do'::text, '2025-08-21'::date),
    ('3b54e6b6-71db-4650-a7e2-2e4efcdf04b6'::uuid, 'Plan to Build - CGA Integration'::text, 'Integrate planning phase directly with Code Generation Agent workflows.'::text, 'Anjan'::text, 'Plan Phase'::text, 'Critical'::text, 'To do'::text, '2025-08-21'::date),
    ('045021c1-e805-4997-b22f-0061997581e2'::uuid, 'Gerrit OAuth Integration'::text, 'Implement OAuth authentication for private project access on Gerrit repositories.'::text, 'Esakki'::text, 'Ingestion and Inspect Phase'::text, 'High'::text, 'In Progress'::text, '2025-08-14'::date),
    ('8b9260aa-7a92-4522-af4c-d208f70f58ae'::uuid, 'Multiple Container Enablement'::text, 'Support frontend, backend, and mixed container configurations with proper preview allocation.'::text, 'Zoltan'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Critical'::text, 'To do'::text, '2025-08-31'::date),
    ('781e7050-2fc7-4211-9415-af5259501499'::uuid, 'Figma From Home'::text, 'Figma Integration from Blueprint should be enabled with OAuth Integration'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'To Do'::text, '2025-08-21'::date),
    ('25709aee-4edd-40f1-a751-e743fb8e3132'::uuid, 'Guided Setup'::text, 'Enhanced Guided Setup for the Plan phase of the Application'::text, 'Sanjay'::text, 'Plan'::text, 'High'::text, 'In Progress'::text, '2025-08-19'::date),
    ('28c25b97-de45-4aeb-89bc-c484705f0e80'::uuid, 'Single Source of Assets'::text, 'Maintain unified asset management system throughout the entire application platform.'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'To do'::text, '2025-08-31'::date),
    ('41a26f94-e256-4b6b-afe7-8d8c047afb8d'::uuid, 'Project Chat Interface'::text, 'Implement dedicated chat interface for project-level discussions and user level collaboration.'::text, 'Niku Singh'::text, 'Generic'::text, 'Low'::text, 'To do'::text, '2025-08-21'::date),
    ('aaba9e12-edee-4616-a8de-842b8c1733b9'::uuid, 'Simplified UI'::text, 'Streamline and simplify the overall user interface for better usability.'::text, 'Sanjay'::text, 'Generic'::text, 'Critical'::text, 'To do'::text, '2025-08-21'::date),
    ('3124dbce-3be4-404c-af3c-972d6697b3b3'::uuid, 'Jira Integrations'::text, 'Integrate with Jira for seamless project management workflows.'::text, 'Malaiarasu'::text, 'Generic'::text, 'Medium'::text, 'To do'::text, '2025-08-21'::date),
    ('f0664e93-4c1b-4649-848c-fac88fc8984d'::uuid, 'Smooth Streaming Enhancement'::text, 'Improve animation speed and chunk-based streaming for better user experience.'::text, 'Praveen'::text, 'Generic'::text, 'High'::text, 'In Progress'::text, '2025-08-14'::date),
    ('5a5dba48-2538-4cea-873c-509e85165fe9'::uuid, 'Local File Upload Enhancements'::text, 'Improve local file upload capabilities and user experience.'::text, 'Esakki'::text, 'Code Generation and Maintenance (BUILD)'::text, 'Medium'::text, 'To do'::text, '2025-08-21'::date),
    ('f1b819ae-65a9-462c-a1f6-2c46cebb14db'::uuid, 'Quick Access Tool in Home'::text, 'Add quick access tools and shortcuts in the home dashboard.'::text, 'Praveen'::text, 'Generic'::text, 'Medium'::text, 'To do'::text, '2025-08-21'::date),
    ('6295f0d7-ee54-4c99-96fb-9830a6efd3ed'::uuid, 'Supabase from CGA'::text, 'Within the CGA Panel we need the Integration option for Supabase, OAuth and more'::text, 'Nadarajan'::text, 'Generic'::text, 'Medium'::text, 'To Do'::text, '2025-08-21'::date),
    ('4815a0d3-737d-453e-99f8-23d79e0d8fa8'::uuid, 'HLD, LLD and BRS Documents'::text, 'From the Plan phase, we need to enable a HLD and LLD Document which can High level architecture flow and Low level of the entire app as single document'::text, 'Jay'::text, 'Tata Requirements'::text, 'High'::text, 'To Do'::text, '2025-08-21'::date),
    ('02c10e7f-a259-45b1-ab41-ee238e9a80d9'::uuid, 'Style Guide'::text, 'From the Blue Print, We are enabling a style guide selection and have a sample preview to see how the styling looks like with the selected JSON styles'::text, 'Anjan'::text, 'Generic'::text, 'High'::text, 'To Do'::text, '2025-08-26'::date),
    ('434c4efd-9742-4975-a40e-fd7b7e45a777'::uuid, 'Resume Latest Session'::text, 'Add "Resume Latest Session" option in project list for quick continuation of work.'::text, 'Prasanth'::text, 'Generic'::text, 'Medium'::text, 'To do'::text, '2025-08-31'::date),
    ('bf8d2b97-b349-4faf-9e4a-9ed0adc6fdb0'::uuid, 'Credit Cycle Management'::text, 'Enable mid-cycle upgrade options for seamless subscription plan changes.'::text, 'Nadarajan'::text, 'Generic'::text, 'High'::text, 'On Hold'::text, '2025-08-14'::date),
    ('268d75c9-5b9c-497b-b18b-2701b1d45bbd'::uuid, 'Private Project User Access'::text, 'Add capability to share private projects with specific users (user access management).'::text, 'Babu K'::text, 'Generic'::text, 'Medium'::text, 'To do'::text, '2025-08-31'::date),
    ('d572af54-fc62-4a3d-b08b-c52015910d3e'::uuid, 'Dark Mode UI'::text, 'Dark mode for all components'::text, 'Sanjay'::text, 'Generic'::text, 'High'::text, 'To Do'::text, '2025-08-28'::date),
    ('553bd0b0-ded3-455c-9793-27d46ba84ae4'::uuid, 'Legacy Modernization'::text, 'Code and Document based Planning - After Plan, modernize code based on work items and current code base correctly'::text, 'Labeeb'::text, 'Build'::text, 'Critical'::text, 'Done'::text, '2025-08-31'::date),
    ('968a156e-689c-4585-ad9b-88ed3eb2c3d1'::uuid, 'Legacy Modernization'::text, 'Code and Document based Planning - After Plan, modernize code based on work items and current code base correctly'::text, 'Labeeb'::text, 'Plan and Build'::text, 'Critical'::text, 'To Do'::text, '2025-09-30'::date),
    ('e2712b9f-8287-442b-93dd-72fd7ef44e0b'::uuid, 'MCP Integration'::text, NULL::text, NULL::text, NULL::text, 'High'::text, 'To Do'::text, '2025-12-19'::date),
    ('b1854f92-6b1e-4e27-9262-d14d6b605ae0'::uuid, 'VSCODE Extension (Demo)'::text, 'Enable Query, Code Gen and Maintenance using VScode plugin'::text, 'Jhonny and Niku'::text, 'Build'::text, 'High'::text, 'Done'::text, '2025-09-15'::date),
    ('24b6e9e2-0d7b-4913-924a-c804fe63a7e8'::uuid, 'Android TV Scaffolding for Tata'::text, 'Description here'::text, 'Raphael'::text, 'Any extra notes for the team'::text, 'High'::text, 'Done'::text, '2024-01-31'::date),
    ('ac9387ca-50b4-438b-9df5-294bc856a745'::uuid, 'Dynamic Documentation'::text, 'Description here'::text, 'Anjan'::text, 'Any extra notes for the team'::text, 'High'::text, 'Done'::text, '2024-01-31'::date),
    ('8a66f5dd-8a52-44d4-9f7f-3096301519cd'::uuid, 'Monaco vs VSCode Editor'::text, 'Description here'::text, 'Babu K'::text, 'Any extra notes for the team'::text, 'High'::text, 'Done'::text, '2024-01-31'::date),
    ('7018a4fb-c82f-462b-a05c-0da59340c39f'::uuid, 'B2B Onboarding Feature Enhancement'::text, 'Direct onboarding flow during customer calls'::text, 'Babu K'::text, 'Generic'::text, 'Critical'::text, 'In Progress'::text, '2025-09-18'::date),
    ('3a58c9f2-f5da-4731-86a9-3e39b1e38543'::uuid, 'Account Selection and Figma in Chat'::text, 'Enable repository selection directly within the chat interface, allowing users to specify target repositories for code generation and modifications'::text, 'Babu K'::text, 'Requires integration with Git providers (GitHub, GitLab, Bitbucket). Include branch selection capability.'::text, 'High'::text, 'In Progress'::text, '2025-11-20'::date),
    ('6a0f05f6-3587-4d52-b860-f203fd213063'::uuid, 'Chat with Plan'::text, 'Enable comprehensive planning through chat interface with instant artifact generation, guided overview displaying requirements and architecture for collaborative planning phase'::text, 'Sanjay and Anjan'::text, 'Major feature requiring UI/UX design. Artifact generation needs to be optimized for performance. Consider collaboration features (commenting, versioning).'::text, 'High'::text, 'In Progress'::text, '2025-12-04'::date),
    ('098db5df-1005-4fc3-9ced-c2262f45afe2'::uuid, 'Dashboard Analytics'::text, 'Dashboard for Tenant and Users - Feature Listing from CGA''s New PR'::text, 'Aditi, Prashant'::text, 'Any extra notes for the team'::text, 'High'::text, 'Review'::text, '2025-11-20'::date),
    ('ab9f2657-9952-4d69-bc06-d3111eff9429'::uuid, 'K-Diff Enabling Flow'::text, 'Implement K-Diff visualization flow to display differences between commit changes, enabling easy identification of regressions and code quality checks'::text, 'Prasanth'::text, 'Critical for regression detection. Consider performance for large commits. May need diff highlighting and side-by-side view.'::text, 'High'::text, 'In Progress'::text, '2025-11-20'::date),
    ('2afb1508-95b0-4250-a354-9987b9084788'::uuid, 'VSC Extension QA Release'::text, 'Release Visual Studio Code extension to enable Kavia AI features directly within VS Code IDE environment'::text, 'Jhonny and Niku'::text, 'Major release milestone. Ensure VS Code marketplace compliance. Include auto-update mechanism.'::text, 'High'::text, 'In Progress'::text, '2025-11-27'::date),
    ('16a45fb2-5327-4470-b928-e6e60fe41f98'::uuid, 'Native/Generic Framework Validation'::text, 'Add validation framework to support both native and generic framework types, ensuring code generation compatibility across different technology stacks'::text, 'Derrick'::text, 'Define validation criteria for different frameworks. Create framework adapter pattern for extensibility.'::text, 'High'::text, 'On Hold'::text, '2025-11-27'::date),
    ('3fa5802c-1c44-4548-b86e-1dfa470f8df8'::uuid, 'SDK Building for Device Imaging and DEVVMs'::text, 'Build SDK tools for device imaging and developer virtual machines (DEVVMs) to enable running and testing applications directly on target devices'::text, 'Raphael'::text, 'Complex infrastructure requirement. Coordinate with DevOps team. Requires device driver support and image management.'::text, 'Critical'::text, 'In Progress'::text, '2025-11-20'::date),
    ('6eb37c3f-1573-4676-b8ee-d57721761db3'::uuid, 'Interactive Chat Mode for Code Generation Agent'::text, 'Enable interactive chat mode for real-time code generation through the Code Generation Agent (CGA), allowing developers to generate, modify, and refine code through conversational interface'::text, 'Labeeb'::text, 'Core UX enhancement for developer workflow. Requires real-time streaming, context management, and error handling.'::text, 'High'::text, 'To Do'::text, '2025-11-20'::date),
    ('7b9f5cd4-37a8-463e-a7bf-25fe175a203c'::uuid, 'Cloning of Sessions and CGA'::text, 'Allow users to clone existing chat sessions and CGA configurations to reuse successful prompts, settings, and context for similar development tasks'::text, 'Prasanth'::text, 'Depends on session state management and CGA configuration serialization. Consider privacy implications.'::text, 'High'::text, 'To Do'::text, '2025-11-20'::date),
    ('1d99dc3b-47ee-4e87-9f28-b1559794d3df'::uuid, 'Brightscript for Tata'::text, 'Description here'::text, 'Raphael'::text, 'Any extra notes for the team'::text, 'Medium'::text, 'To Do'::text, '2025-11-27'::date),
    ('cf128637-5520-4cf4-ac76-9b7b31273bd2'::uuid, 'Emulator Support'::text, 'Implement emulator support for testing applications across different device configurations and environments without requiring physical hardware'::text, 'Raphael'::text, 'Research emulator options (Android, iOS, embedded). Consider cloud-based vs local emulation.'::text, 'High'::text, 'To Do'::text, '2025-11-27'::date),
    ('c40490fe-9675-4ed3-b69c-cae7a7f28602'::uuid, 'CGA Accessing Plan Details with @kavia Tag'::text, 'Enable CGA to access plan details using @kavia tags (e.g., @kavia-epic) to retrieve and display epics, stories, and related work items as context for implementation, documentation, or testing'::text, 'Anjan and Prashant'::text, 'Requires robust work item parsing and context injection. Ensure API integration with project management tools (Jira, Azure DevOps).'::text, 'Medium'::text, 'To Do'::text, '2025-12-04'::date),
    ('c02a74bb-abf0-4176-b61b-babda11c9ec5'::uuid, 'Chat Planning Micro Agents'::text, 'Implement micro-agents for tracing and navigating through planning phase updates, providing clear visibility into plan evolution and changes'::text, 'Anjan / Labeeb'::text, 'Requires agent orchestration framework. Consider visualization of agent interactions and decision paths.'::text, 'Medium'::text, 'To Do'::text, '2025-12-11'::date),
    ('80195bb3-1235-4954-8498-7a19df597b03'::uuid, 'SAM Feature Extraction'::text, 'Enabling Features to be extracted from the Codebase through SAM Structure'::text, 'Labeeb , Sasindu'::text, 'Any extra notes for the team'::text, 'High'::text, 'In Progress'::text, '2025-12-04'::date),
    ('584b4f4d-c064-40e6-9980-c1d4eac505ce'::uuid, 'Legacy Modernization'::text, 'Code and Document based Planning - After Plan, modernize code based on work items and current code base correctly'::text, 'Labeeb'::text, 'Build'::text, 'Medium'::text, 'To Do'::text, '2025-09-30'::date),
    ('3e8481b7-47bd-46d6-b895-f571b456a417'::uuid, 'Wireframes from prompt'::text, 'Design from prompt'::text, NULL::text, 'Code Maintenance'::text, 'Medium'::text, 'To Do'::text, '2025-08-31'::date),
    ('979ceba4-27f4-4d5a-893c-ea547723299a'::uuid, 'Bug Report Integration'::text, 'A floating button that allows users to capture the current screen, annotate, and submit a bug report with optional voice recording. Includes screenshot capture, drawing tools, and voice-to-text conversion.'::text, 'Niku Singh'::text, 'Needs screen capture API, canvas-based annotation tools, audio recording permissions, and integration with ticketing system (Jira/Linear).'::text, 'Medium'::text, 'To Do'::text, '2024-01-31'::date),
    ('77c3e22e-b667-4918-9492-7d5915b19139'::uuid, 'Model Configuration'::text, 'LLM Model restriction and selection for tenant-wise configuration. Allows organizations to control which models are available to different user groups with cost and compliance controls.'::text, 'Jay and Prashant'::text, 'Tenant isolation, model access controls, usage quotas, cost tracking, and audit logging. Integration with multiple LLM providers and fallback mechanisms.'::text, 'High'::text, 'To Do'::text, '2024-01-31'::date),
    ('78beb19f-e9ea-4c18-8169-fce95cd41172'::uuid, 'On-Demand Integration Connectors (Free Tier)'::text, 'Provide on-demand integration connectors for enterprise tools like Dynatrace, Splunk, Confluence, and other monitoring/collaboration platforms, offered free for the first 100 customers'::text, NULL::text, 'Enterprise Onboarding Strategy'::text, 'Medium'::text, 'To Do'::text, '2025-09-30'::date),
    ('c049a389-e781-4ca2-ba3f-9a47b4527ffb'::uuid, 'User Behaviour Tracking'::text, 'Enable Integrations to check the click through and heatmap of Kavia Usage'::text, 'Babu K'::text, 'Generic'::text, 'High'::text, 'To do'::text, '2025-08-21'::date),
    ('d6fa481b-646e-4bbb-ae39-5997e88f2017'::uuid, 'Test Code Generation and Execution'::text, 'Automated test code generation with execution capabilities.'::text, 'Niku Singh'::text, 'Code Generation and Maintenance (BUILD)'::text, 'High'::text, 'In Progress'::text, '2025-08-21'::date)
  ) AS t(id, feature, description, assignee, notes, priority, status, due_date)
),
cards_with_column AS (
  SELECT
    cr.*,
    COALESCE(
      (SELECT column_title FROM status_map sm WHERE sm.status_key = lower(trim(cr.status))),
      CASE
        WHEN lower(trim(cr.status)) = 'to do' THEN 'To Do'
        WHEN lower(trim(cr.status)) = 'to do' THEN 'To Do'
        WHEN lower(trim(cr.status)) = 'in progress' THEN 'In Progress'
        WHEN lower(trim(cr.status)) = 'done' THEN 'Done'
        ELSE 'To Do'
      END
    ) AS column_title
  FROM cards_raw cr
),
cards_positioned AS (
  SELECT
    cwc.*,
    kc.id AS column_id,
    row_number() OVER (
      PARTITION BY cwc.column_title
      ORDER BY cwc.due_date NULLS LAST, cwc.feature, cwc.id
    )::int AS position
  FROM cards_with_column cwc
  JOIN public.kanban_columns kc
    ON kc.title = cwc.column_title
)
INSERT INTO public.kanban_cards
  (id, column_id, feature, description, assignee, notes, priority, status, due_date, position)
SELECT
  id,
  column_id,
  feature,
  description,
  assignee,
  notes,
  priority,
  status,
  due_date,
  position
FROM cards_positioned
ON CONFLICT (id) DO UPDATE
SET
  column_id = EXCLUDED.column_id,
  feature = EXCLUDED.feature,
  description = EXCLUDED.description,
  assignee = EXCLUDED.assignee,
  notes = EXCLUDED.notes,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  due_date = EXCLUDED.due_date,
  position = EXCLUDED.position,
  updated_at = now();

COMMIT;
