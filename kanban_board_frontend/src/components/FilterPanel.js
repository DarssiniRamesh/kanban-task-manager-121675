import React, { useMemo, useState } from "react";
import { useKanban } from "../KanbanContext";
import "./FilterPanel.css";
import {
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Checkbox,
  ListItemText,
  OutlinedInput,
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

// Helper: get unique field values for multi-selects
function getUniqueFieldValues(cards, field) {
  return Array.from(
    new Set(cards.map((c) => (c[field] || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

// Render MUI chips with minimal style
function renderChips(values, getLabel, onDelete) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.7 }}>
      {values.map((val) => (
        <Chip
          key={val}
          label={getLabel(val)}
          size="small"
          sx={{
            bgcolor: "var(--color-bg-chip, #263949)",
            color: "var(--color-chip-text, #ebfdff)",
            fontWeight: 600,
            m: "1px",
            ".MuiChip-deleteIcon": { color: "#ef8585" },
          }}
          onDelete={onDelete ? () => onDelete(val) : undefined}
        />
      ))}
    </Box>
  );
}

// PUBLIC_INTERFACE
/**
 * Minimal, modern, MUI-powered filter panel for Kanban board.
 * Assignee, Status, Priority, Column filters use <Select multiple> w/ checkboxes, chips for tag display,
 * and searchable typeahead drop-down (MUI Autocomplete).
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
    dueFrom: "",
    dueTo: "",
  });

  React.useEffect(() => {
    if (onFiltersChange) onFiltersChange(filters);
    // eslint-disable-next-line
  }, [filters]);

  // Build options
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

  // Change handlers for filters
  function handleSelectChange(field) {
    return (event) => {
      setFilters((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };
  }

  function handleChipDelete(field, value) {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].filter((v) => v !== value),
    }));
  }

  function handleAutocompleteChange(field, options) {
    setFilters((prev) => ({
      ...prev,
      [field]: options,
    }));
  }

  function clearFilter(field) {
    setFilters((prev) =>
      ["dueFrom", "dueTo"].includes(field)
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
      dueFrom: "",
      dueTo: ""
    });
  }

  function handleDateChange(type, val) {
    setFilters((prev) => ({ ...prev, [type]: val }));
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
      chips.push({ label: col ? col.title : colId, field: "columns", value: colId });
    });
    if (filters.dueFrom)
      chips.push({ label: `Due ≥ ${filters.dueFrom}`, field: "dueFrom" });
    if (filters.dueTo)
      chips.push({ label: `Due ≤ ${filters.dueTo}`, field: "dueTo" });
    return chips;
  }

  // Helpers for getting option label for columns
  const getColumnLabel = (id) =>
    (columnOptions.find((col) => col.id === id) || {}).title || id;

  // Min width + font for minimal, modern look
  const selectSx = {
    minWidth: 86,
    maxWidth: { xs: 150, sm: 200 },
    fontSize: ".98em",
    bgcolor: "var(--input-bg, #222a3b)",
    borderRadius: 1.1,
  };

  // MUI Autocomplete for searchable, taggable drop-downs (assignee, etc)
  // We'll use freeSolo=false for enforced options, and checkboxes for accessibility.
  function MultiAutocomplete(field, options, label, icon, placeholder) {
    return (
      <Autocomplete
        sx={{
          minWidth: 115,
          maxWidth: 200,
          "& .MuiInputBase-root": {
            bgcolor: "var(--input-bg, #232945)",
            borderRadius: "10px"
          }
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
                fontSize: ".97em"
              }}
              label={option}
              {...getTagProps({ index })}
              key={option}
            />
          ))
        }
        renderOption={(props, option, { selected }) => (
          <li {...props} key={option}>
            <Checkbox
              style={{ marginRight: 8 }}
              checked={selected}
              size="small"
              color="primary"
            />
            {option}
          </li>
        )}
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
              sx: { bgcolor: "var(--input-bg, #252B38)" }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                px: 0.7,
                py: 0.3,
                background: "var(--input-bg, #212a3b)",
                fontSize: ".97em",
              }
            }}
          />
        )}
        isOptionEqualToValue={(opt, val) => opt === val}
        disableClearable={false}
        clearOnBlur={false}
        noOptionsText="No options"
        checkboxIcon={<Checkbox color="primary" size="small" />}
        popupIcon={null}
      />
    );
  }

  function ColumnMultiAutocomplete() {
    return (
      <Autocomplete
        sx={{
          minWidth: 120,
          maxWidth: 195,
          "& .MuiInputBase-root": {
            bgcolor: "var(--input-bg, #232945)",
            borderRadius: "10px"
          }
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
                fontSize: ".97em"
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
              sx: { bgcolor: "var(--input-bg, #252B38)" }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                px: 0.7,
                py: 0.3,
                background: "var(--input-bg, #212a3b)",
                fontSize: ".97em",
              }
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
        onSubmit={e => e.preventDefault()}
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
        {/* Due Date Range */}
        <div
          style={{
            minWidth: 0, display: "flex", alignItems: "center", gap: 4,
            marginLeft: 10
          }}
        >
          <EventIcon fontSize="small" style={{ color: "#c6fa94", marginRight: 2 }} />
          <input
            type="date"
            value={filters.dueFrom}
            onChange={e => handleDateChange("dueFrom", e.target.value)}
            className="filter-date"
            aria-label="Due date from"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)"
            }}
          />
          <span aria-hidden style={{ color: "#888", fontWeight: 400, margin: "0 2px" }}>–</span>
          <input
            type="date"
            value={filters.dueTo}
            onChange={e => handleDateChange("dueTo", e.target.value)}
            className="filter-date"
            aria-label="Due date to"
            style={{
              minWidth: 69,
              fontSize: ".93em",
              borderRadius: 8,
              height: 32,
              background: "var(--input-bg,#212a3b)",
              color: "var(--color-text-main,#fff)",
              border: "1.5px solid var(--input-border,#38B2AC)"
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
            borderRadius: "12px"
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
                  ? handleChipDelete(chip.field, chip.value)
                  : clearFilter(chip.field)
              }
              style={{ marginLeft: "4px", fontSize: ".95em", color: "#ef8585" }}
            >×</button>
          </span>
        ))}
      </div>
    </section>
  );
}
