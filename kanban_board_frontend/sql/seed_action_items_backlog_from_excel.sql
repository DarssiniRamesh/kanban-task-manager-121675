-- Seed script generated from: attachments/Action_Items_and_Next_steps_1.xlsx (Sheet1)
-- Target table: public.kanban_cards
-- Requirement: map ALL inserted cards to the Backlog column (column_id resolved/backfilled accordingly).
-- Notes:
--  - This script assumes a row exists in public.kanban_columns with name = 'Backlog'.
--  - If your schema uses a different identifier (e.g., title), update the lookup accordingly.
--  - Uses a single INSERT..SELECT with a VALUES list to avoid per-row manual UUID handling.
--  - Sets "position" sequentially in the order of the Excel S. No.

BEGIN;

-- Resolve Backlog column id (hard fail if not found)
WITH backlog AS (
  SELECT id
  FROM public.kanban_columns
  WHERE name = 'Backlog'
  LIMIT 1
),
src AS (
  SELECT
    v.s_no,
    v.feature,
    v.description,
    v.requested_by,
    v.planned_release,
    v.status,
    v.priority,
    v.assignee,
    v.timeline,
    v.issues,
    v.notes
  FROM (VALUES
    (1,  'Figma to Code (Absent in Chat)', 'Generate code directly from Figma design files', 'Customer', 'Chat 1.1 ', 'Delayed', 'Critical', 'Nadarajan GS', NULL, NULL, NULL),
    (2,  'UI/UX Usability Improvements in CGA', 'Streamline and simplify the CGA interface for daily developer use', 'Internal', 'Chat 1.1', 'In Progress', 'Critical', 'Saiful Islam', NULL, NULL, NULL),
    (3,  'DevVM Integration', 'Build and run applications directly on developer virtual machines', 'Customer', NULL, 'Delayed', 'Critical', 'Raphael Marchetti', NULL, NULL, NULL),
    (4,  'Git Improvements and Session Management ', '"Git improvements to ease the cloning, session and git based process for repos"', 'Internal', 'Chat 1.1', 'In Progress', 'Critical', 'Anjan Ravishankar', NULL, NULL, NULL),
    (5,  'Code Review Agent ', 'CGA enabled Code Review Agent that review and creates a PR', 'Internal', 'Chat 1.2', 'To Do', 'Critical', 'Allandhir Megharaj', NULL, NULL, '"Trigger Code review at any point for the branch currently in - to fix issues, security issues and PR generation etc.."'),
    (6,  'Plan Sync with Chat (Deep Planner)', 'Two-way sync between Plan phase artefacts and Chat/CGA workflows', 'Internal', 'Chat 1.2', 'Planned', 'Critical', 'Labeeb Ismail', NULL, NULL, NULL),
    (7,  'MongoDB Connection Optimisation', 'Centralise MongoDB initialisation to reduce connection overhead', 'Internal', NULL, 'Planned', 'Critical', NULL, NULL, NULL, NULL),
    (8,  'Enable New Chat within Session', '"When a task is going on, if user wants to chat about something (Plan something or Q&A), could we enable + tag to start new chat in parallel within session which is only for planning, Documenting, Q&A, help - not Code writing or Bug fix agent. Multi-tasking can be enabled during long complex scenarios "', NULL, NULL, NULL, NULL, 'Raphael Marchetti', NULL, NULL, NULL),
    (9,  'File Tagging Feature', 'Enable to tag files in the chat during CGA for referencing accurately', NULL, NULL, NULL, NULL, 'Raphael Marchetti', NULL, NULL, NULL),
    (10, 'Onboarding Flow (Pilots & Tenants)', 'Guided onboarding for enterprise pilots and tenants ', 'Internal', 'Chat 1.1', 'In Progress', 'High', 'Sasindu Fernando', '—', 'Yes', 'Saiful''s Onboarding flow to be brought in'),
    (11, 'Plan with Guided Setup', 'Structured guided setup for the Plan phase', 'Internal', 'Chat 1.1', 'In Progress', 'High', 'jay g', 'Current Cycle', 'Yes', 'Resolving Issues'),
    (12, 'SCM Ingestion - GitLab, Gerrit, Bitbucket, GitLab Cloud', 'Enable all the Git commands and flow for all SCMs', 'Customer', 'Chat 1.1', 'In Progress', 'High', 'Kathan p', 'Current Cycle', NULL, NULL),
    (13, 'Public Repo Ingestion', 'Ingest and query public open-source repositories', 'Customer', 'Chat 1.1', 'In Progress', 'High', 'Kathan p', 'Current Cycle', NULL, 'Issue with Public repo '),
    (14, 'Manifest Ingestion ', 'To Ingest Repos with huge codebases ', 'Customer', 'Chat 1.1', 'In Progress', 'High', 'Veera Patel', 'Current Cycle', NULL, NULL),
    (15, 'CodeWiki', 'Extract and present features/knowledge from codebase via SAM structure', 'Internal', 'Chat 1.1', 'Done', 'High', 'Nadarajan GS', 'Current Cycle', NULL, NULL),
    (16, 'VSCode Extension & CLI', 'VSCode extension', 'Customer', 'Chat 1.2', 'In Progress', 'High', 'Johnny Torres Saiful Islam', 'Current Cycle', NULL, 'UI was discussed with Saiful for further tweaks and changes 
Pending CLI and UI updates '),
    (17, 'K-Diff', 'Improved diff viewing for code changes and PR reviews', 'Internal', 'Chat 1.0.9', 'In Progress', 'High', 'Kathan p', 'Current Cycle', NULL, 'For large codebases Diff creation is creating problems'),
    (18, 'Azure DevOps Integration', 'Integrate Azure DevOps as SCM and project management source', 'Customer', 'Chat 1.1', 'Delayed', 'High', 'Kathan p', 'Current Cycle', NULL, NULL),
    (19, 'Custom Pilot & Invoicing with Multi Admin', 'Enterprise pilot setup with billing and multi-admin controls', 'Customer', 'Chat 1.1', 'In Progress', 'High', 'Niku Singh', NULL, NULL, NULL),
    (20, 'MCP Integration ', 'Model Context Protocol integration for external tool connections', 'Customer', 'Chat 1.1', 'Delayed', 'High', 'Allandhir Megharaj', NULL, NULL, NULL),
    (21, 'Workspace / Organisation Management', 'Enable organisation switching without logout; single user ID across tenants', 'Internal', 'Chat 1.1', 'In Progress', 'High', 'Nadarajan GS', NULL, NULL, NULL),
    (22, 'Roadmap Feature with JIRA Linking', 'Create and link to JIRA tickets; view epics/stories inside KAVIA', 'Customer', 'Chat 1.2', 'In Progress', 'High', NULL, NULL, NULL, NULL),
    (23, 'PostHog Integration', '"Session tracking, bug detection, user analytics and Slack error alerts"', 'Internal', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (24, 'Prompt Saving and Generation', 'Context-aware dynamic prompt saving for future use', 'Customer (Tata)', NULL, 'Planned', 'High', 'Anjan Ravishankar', NULL, NULL, NULL),
    (25, 'Bug Report Integration', '"Floating bug report button with screenshot, annotation and voice recording"', 'Internal', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (26, 'Role-Based Access & Private Projects', 'Role-based access control with private project option within tenants', 'Customer (Demo calls)', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (27, 'LLM Quality Feedback (Implicit & Explicit)', '"Thumbs up/down feedback + click tracking, heatmaps with tenant opt-out"', 'Customer (Demo calls)', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (28, 'Customer Dashboard', '"External-facing dashboard with session usage, LOC, PRs, feature breakdown"', 'Customer', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (29, 'Multiple Chat Sessions (Same Branch)', 'Allow developers to open multiple chat sessions within the same branch', 'Customer (DigitalT3)', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (30, 'Commit / Rollback / Diff Improvements', '"Better PR diff view, rollback controls, and commit management"', 'Internal', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (31, 'Remote Local Executor (RLE)', 'Run KAVIA workflows locally without full web interaction', 'Customer', NULL, 'Planned', 'High', NULL, NULL, NULL, NULL),
    (32, 'Non-Tech Projects Enabling', 'Support planning and documentation for non-engineering use cases', 'Internal', 'Chat 1.1', 'In Progress', 'Medium', 'Nadarajan GS', NULL, NULL, NULL),
    (33, 'Data Model Configuration', 'Allow configurable data models for planning and requirement management', 'Internal', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL),
    (34, 'Disable Internet Search Tools', 'Configure via settings to restrict LLM from using internet search', 'Customer', NULL, 'Planned', 'Medium', 'Anjan Ravishankar', NULL, NULL, NULL),
    (35, 'CodeWiki Annotation, Sharing & Sync', '"Annotate, share and sync CodeWiki entries across teams"', 'Internal', NULL, 'Planned', 'Medium', 'Nadarajan GS', NULL, NULL, NULL),
    (36, 'Customer Data Insights & Issue Reproduction', 'Click tracking and session replay for issue reproduction', 'Internal', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL),
    (37, 'Open Source Automatics MCP Integration', 'Automated MCP connections for open-source tooling', 'Customer', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL),
    (38, 'Bug Integration Tool', 'Communicate bug fix estimated timelines to customers', 'Internal', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL),
    (39, 'B2C Chat Flow', 'Self-service chat-first flow for individual/B2C users', 'Internal', NULL, 'Planned', 'Low', NULL, NULL, NULL, NULL),
    (40, 'Tenant Collaboration', 'Collaboration between users within the same tenant', 'Internal', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL),
    (41, 'Template / Skill Submission Flow', 'Template-based skill creation for project planning and CGA', 'Internal', NULL, 'Planned', 'Medium', NULL, NULL, NULL, NULL)
  ) AS v(
    s_no,
    feature,
    description,
    requested_by,
    planned_release,
    status,
    priority,
    assignee,
    timeline,
    issues,
    notes
  )
)
INSERT INTO public.kanban_cards (
  column_id,
  feature,
  description,
  assignee,
  notes,
  priority,
  status,
  due_date,
  position
)
SELECT
  (SELECT id FROM backlog) AS column_id,
  src.feature,
  src.description,
  NULLIF(BTRIM(src.assignee), '') AS assignee,
  NULLIF(BTRIM(
    CONCAT_WS(
      E'\n',
      NULLIF(BTRIM(src.requested_by), '')::text,
      NULLIF(BTRIM(src.planned_release), '')::text,
      NULLIF(BTRIM(src.timeline), '')::text,
      NULLIF(BTRIM(src.issues), '')::text,
      NULLIF(BTRIM(src.notes), '')::text
    )
  ), '') AS notes,
  NULLIF(BTRIM(src.priority), '') AS priority,
  NULLIF(BTRIM(src.status), '') AS status,
  NULL::date AS due_date,
  src.s_no AS position
FROM src
WHERE EXISTS (SELECT 1 FROM backlog);

-- Optional safety check: ensure Backlog existed; if not, raise an exception (keeps behavior explicit).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kanban_columns WHERE name = 'Backlog') THEN
    RAISE EXCEPTION 'Backlog column not found in public.kanban_columns (name = %)', 'Backlog';
  END IF;
END $$;

COMMIT;
