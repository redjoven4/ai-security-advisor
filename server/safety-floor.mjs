/* =====================================================================
   V2 — SAFETY FLOOR  (server/safety-floor.mjs)
   ---------------------------------------------------------------------
   Why: in V1 testing, the small local AI sometimes answered "Pause and
   verify" (or even "No warning") to requests that are risky in
   themselves, e.g. "Wanna trade accounts?" or a polite request for a
   verification code.

   What: the V0 rule engine (unchanged, loaded from script.js) is very
   reliable at spotting these specific requests. If V0 finds one, Scout's
   decision can never be lower than "Do not follow the request".

   The floor only RAISES a decision. It never lowers one, and it does not
   touch analyses where V0 finds no risky request — the AI's judgement
   is used as it is.
   ===================================================================== */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyseMessage: analyseWithV0Rules } = require("../script.js");

export function applySafetyFloor(result, message, background) {
  const v0 = analyseWithV0Rules(message, background);
  if (v0.decision !== "do_not_follow" || result.decision === "do_not_follow") return result;

  const aiDecision = result.decision;
  const v0Reasons = v0.allReasons; // e.g. ["verification_code_request"]

  // 1. Decision: raised to the V0 rules' decision
  result.decision = "do_not_follow";
  result.decidingRule = "v0_safety_floor";
  result.allReasons = ["v0_safety_floor", ...v0Reasons.map((r) => `v0:${r}`), `ai_said:${aiDecision}`];

  // 2. Evidence: the V0 rule's own evidence (with its exact quote) goes first
  const ruleEvidence = v0.evidence.slice(0, v0Reasons.length);
  result.evidence = [...ruleEvidence, ...result.evidence].slice(0, 5);

  // 3. Next step: the V0 rule's advice first (e.g. "Do not share the code.")
  result.safeNextStep = [...new Set([...v0.safeNextStep.slice(0, v0Reasons.length), ...result.safeNextStep])].slice(0, 3);

  // 4. "Why" must match the new decision; no question changes a red decision
  result.whyThisMatters = v0.whyThisMatters;
  result.question = null;

  result.checks = [...(result.checks || []), "safety_floor_applied"];
  return result;
}
