# AI recheck — 02/11/2026

Latest complete run: `2026-11-02T03-09-21-358Z/report.json` and `swagger.json`, corresponding to 10:09 Vietnam time. Fifteen checks, thirteen passed, two failed; twenty-two HTTP requests. Existing demo accounts only; no QA entity, booking, payment or financial operation created/modified.

## Current result

Both valid inference calls still return503:

- Member POST `/api/ai/chat`:140ms, trace `0HNPOHPODEBG2:0000002C`.
- Coach POST `/api/ai/exercise-suggestions`:80ms, trace `0HNPOHPODEBG2:00000034`. Used memberId read from the authenticated coach's existing roster.

Exact API message:

> AI Gemini chưa cấu hình đầy đủ. Kiểm tra tại backend: Ai__ApiKey.

GET `/api/ai/options` now exists and returns200 to Member,401 anonymously. Current response:

```json
{
  "provider": "Gemini",
  "enabled": true,
  "configured": false,
  "configurationIssues": ["Ai__ApiKey"],
  "chatAccess": "Authenticated",
  "exerciseAccess": "Coach",
  "providerVerified": false
}
```

This confirms AI is enabled but configuration readiness fails specifically for Ai__ApiKey on the running deployment. No provider inference succeeded; quota/model/provider response or answer quality cannot be assessed. BE should configure the valid Gemini key in the actual deployed service, restart/redeploy, then prove both endpoints200 with real content. No secret should be added to FE/VITE_ variables.

## BE improvements verified

- Published configuration/readiness endpoint is present, has a response schema, and does not return the secret key.
- Chat policy is now explicit: Authenticated. Coach, Receptionist and Manager reach the same missing-key503 branch; that is consistent with the new contract. The old Member-only expectation is superseded. Raw report role notes referencing the old policy question are historical wording; use this interpretation and the explicit options response.
- Exercise policy Coach is enforced: Member403; anonymous401.
- Validation works: chat empty/whitespace/2001chars400; exercise duration5minutes400.
- Swagger now documents200 `AiReply` with `reply`, `suggestions`, `provider`, `disclaimer` and error schemas instead of only bare200OK. Request message/history and exercise goal/duration constraints remain available.

## Not validated

Successful factual answers about current sports, memberships/prices, own schedule, history continuity, out-of-scope refusal and quotas/provider failure recovery are blocked by missing credentials. Do not report these as working because schema/validation exists.

## Earlier attempts retained

- `2026-11-02T03-06-26-956Z/report.json`: initial Swagger request timed out after55seconds; no login/inference occurred. Immediately afterward PowerShell Swagger returned200 in957ms. This is not evidence of an AI-specific defect; service/cold-start/network cause was not established.
- `2026-11-02T03-07-57-178Z/report.json`: first complete13-check run before discovering the new options endpoint; same two503 inference failures, elevenpasses. Latest run above adds options positive/negative checks.

The QA script is `scripts/qa/ai-readiness-recheck.mjs`. Syntax check passes. Root agent owns the project changelog/test-flow/CLAUDE update for this recheck.

## Later AI check — 02/11/2026,18:06–18:09

Newer evidence supersedes the earlier missingAi__ApiKey status: options now configured=true/configurationIssues=[], but chat/exercise still503 with overload/quota or timeout messages. No successful Gemini answer. See `2026-11-02T11-06-08-672Z/AI_RECHECK.md` (relative to the ai folder), primaryreport and one shortretry `2026-11-02T11-09-25-527Z/report.json`. The old missing-key result above is retained as history; do not infer provider readiness from configured=true.