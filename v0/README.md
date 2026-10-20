# Security Message Adviser (V0)

*Evidence first. Assumptions second.*

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
