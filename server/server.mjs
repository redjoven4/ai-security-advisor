/* =====================================================================
   V1 — SMALL LOCAL SERVER  (server/server.mjs)
   ---------------------------------------------------------------------
   Why a server at all? The AI API key must stay secret, so the browser
   can't call the AI directly. This server:

     - serves the existing frontend files (index.html, style.css, ...)
     - receives   POST /api/analyse  { message, background }
     - asks the AI service (ai-service.mjs) and returns the result

   Start it with:  npm start   then open http://localhost:8080
   ===================================================================== */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load secrets from .env (never commit that file).
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // no .env file — the AI will report that it isn't configured
}

const { analyse, aiConfigured, AnalysisError, AI_PROVIDER, MODEL, PROMPT_VERSION, MAX_MESSAGE_CHARS, MAX_BACKGROUND_CHARS } = await import("./ai-service.mjs");
const db = await import("./db.mjs");
const { applySafetyFloor } = await import("./safety-floor.mjs"); // V2

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "127.0.0.1";

// Only these files are ever served — never .env, server code or node_modules.
const PUBLIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/style.css": "style.css",
  "/script.js": "script.js",
  "/storage.js": "storage.js",
  "/v0/": "v0/index.html",
  "/v0/index.html": "v0/index.html",
  "/v0/style.css": "v0/style.css",
  "/v0/script.js": "v0/script.js",
};
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

// Simple protection against accidental floods of paid AI requests.
const RATE_LIMIT_PER_MINUTE = 20;
const recentRequests = new Map(); // ip → timestamps
function rateLimited(ip) {
  const now = Date.now();
  const list = (recentRequests.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  recentRequests.set(ip, list);
  return list.length > RATE_LIMIT_PER_MINUTE;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

// Read a JSON request body (max 20 KB).
function readJson(req, maxBytes = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new AnalysisError(413, "The message is too long."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new AnalysisError(400, "The request could not be read."));
      }
    });
    req.on("error", reject);
  });
}

/* ---------- POST /api/analyse ---------- */
async function handleAnalyse(req, res) {
  const started = Date.now();
  try {
    if (rateLimited(req.socket.remoteAddress)) throw new AnalysisError(429, "Too many analyses in a short time. Please wait a minute.");

    const body = await readJson(req, 12_000_000); // allows an attached screenshot
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const background = typeof body.background === "string" ? body.background.trim() : "";

    // V2: optional screenshot (PNG/JPG/WebP data URL). It is analysed, never saved.
    let image = null;
    if (body.image) {
      const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
      if (!match) throw new AnalysisError(400, "Please choose a PNG, JPG or WebP screenshot.", "bad image data URL", "Image payload rejected");
      image = match[2];
    }

    // Same validation rule as the frontend
    if (!message && !image) throw new AnalysisError(400, "Please enter a message or attach a screenshot.");
    if (message.length > MAX_MESSAGE_CHARS) throw new AnalysisError(400, `Please keep the message under ${MAX_MESSAGE_CHARS} characters.`);
    if (background.length > MAX_BACKGROUND_CHARS) throw new AnalysisError(400, `Please keep the background under ${MAX_BACKGROUND_CHARS} characters.`);

    // V2: the AI decides, then the V0 rules can only RAISE a risky request to "Do not follow"
    const analysed = await analyse(message, background, image);
    // The safety floor also checks the words the model read in a screenshot
    const shownText = analysed.screenshotText ? `${message}\n${analysed.screenshotText}` : message;
    const result = applySafetyFloor(analysed, shownText, background);
    result.responseMs = Date.now() - started; // shown in Testing Mode
    await db.saveAnalysis({ timestamp: new Date().toISOString(), message, background, result });

    console.log(`[analyse] ${result.decision} via ${result.model} in ${Date.now() - started}ms`);
    sendJson(res, 200, { result });
  } catch (error) {
    if (error instanceof AnalysisError) {
      console.warn(`[analyse] failed (${error.status}): ${error.logDetail}`);
      sendJson(res, error.status, { error: error.message, reason: error.reason }); // reason: Testing Mode only
    } else {
      console.error("[analyse] unexpected error:", error);
      sendJson(res, 500, { error: "Something went wrong on the server. Please try again." });
    }
  }
}

/* ---------- /api/history (ready for your database) ---------- */
async function handleHistory(req, res) {
  if (req.method === "GET") {
    const items = await db.listAnalyses();
    return items === null ? sendJson(res, 501, { error: "No database configured." }) : sendJson(res, 200, { items });
  }
  if (req.method === "DELETE") {
    const done = await db.clearAnalyses();
    return done ? sendJson(res, 200, { ok: true }) : sendJson(res, 501, { error: "No database configured." });
  }
  sendJson(res, 405, { error: "Method not allowed." });
}

/* ---------- Static files ---------- */
async function serveFile(res, relativePath) {
  try {
    const data = await fs.readFile(path.join(ROOT, relativePath));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(relativePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/analyse") {
    return req.method === "POST" ? handleAnalyse(req, res) : sendJson(res, 405, { error: "Use POST." });
  }
  if (url.pathname === "/api/history") return handleHistory(req, res);
  if (url.pathname === "/api/health") {
    // Says WHETHER a key is set — never the key itself.
    return sendJson(res, 200, { ok: true, version: "V2", provider: AI_PROVIDER, aiConfigured: aiConfigured(), model: MODEL, promptVersion: PROMPT_VERSION, database: db.databaseConfigured() });
  }
  if (url.pathname === "/v0") return res.writeHead(301, { Location: "/v0/" }).end();

  const file = PUBLIC_FILES[url.pathname];
  if (req.method === "GET" && file) return serveFile(res, file);
  res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Security Message Adviser V1 running at http://localhost:${PORT}`);
  console.log(`V0 baseline available at   http://localhost:${PORT}/v0/`);
  console.log(`AI engine: ${AI_PROVIDER} (${MODEL})`);
  if (!aiConfigured()) console.warn("Warning: ANTHROPIC_API_KEY is not set — add it to .env to enable AI analysis.");
});
