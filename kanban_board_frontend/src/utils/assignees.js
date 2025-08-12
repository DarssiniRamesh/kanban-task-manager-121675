 // PUBLIC_INTERFACE
 /**
  * Utility helpers for managing known assignees.
  * - getKnownAssignees(cards): builds a unique, sorted list of assignees from existing cards and persisted storage.
  * - addKnownAssignee(name): persists a new assignee name to localStorage for future suggestions.
  */
 export const ASSIGNEES_STORAGE_KEY = 'kanban-known-assignees';
 
 // PUBLIC_INTERFACE
 export function getKnownAssignees(cards = []) {
   /**
    * Returns all known assignees by merging:
    *  - Unique assignees used in current cards (from state)
    *  - User-added assignees from localStorage persistence
    * Sorted alphabetically (case-insensitive), with falsy/empty values removed.
    */
   const fromCards = Array.from(
     new Set(
       (Array.isArray(cards) ? cards : [])
         .map(c => (c && typeof c.assignee === 'string' ? c.assignee.trim() : ''))
         .filter(Boolean)
     )
   );
 
   let fromStorage = [];
   try {
     const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ASSIGNEES_STORAGE_KEY) : '[]';
     fromStorage = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
   } catch {
     fromStorage = [];
   }
 
   const merged = Array.from(new Set([...fromCards, ...fromStorage].map(v => String(v).trim()).filter(Boolean)));
   // Case-insensitive alphabetical sort
   merged.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
   return merged;
 }
 
 // PUBLIC_INTERFACE
 export function addKnownAssignee(name) {
   /**
    * Adds a new assignee to localStorage if not present.
    * Ignores empty/whitespace-only names.
    */
   const n = (name || '').trim();
   if (!n) return;
   try {
     const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ASSIGNEES_STORAGE_KEY) : '[]';
     const list = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
     if (!list.find(x => String(x).trim().toLowerCase() === n.toLowerCase())) {
       list.push(n);
       localStorage.setItem(ASSIGNEES_STORAGE_KEY, JSON.stringify(list));
     }
   } catch {
     // no-op on storage failure
   }
 }
