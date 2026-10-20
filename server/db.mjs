/* =====================================================================
   V1 — DATABASE SERVICE LAYER  (server/db.mjs)
   ---------------------------------------------------------------------
   Placeholder for the database you will configure yourself.

   Nothing is stored yet: history still lives in the browser for the
   session only (see storage.js), exactly like V0.

   To connect a database later, fill in these three functions and set
   DATABASE_URL in .env. The rest of the server and the UI do not need
   to change:
     - server.mjs already calls saveAnalysis() after every AI analysis
     - GET/DELETE /api/history already call listAnalyses()/clearAnalyses()
     - storage.js has a matching "database" adapter for the browser
   ===================================================================== */

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Save one finished analysis. `record` = { timestamp, message, background, result }
export async function saveAnalysis(record) {
  if (!databaseConfigured()) return; // no database yet — nothing to do
  // TODO: insert `record` into your database here.
}

// Return saved analyses, newest first.
export async function listAnalyses() {
  if (!databaseConfigured()) return null; // null = "no database configured"
  // TODO: read records from your database here.
  return [];
}

// Delete all saved analyses.
export async function clearAnalyses() {
  if (!databaseConfigured()) return false;
  // TODO: delete records from your database here.
  return true;
}
