import React, { useMemo, useState } from "react";
import { useKanban } from "../KanbanContext";
import "./FilterPanel.css";
import {
  Checkbox,
  Chip,
  Box,
  useTheme,
  Autocomplete,
  TextField,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import FlagIcon from "@mui/icons-material/Flag";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import InsightsIcon from "@mui/icons-material/Insights";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import CategoryIcon from "@mui/icons-material/Category";
import SpeedIcon from "@mui/icons-material/Speed";

// Helper: get unique field values for multi-selects
function getUniqueFieldValues(cards, field) {
  return Array.from(
    new Set(cards.map((c) => (c[field] || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

// PUBLIC_INTERFACE
/**
 * Minimal, modern, MUI-powered filter panel for Kanban board.
 * Adds filtering for: assignees, priorities, statuses, columns, due date range,
 * impact, market_need, category, and estimated_effort (range).
 */
export default function FilterPanel({ onFiltersChange }) {
  const { cards, columns } = useKanban();
  const theme = useTheme();

  // Filter state
  const [filters, setFilters] = useState({
    assignees: [],
    statuses: [],
    priorities: [],
    columns: [],
    impact: [],
    market_need: [],
    category: [],
    estimatedEffortMin: "",
    estimatedEffortMax: "",
    dueFrom: "",
    dueTo: "",
  });

  React.useEffect(() => {
    if (onFiltersChange) onFiltersChange(filters);
    // eslint-disable-next-line
  }, [filters]);

  // Build options from cards (dynamic fields)
  const assigneeOptions = useMemo(
    () => getUniqueFieldValues(cards, "assignee"),
    [cards]
  );
  const priorityOptions = useMemo(
    () => getUniqueFieldValues(cards, "priority"),
    [cards]
  );
  const statusOptions = useMemo(
    () => getUniqueFieldValues(cards, "status"),
    [cards]
  );
  const columnOptions = useMemo(
    () => columns.map((col) => ({ id: col.id, title: col.title })),
    [columns]
  );

  // Fixed option sets (accurate values) for new fields
  const impactOptions = [
    "High Impact - Low Effort",
    "High Effort - Low Impact",
    "High Effort - High Impact",
    "Low Effort - Low Impact",
  ];
  const marketNeedOptions = ["Demand", "USP", "Usability", "Nice to Have"];
  const categoryOptions = ["Feature", "Enhancement", "Feedback"];

  function handleAutocompleteChange(field, options) {
    setFilters((prev) => ({
      ...prev,
      [field]: options,
    }));
  }

  function clearFilter(field) {
    const isDate = ["dueFrom", "dueTo"].includes(field);
    const isEffort = ["estimatedEffortMin", "estimatedEffortMax"].includes(field);
    setFilters((prev) =>
      isDate || isEffort
        ? { ...prev, [field]: "" }
        : { ...prev, [field]: [] }
    );
  }

  function resetFilters() {
    setFilters({
      assignees: [],
      priorities: [],
      statuses: [],
      columns: [],
      impact: [],
      market_need: [],
      category: [],
      estimatedEffortMin: "",
      estimatedEffortMax: "",
      dueFrom: "",
      dueTo: "",
    });
  }

  function handleDateChange(type, val) {
    setFilters((prev) => ({ ...prev, [type]: val }));
  }

  function handleEffortChange(type, val) {
    // Store empty string if invalid/empty, else numeric string for comparison in board
    if (val === "" || val === null || Number.isNaN(Number(val))) {
      setFilters((prev) => ({ ...prev, [type]: "" }));
    } else {
      setFilters((prev) => ({ ...prev, [type]: String(Math.max(0, Number(val))) }));
    }
  }

  // Render active filter chips
  function renderActiveChips() {
    const chips = [];
    filters.assignees.forEach((a) =>
      chips.push({ label: a, field: "assignees", value: a })
    );
    filters.priorities.forEach((p) =>
      chips.push({ label: p, field: "priorities", value: p })
    );
    filters.statuses.forEach((s) =>
      chips.push({ label: s, field: "statuses", value: s })
    );
    filters.columns.forEach((colId) => {
      const col = columnOptions.find((c) => c.id === colId);
      chips.push({
        label: col ? col.title : colId,
        field: "columns",
        value: colId,
      });
    });

    // New fields
    filters.impact.forEach((v) =>
      chips.push({ label: v, field: "impact", value: v })
    );
    filters.market_need.forEach((v) =>
      chips.push({ label: v, field: "market_need", value: v })
    );
    filters.category.forEach((v) =>
      chips.push({ label: v, field: "category", value: v })
    );

    if (filters.estimatedEffortMin !== "" && filters.estimatedEffortMin !== null)
      chips.push({
        label: `Effort ≥ ${filters.estimatedEffortMin}`,
        field: "estimatedEffortMin",
      });
    if (filters.estimatedEffortMax !== "" && filters.estimatedEffortMax !== null)
      chips.push({
        label: `Effort ≤ ${filters.estimatedEffortMax}`,
        field: "estimatedEffortMax",
      });

    if (filters.dueFrom)
      chips.push({ label: `Due ≥ ${filters.dueFrom}`, field: "dueFrom" });
    if (filters.dueTo)
      chips.push({ label: `Due ≤ ${filters.dueTo}`, field: "dueTo" });

    return chips;
  }

  // MUI Autocomplete for searchable, taggable drop-downs (assignee, etc)
  function MultiAutocomplete(field, options, label, icon, placeholder) {
    return (
      <Autocomplete
        sx={{
          minWidth: 115,
          maxWidth: 220,
          "& .MuiInputBase-root": {
            bgcolor: "var(--input-bg, #232945)",
            borderRadius: "10px",
          },
        }}
        multiple
        disableCloseOnSelect
        options={options}
        value={filters[field]}
        onChange={(_, val) => handleAutocompleteChange(field, val)}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              size="small"
              variant="filled"
              sx={{
                bgcolor: "var(--color-bg-chip, #21384d)",
                color: "var(--color-chip-text, #ebfdff)",
                fontWeight: 600,
                fontSize: ".97em",
              }}
              label={typeof option === "string" ? option : option.title || ""}
              {...getTagProps({ index })}
              key={typeof option === "string" ? option : option.id}
            />
          ))
        }
        renderOption={(props, option, { selected }) => {
          const optLabel = typeof option === "string" ? option : option.title;
          const optKey = typeof option === "string" ? option : option.id;
          return (
            <li {...props} key={optKey}>
              <Checkbox
                style={{ marginRight: 8 }}
                checked={selected}
                size="small"
                color="primary"
              />
              {optLabel}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            size="small"
            placeholder={placeholder}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ mr: 0.7, mt: "2px", color: "var(--primary,#38B2AC)" }}>
                  {icon}
                </Box>
              ),
              sx: { bgcolor: "var(--input-bg, #252B38)" },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                px: 0.7,
                py: 0.3,
                background: "var(--input-bg, #212a3b)",
                fontSize: ".97em",
              },
            }}
          />
        )}
        isOptionEqualToValue={(opt, val) =>
          (typeof opt === "string" ? opt : opt.id) ===
          (typeof val === "string" ? val : val.id)
        }
        disableClearable={false}
        clearOnBlur={false}
        noOptionsText="No options"
        popupIcon={null}
      />
    );
  }

  function ColumnMultiAutocomplete() {
    return (
      <Autocomplete
        sx={{
          minWidth: 120,
          maxWidth: 210,
          "& .MuiInputBase-root": {
            bgcolor: "var(--input-bg, #232945)",
            borderRadius: "10px",
          },
        }}
        multiple
        disableCloseOnSelect
        options={columnOptions}
        getOptionLabel={(o) => o.title}
        value={columnOptions.filter((col) => filters.columns.includes(col.id))}
        onChange={(_, selectedCols) =>
          setFilters((prev) => ({
            ...prev,
            columns: selectedCols.map((col) => col.id),
          }))
        }
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              size="small"
              variant="filled"
              sx={{
                bgcolor: "var(--color-bg-chip,#21384d)",
                color: "var(--color-chip-text,#ebfdff)",
                fontWeight: 600,
                fontSize: ".97em",
              }}
              label={option.title}
              {...getTagProps({ index })}
              key={option.id}
            />
          ))
        }
        renderOption={(props, option, { selected }) => (
          <li {...props} key={option.id}>
            <Checkbox
              style={{ marginRight: 8 }}
              checked={selected}
              size="small"
              color="primary"
            />
            {option.title}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            size="small"
            placeholder="Columns"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ mr: 0.5, mt: "1px", color: "var(--primary,#38B2AC)" }}>
                  <ViewColumnIcon fontSize="small" />
                </Box>
              ),
              sx: { bgcolor: "var(--input-bg, #252B38)" },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                px: 0.7,
                py: 0.3,
                background: "var(--input-bg, #212a3b)",
                fontSize: ".97em",
              },
            }}
          />
        )}
        isOptionEqualToValue={(opt, val) => opt.id === val.id}
        disableClearable={false}
        clearOnBlur={false}
        noOptionsText="No columns"
        popupIcon={null}
      />
    );
  }

  // Minimal, visually unified panel layout
  return (
    <section
      className="kanban-filter-panel"
      aria-label="Kanban Filter Panel"
      role="region"
      style={{ padding: "7px 0 3px 0", background: "var(--color-bg-surface,#222937)" }}
    >
      <form
        className="filter-row"
        onSubmit={(e) => e.preventDefault()}
        spellCheck={false}
        autoComplete="off"
        aria-label="Kanban Filters"
        style={{
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          marginBottom: "3px",
          minWidth: 0,
        }}
      >
        {/* ASSIGNEE multi-select */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "assignees",
            assigneeOptions,
            "Assignee(s)",
            <PersonIcon fontSize="small" />,
            "Assignees"
          )}
        </div>
        {/* PRIORITY multi-select */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "priorities",
            priorityOptions,
            "Priority(ies)",
            <FlagIcon fontSize="small" style={{ color: "#ed6644" }} />,
            "Priority"
          )}
        </div>
        {/* STATUS multi-select */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "statuses",
            statusOptions,
            "Status(es)",
            <AssignmentIcon fontSize="small" style={{ color: "#72e0d7" }} />,
            "Status"
          )}
        </div>
        {/* COLUMN multi-select */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {ColumnMultiAutocomplete()}
        </div>

        {/* NEW: IMPACT */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "impact",
            impactOptions,
            "Impact",
            <InsightsIcon fontSize="small" />,
            "Impact"
          )}
        </div>

        {/* NEW: MARKET NEED */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "market_need",
            marketNeedOptions,
            "Market Need",
            <LightbulbOutlinedIcon fontSize="small" />,
            "Market Need"
          )}
        </div>

        {/* NEW: CATEGORY */}
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {MultiAutocomplete(
            "category",
            categoryOptions,
            "Category",
            <CategoryIcon fontSize="small" />,
            "Category"
          )}
        </div>

        {/* NEW: Estimated Effort Range */}
        <div
          style={{
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: 6,
          }}
          aria-label="Estimated Effort range"
        >
          <SpeedIcon fontSize="small" style={{ color: "#ffc48a", marginRight: 2 }} />
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={filters.estimatedEffortMin}
            onChange={(e) => handleEffortChange("estimatedEffortMin", e.target.value)}
            className="filter-date"
            aria-label="Estimated Effort minimum"
            placeholder="Effort min"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)",
            }}
          />
          <span aria-hidden style={{ color: "#888", fontWeight: 400, margin: "0 2px" }}>
            –
          </span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={filters.estimatedEffortMax}
            onChange={(e) => handleEffortChange("estimatedEffortMax", e.target.value)}
            className="filter-date"
            aria-label="Estimated Effort maximum"
            placeholder="Effort max"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)",
            }}
          />
        </div>

        {/* Due Date Range */}
        <div
          style={{
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: 10,
          }}
        >
          <EventIcon fontSize="small" style={{ color: "#c6fa94", marginRight: 2 }} />
          <input
            type="date"
            value={filters.dueFrom}
            onChange={(e) => handleDateChange("dueFrom", e.target.value)}
            className="filter-date"
            aria-label="Due date from"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)",
            }}
          />
          <span aria-hidden style={{ color: "#888", fontWeight: 400, margin: "0 2px" }}>
            –
          </span>
          <input
            type="date"
            value={filters.dueTo}
            onChange={(e) => handleDateChange("dueTo", e.target.value)}
            className="filter-date"
            aria-label="Due date to"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)",
            }}
          />
        </div>

        {/* Reset Button */}
        <button
          type="button"
          className="btn filter-reset-btn"
          aria-label="Reset all filters"
          title="Reset all filter fields to default"
          style={{
            background: "#132944",
            color: "#ff8070",
            fontWeight: 700,
            marginLeft: 9,
            fontSize: ".98em",
            padding: "7px 15px",
            borderRadius: "12px",
          }}
          onClick={resetFilters}
        >
          Reset
        </button>
      </form>

      {/* Render active chips for any field */}
      <div
        className="filter-chipbar"
        role="list"
        aria-label="Active filter list"
        style={{
          margin: "2px 0 0 0",
          gap: "4px",
          minHeight: "18px",
          flexWrap: "wrap",
        }}
      >
        {renderActiveChips().map((chip) => (
          <span
            role="listitem"
            className="filter-chip"
            key={chip.label + String(chip.value)}
            style={{
              fontSize: ".92em",
              padding: "2.7px 9px",
              minHeight: 24,
              background: "var(--chip-bg,#213a4d)",
              color: "var(--color-chip-text,#ebfdff)",
              borderRadius: 13,
              marginRight: 3,
              marginBottom: 3,
            }}
          >
            {chip.label}
            <button
              tabIndex={0}
              type="button"
              title="Remove filter"
              aria-label={`Remove ${chip.label}`}
              onClick={() =>
                chip.value
                  ? setFilters((prev) => ({
                      ...prev,
                      [chip.field]: prev[chip.field].filter((v) => v !== chip.value),
                    }))
                  : clearFilter(chip.field)
              }
              style={{ marginLeft: "4px", fontSize: ".95em", color: "#ef8585" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
