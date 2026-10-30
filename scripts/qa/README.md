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
