# Scout: Security Message Adviser

*Evidence first. Assumptions second.*

In V1 the assistant is called **Scout**. Its logo is an SVG drawn in `index.html` (`<symbol id="scout-logo">`), and its AI instructions are `SYSTEM_PROMPT` in `server/ai-service.mjs` (version shown in Testing Mode).

| Version | What decides | Where |
|---|---|---|
| **V0** | Rule-based baseline (deterministic patterns) | `v0/`: open `v0/index.html` directly, or git tag `v0` |
| **V1** | AI-assisted (local model or Claude), same UI | git tag `v1` |
| **V2** | V1 + a V0 "safety floor" and an advice check | this folder (`dev` branch): needs the small server below |

## V2: what changed from V1, and why
V1 testing (35 cases, local `qwen2.5:3b`) found two problems: the AI sometimes let a risky request through (e.g. "Wanna trade accounts?" got 🟢), and its advice sometimes brought in people the user never mentioned ("check with a friend or family member").
- **Safety floor** (`server/safety-floor.mjs`): after the AI answers, the unchanged V0 rules check the message. If they find a request that is risky in itself (password, code, 2FA, account access or trade, remote access), the decision is raised to ⛔ Do not follow. The floor only ever raises a decision; everything else is the AI's answer. Testing Mode shows "Safety floor: applied" when it happens.
- **Advice check** (`server/ai-service.mjs`): next steps that mention a friend, family, school, coach and so on that the message and background don't mention are removed.
- **Evidence rules (prompt `scout-2.0`):** Scout sorts what it notices into A. direct evidence (stated in the message or background — the only thing allowed in Evidence), B. reasonable interpretation (only ever a "could/might"), and C. unknown (moved into Uncertainty, e.g. "I can't tell whether you were expecting this bill"). Conflicts with the background are stated as both sides, without calling the sender fake. The server also removes evidence that calls a sender suspicious, fake, impersonating, unexpected or genuine when the user never said so, checks field types, and never shows a question on a "Do not follow" answer.
- **Screenshots:** "＋ Screenshot" reads the text from a PNG/JPG/WebP screenshot (`POST /api/read-image`, local model only). The text is put in the message box for you to check and correct, then analysed like typed text, so the quote checks and safety floor still apply. The image is not saved.
- **Model:** default changed from `qwen2.5:3b` to `qwen2.5vl:7b`. On the 35 text cases: matched expected 26 → 27, missed risky requests 0 → 0, unnecessary warnings 5 → 2, but missed cautions (🟡 expected, got 🟢) 1 → 4; about 7.5 s per analysis instead of 4.4 s.
- **Thinking animation:** while waiting for the AI, Scout's logo pulses and the status cycles through "Reading the message...", "Checking the supplied evidence...", "Considering what's uncertain...", "Preparing advice..." (UI status only — not the AI's reasoning).

Results on the same 35 cases: missed risky requests 1 → 0; matched expected decision 25 → 26; unnecessary warnings 5 → 5; advice mentioning people not in the input 20 → 8.

## V1: AI-assisted adviser

### How to run V1
V1 can use either of two AI engines, set by `AI_PROVIDER` in `.env`:
- **`ollama` (default, free):** a small open-source vision model (`qwen2.5vl:7b`, reads text and screenshots) running on your own computer through the [Ollama](https://ollama.com) app. No API key, no cost, and nothing is sent online.
- **`claude`:** Anthropic's Claude API. It's more capable, but needs an API key and credits.

1. Install [Node.js](https://nodejs.org) 20.12 or newer, then run `npm install` once in this folder.
2. **Free local AI:** install and open the Ollama app, then run `ollama pull qwen2.5vl:7b` once (6 GB). The smaller text-only `qwen2.5:3b` also works (set `OLLAMA_MODEL` in `.env`), but without screenshot reading.
   **Or Claude:** copy `.env.example` to `.env`, set `AI_PROVIDER=claude` and add your `ANTHROPIC_API_KEY`.
3. Run `npm start`, then open **http://localhost:8080** (V0 is also at http://localhost:8080/v0/).

Opening `index.html` by double-clicking still shows the UI, but V1 can't analyse without the server. It shows an error card with **Use V0 rules instead**.

### How V1 works
```
Existing UI (index.html, style.css, script.js)
   ↓ analyseWithAI()          script.js, Stage 7B
POST /api/analyse             server/server.mjs
   ↓ analyseWithClaude()      server/ai-service.mjs
Claude API (structured JSON reply)
   ↓ validateAndConvert()     checks decision, required sections, real quotes
Existing result cards         same shape as V0's analyseMessage()
```
- **The API key stays on the server** (`.env`, ignored by git). It is never sent to the browser.
- **Message and background** are sent as JSON data, so instructions inside a message are treated as text to analyse.
- **Quote check:** any evidence quote that doesn't appear word-for-word in your message or background is removed (shown as `unverified_quote_removed` in Testing Mode).
- **Testing Mode** also shows the engine/model and **what the V0 rules would have decided**, for comparing versions.
- **If the AI fails** (server off, no key, API error, refusal), an error card offers **Retry** or **Use V0 rules instead**, which is clearly labelled "V0 rules (fallback)".
- **History** still lives in memory for the session, through `storage.js`. `server/db.mjs` is where a database can be connected later.

### V1 privacy and limitations
With `ollama`, everything stays on your computer. With `claude`, the message and background are sent to Anthropic's API. Either way, use fictional messages. AI answers can be wrong; the small local model in particular makes more mistakes than V0 on some cases (see Testing Mode's "V0 rules would decide"). It still cannot verify senders, links or websites.

---

## V0 (rule-based baseline): original README

## 1. What it does
You paste in a message (plus optional background) and the adviser tells you what to do safely. It works from the
evidence you supply. It does not try to answer "is this definitely a scam?" Instead it answers: **"Based only on
this information, what is the safest justified advice?"**

Every analysis includes **Decision**, **Evidence**, **Uncertainty** and **Safe next step**, and usually **Why this matters**.

## 2. Who it's for
Students, teenagers and everyday internet users. It covers gaming accounts, Discord-style chats, school/chess clubs,
login and verification-code messages, links, prizes, money requests and ordinary messages.

## 3. How to run it
Download the folder and double-click `index.html`. That's all: no install, no server and no internet connection needed.

## 4. Inputs
- **Message to analyse** (required): the message text.
- **Known background** (optional): what you already know, e.g. "I don't know this person" or "My coach said entry costs £10".

## 5. The three decisions
| | Decision | Meaning |
|---|---|---|
| ✅ Green | **No warning needed from the supplied evidence** | Nothing provided justifies a warning. *Not* a guarantee of safety. |
| ⚠️ Amber | **Pause and verify** | Check something before doing what the message asks. |
| ⛔ Red | **Do not follow the request** | The request itself is risky (passwords, codes, account access, turning off security…). |

## 6. Limitations
This adviser only evaluates the information you provide. It cannot verify sender identities, inspect websites,
confirm real-world events or guarantee that a message is safe or malicious. It is rule-based (pattern matching),
so unusual wording can be missed or misread.

## 7. It does not verify anything
It never opens links, looks up websites, or checks who sent a message. When it mentions a link or a sender, it is only describing what the text says.

## 8. It does not act for you
It never sends messages, logs in, changes passwords or contacts anyone. It only gives advice.

## 9. It runs locally
Everything happens in your browser. There are no accounts, no database, no analytics and no external APIs. The
conversation is kept in memory and disappears when you refresh or press **Clear conversation**.

## 10. Where the logic is
All decision logic is in **`script.js`**, split into stages:
- **Stage 3–4** `detect…()` functions and `evaluateBackground()`: data extraction
- **Stage 5** `chooseDecision()`: decision making
- **Stage 6** `buildEvidence()`, `buildUncertainty()`, `buildQuestion()`, `buildSafeNextStep()`: output text
- **Stage 7** `analyseMessage()`: runs everything and returns a result object
- **Stage 8**: UI rendering (`renderResult()` etc.)

Change `ADVISER_VERSION` at the top of `script.js` when you make a new version, and keep each version in its own folder.

**Testing Mode** (toggle in the left sidebar) shows the triggered rules, the decision code and the rule that decided it.
