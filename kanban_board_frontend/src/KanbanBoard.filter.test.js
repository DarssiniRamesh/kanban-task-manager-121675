import { describe, it, expect } from "@jest/globals";

/* Copied from src/KanbanBoard.js for test:
   Kept inline to avoid cross-test coupling with React component imports. */
function filterCardsAND(cards, filters, columns) {
  return cards.filter(c => {
    // CR-only (Customer Requested)
    if (filters.crOnly && c.customer_requested !== true) return false;

    if (
      filters.assignees &&
      filters.assignees.length > 0 &&
      (!c.assignee || !filters.assignees.includes(c.assignee))
    ) return false;
    if (
      filters.priorities &&
      filters.priorities.length > 0 &&
      (!c.priority || !filters.priorities.includes(c.priority))
    ) return false;
    if (
      filters.statuses &&
      filters.statuses.length > 0 &&
      (!c.status || !filters.statuses.includes(c.status))
    ) return false;
    if (
      filters.columns &&
      filters.columns.length > 0 &&
      (!c.column_id || !filters.columns.includes(c.column_id))
    ) return false;
    if (filters.dueFrom || filters.dueTo) {
      if (!c.due_date) return false;
      if (filters.dueFrom && c.due_date < filters.dueFrom) return false;
      if (filters.dueTo && c.due_date > filters.dueTo) return false;
    }
    return true;
  });
}

describe("filterCardsAND intersection logic", () => {
  const now = "2024-04-22";
  const cards = [
    { id: 1, assignee: "Alice", priority: "High", status: "To Do", column_id: "c1", due_date: "2024-04-25", customer_requested: true },
    { id: 2, assignee: "Bob", priority: "Low", status: "Done", column_id: "c2", due_date: "2024-04-27", customer_requested: false },
    { id: 3, assignee: "Bob", priority: "High", status: "Review", column_id: "c2", due_date: "2024-05-01", customer_requested: true },
    { id: 4, assignee: "Alice", priority: "Medium", status: "In Progress", column_id: "c1", due_date: "2024-04-24" }, // missing customer_requested
    { id: 5, assignee: "Charlie", priority: "Medium", status: "To Do", column_id: "c1", due_date: "2024-05-05", customer_requested: true },
    { id: 6, assignee: "Bob", priority: "Critical", status: "To Do", column_id: "c1", due_date: "2024-04-30", customer_requested: false },
  ];
  const columns = [
    { id: "c1", title: "Col 1" },
    { id: "c2", title: "Col 2" },
  ];

  it("returns all cards when no filters applied", () => {
    const filters = { assignees: [], priorities: [], statuses: [], columns: [], dueFrom: "", dueTo: "", crOnly: false };
    expect(filterCardsAND(cards, filters, columns)).toHaveLength(cards.length);
  });

  it("filters to only customer requested cards when crOnly is enabled", () => {
    const filters = { assignees: [], priorities: [], statuses: [], columns: [], dueFrom: "", dueTo: "", crOnly: true };
    const result = filterCardsAND(cards, filters, columns);
    expect(result.map(c => c.id).sort()).toEqual([1, 3, 5].sort());
  });

  it("ANDs multiple assignees (should work as OR for same field)", () => {
    const filters = { assignees: ["Alice", "Bob"], priorities: [], statuses: [], columns: [], dueFrom: "", dueTo: "", crOnly: false };
    const result = filterCardsAND(cards, filters, columns);
    expect(result.map(c => c.id).sort()).toEqual([1,2,3,4,6].sort());
  });

  it("ANDs across fields (assignee, priority)", () => {
    const filters = { assignees: ["Alice"], priorities: ["High","Medium"], statuses: [], columns: [], dueFrom: "", dueTo: "", crOnly: false };
    // Only Alice + priority High or Medium: cards 1, 4
    const result = filterCardsAND(cards, filters, columns);
    expect(result.map(c => c.id).sort()).toEqual([1,4]);
  });

  it("ANDs with CR-only toggle", () => {
    const filters = { assignees: ["Alice"], priorities: [], statuses: [], columns: [], dueFrom: "", dueTo: "", crOnly: true };
    // Alice cards are 1 and 4, but 4 is missing customer_requested => filtered out
    const result = filterCardsAND(cards, filters, columns);
    expect(result.map(c => c.id)).toEqual([1]);
  });

  it("returns intersection of all selected filters (cards matching ALL active)", () => {
    const filters = {
      assignees: ["Bob"],
      priorities: ["High"],
      statuses: ["Review"],
      columns: ["c2"],
      dueFrom: "2024-04-30",
      dueTo: "2024-05-02",
      crOnly: false,
    };
    // Only card 3 matches
    const result = filterCardsAND(cards, filters, columns);
    expect(result.map(c => c.id)).toEqual([3]);
  });

  it("filters by due date lower, upper, both", () => {
    const lower = { assignees: [], priorities: [], statuses: [], columns: [], dueFrom: "2024-04-28", dueTo: "", crOnly: false };
    expect(filterCardsAND(cards, lower, columns).map(c=>c.id).sort()).toEqual([3,5,6].sort());

    const upper = { assignees: [], priorities: [], statuses: [], columns: [], dueFrom: "", dueTo: "2024-04-27", crOnly: false };
    expect(filterCardsAND(cards, upper, columns).map(c=>c.id).sort()).toEqual([1,2,4].sort());

    const both = { assignees: [], priorities: [], statuses: [], columns: [], dueFrom: "2024-04-27", dueTo: "2024-05-01", crOnly: false };
    expect(filterCardsAND(cards, both, columns).map(c=>c.id).sort()).toEqual([3,6]);
  });

  it("returns empty when no card matches all filters", () => {
    const filters = { assignees: ["Alice"], priorities: ["Critical"], statuses: [], columns: ["c2"], dueFrom: "", dueTo: "", crOnly: false };
    const result = filterCardsAND(cards, filters, columns);
    expect(result).toHaveLength(0);
  });
});
