/* =====================================================================
   V1 — HISTORY STORAGE LAYER  (storage.js)
   ---------------------------------------------------------------------
   The UI saves and clears history ONLY through HistoryStorage, so the
   place history is kept can change without touching the UI code.

   Active now:  memoryAdapter  — same as V0: kept for this session only,
                                 gone when the page is refreshed.
   Ready later: databaseAdapter — talks to /api/history on the server
                                 once you connect a database (server/db.mjs).

   To switch, change ACTIVE_ADAPTER below.
   ===================================================================== */

// Keeps analyses in memory (behaviour identical to V0).
const memoryAdapter = {
  name: "memory",
  items: [],
  async save(entry) {
    this.items.push(entry);
  },
  async list() {
    return [...this.items];
  },
  async clear() {
    this.items.length = 0;
  },
};

// For later: uses the server's database endpoints.
// (The server already saves each AI analysis via server/db.js.)
const databaseAdapter = {
  name: "database",
  async save() {
    // Nothing to do here: the server saves each analysis when it creates it.
  },
  async list() {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error("Could not load history from the database.");
    return (await res.json()).items;
  },
  async clear() {
    const res = await fetch("/api/history", { method: "DELETE" });
    if (!res.ok) throw new Error("Could not clear the database history.");
  },
};

const ACTIVE_ADAPTER = memoryAdapter;

// The only object the UI uses.
const HistoryStorage = {
  adapter: ACTIVE_ADAPTER.name,
  save: (entry) => ACTIVE_ADAPTER.save(entry),
  list: () => ACTIVE_ADAPTER.list(),
  clear: () => ACTIVE_ADAPTER.clear(),
};
