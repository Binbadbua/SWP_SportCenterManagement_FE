# Live API/UI audit (29–30 October 2026)

Results: ../../artifacts/api-audit-2026-10-29/API_COVERAGE.md. Business findings and current instructions: ../../../CHANGELOG_AND_BE_ISSUES.md, ../../../TEST_FLOWS.md and ../../../CLAUDE.md.

The recorded matrix has 991 direct HTTP calls covering143/143 Swagger operations. Coverage includes authorization/validation failures; it does not mean all143 business behaviors passed. Stable UI smoke is115/115; refund UI21/21; pure FE regression7/7; real class-hold expiry7/7.

No bank transfer, authenticated SePay webhook or actual bank refund was performed. Cash/confirm/refund records in these reports are synthetic QA ledger entries only.

## Safe local checks

- npm.cmd run build
- node scripts/qa/fe-regressions.mjs
- node scripts/qa/coverage-audit.mjs (regenerates the matrix from existing reports, no network)

## Live tests

api-audit.mjs bootstraps isolated accounts/resources. business-audit.mjs, followup-audit.mjs, training-recovery.mjs, class-expiry.mjs, policy-final.mjs and reconcile-confirm-probe.mjs mutate QA records. class-expiry waits through a real15-minute hold; the old confirm probe is historical evidence of B60, never a normal SePay workflow. read-api-audit.mjs checks role/ownership reads using fixtures. ui-audit.mjs uses hidden Chrome and separate browser contexts; --payment also creates/cancels one QA order. ui-refund.mjs creates a synthetic desk booking/refund request and records refund confirmation through UI; --resume-fixture reuses its prior pending refund.

Fixture run QA261029163854 was cleaned after this audit. Many IDs are now404. These scripts are not a one-command repeatable suite against the already deleted manifest; prepare a fresh isolated run and check script-specific fixture assumptions before running live mutations. Never use customer/seed records as replacement mutation fixtures. The cleanup script has an explicit run-ID guard and is only appropriate to that historical run; do not rerun it as a generic delete command.

cleanup.json/cleanup-tail.json record remaining API constraints and B65. A running QA class, session with attendance, linked profiles/room/category and retained financial/support/check-in/audit/media history remain; do not claim complete deletion. Backend owners can inspect those exact IDs under the project's retention policy.

Reports redact tokens/password fields; Chrome profiles are temporary and removed. ui-audit-initial-HMR.json and ui-refund-server-stopped.json preserve superseded environment failures; ui-audit.json and ui-refund.json contain the stable results. Root changelog adjudicates raw failed checks caused by changed policies, invalid fixtures or confirmed BE defects.

## AI readiness and payment refresh recheck (01 November 2026)

`node scripts/qa/ai-payment-recheck.mjs` checks current Swagger, existing demo role logins, AI validation/readiness and three read-only GETs of the previously reported payment. It does not bootstrap accounts/resources, create QA orders or send confirm/cancel/refund/webhook. AI calls may use provider quota once enabled. Reports go to a unique UTC timestamp under artifacts/ai-payment-recheck-2026-11-01; see AI_BE_HANDOFF.md for interpreted results and current policy questions.

`payment-feedback-ui.mjs` also checks tab visibility/resume events and stopping after Paid with a synthetic payment ID. Set QA_UI_BASE to a running local preview and QA_PAYMENT_FEEDBACK_OUT to a new artifact directory to preserve older reports. All payment responses in this harness are simulated; it cannot prove a real bank transfer or webhook delivery.
## Outstanding backend recheck (02 November 2026)

Current interpreted results: ../../artifacts/be-recheck-2026-11-02/RECHECK_RESULTS.md. ai-readiness-recheck.mjs checks the published AI options/auth/validation and inference; auth-upload-recheck.mjs tests nonexistent email/invalid OTP and rejected media only. No new accounts or financial records are created by these scripts; provider inference may use quota once enabled.

be-pending-recheck.mjs reads existing data by default. --class-probe creates one empty class/session then verifies cleanup; --plan-guard checks non-enrolled plan rejection and removes an unexpectedly accepted probe. Both flags write business data and must be used deliberately. It never creates orders/invoices/memberships or changes real payments. Historical final states do not prove fresh deadline timing. Outputs use unique folders; do not overwrite old evidence or count the initial Member export403 expectation as a bug.

Local training-result mapping regression: node scripts/qa/training-result-session-regressions.mjs (actual Vite-loaded resource config, API mocks, fetch forbidden;9checks). Build passed after this FE fix. Do not create attendance/financial histories on the demo DB merely to retest the mapping.
## FE chatbox and five-flow review (02–03 November 2026, Round29)

Interpreted results: ../../artifacts/web-review-2026-11-02/WEB_REVIEW.md. Final production build passed (96 modules). These commands preserve dated evidence. Browser scripts require installed Chrome; the first three regression harnesses below start their own local Vite server. No real business writes or provider inference are needed.

- `node scripts/qa/use-api-regressions.mjs` — actual React useApi with deferred loaders; 18 checks for dependency, skip, unmount and stale response/401 behavior. No external APIs.
- `node scripts/qa/checkout-ui-regressions.mjs` — actual checkout/ClassDetail components with mocked API responses and blocked financial writes; 21 checks for delayed data, options outage/retry/legacy404, held capacity and date defaults.
- `node scripts/qa/auth-session-regressions.mjs` — actual AuthProvider in two real tabs sharing localStorage; 13 checks for identity/role changes, logout/clear, mismatched token and old updateUser callbacks. Fake JWTs, no external APIs.
- `node scripts/qa/review-regressions.mjs` — actual client/time/AI modules via Vite SSR, controlled fetch; 19 checks including deadlines, abort, ProblemDetails503, Vietnam clock and completed-only AI history.
- `node scripts/qa/ai-chat-ui.mjs` — start the FE server at QA_UI_BASE (default http://127.0.0.1:5182) first. Actual widget, ALL API calls intercepted/mocked including login and AI. 43 checks, including the real 35-second FE deadline, retry/cancel, IME, account/storage changes, mobile viewport, print and plain text rendering. This does not validate Gemini.
- `node scripts/qa/web-ux-audit.mjs` — real existing account logins and GETs; navigation/form previews only. Blocks business writes and does not open AI or send inference. Full 211 checks; `--focus-only` runs 32 mobile/form/launcher checks. Requires a local FE server proxying the deployed API. Despite inherited flag declarations in the script, do not use historical payment flags for this review; it is a read-only harness.
- `payment-feedback-ui.mjs` — set QA_UI_BASE and a NEW QA_PAYMENT_FEEDBACK_OUT before running to retain old reports. Final 23 checks are fully simulated using a synthetic payment ID. The resume concurrency counter is reset after old reads drain, so full reload/StrictMode startup does not contaminate the measured focus/visibility/online burst. One HTTP500 is intentionally mocked.

Example PowerShell for the existing local server and an output folder that preserves history:

```powershell
$env:QA_UI_BASE = 'http://127.0.0.1:5182'
$qaRun = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH-mm-ss-fffZ')
$env:QA_PAYMENT_FEEDBACK_OUT = "artifacts/web-review-2026-11-02/payment-ui/$qaRun"
node scripts/qa/payment-feedback-ui.mjs
```

Do not equate passing mocked responses or read-only route checks with successful bank transfers, refunds, expiry jobs, all Swagger operations, production uptime or a completed Coach Copilot UI. Latest live AI evidence remains Round28's503; no new inference was sent in the UI review. The report retains the historical startup/harness failures with their corrected interpretations.

## Bounded live AI timeout diagnosis (03 November2026)

`node scripts/qa/ai-timeout-recheck.mjs` performs existing Member/Coach logins, options/roster GETs and at most one chat plus one exercise inference, sequentially, without retry. It may consume provider quota. No new entities/financial records or load generation. Outputs are timestamped under artifacts/ai-concurrency-review-2026-11-03; see AI_AND_CAPACITY.md. Current1/3pass means options passed while both real inference calls failed503 in about37seconds; it is unrelated to43/43 mocked widget checks. No load/stress test has been run; do not interpret this script as one.
