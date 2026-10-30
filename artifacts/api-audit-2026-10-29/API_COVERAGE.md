# SportCenter API audit — 29–30/10/2026

API: https://sportcenter-deploy-latest-1.onrender.com

Recorded at 2026-10-30T03:49:22.034Z; local timezone Asia/Bangkok.

991 requests across 143/143 documented operations. 133 operations returned at least one 2xx.

Coverage means a request reached the documented operation; authentication/validation/not-found cases do not prove a successful business flow. A bank transfer and authenticated SePay webhook were not performed. No real payment or refund was sent.

The first business attempt used an account ID where a member ID was required; affected cases were rerun with /members/me IDs. Training cases after deliberately probing class deletion were replaced by a separate training fixture. Raw reports retain their original checks; a FAIL may be a changed policy/contract, a blocked external service, or a confirmed defect. Consult the dated project changelog for adjudicated findings.

| Method | Endpoint | Requests | HTTP statuses | 2xx observed |
|---|---|---:|---|---|
| GET | / | 5 | 302 | no |
| GET | /api/accounts | 9 | 200, 400, 401, 403 | yes |
| POST | /api/accounts | 5 | 200, 403 | yes |
| DELETE | /api/accounts/{id} | 7 | 204, 404 | yes |
| GET | /api/accounts/{id} | 17 | 200, 401, 403, 404 | yes |
| PUT | /api/accounts/{id} | 5 | 204, 403 | yes |
| POST | /api/ai/chat | 2 | 400, 503 | no |
| POST | /api/ai/exercise-suggestions | 6 | 400, 403, 503 | no |
| POST | /api/attendances | 5 | 200, 400, 403 | yes |
| PUT | /api/attendances/{id} | 3 | 204, 403 | yes |
| GET | /api/attendances/member/{memberId} | 6 | 200, 401, 403 | yes |
| GET | /api/attendances/session/{sessionId} | 6 | 200, 401, 403 | yes |
| GET | /api/audit-logs | 11 | 200, 400, 401, 403 | yes |
| POST | /api/audit-logs | 1 | 201 | yes |
| GET | /api/audit-logs/{id} | 10 | 200, 401, 403 | yes |
| GET | /api/audit-logs/account/{accountId} | 5 | 200, 401, 403 | yes |
| POST | /api/auth/change-password | 5 | 200, 400 | yes |
| POST | /api/auth/forgot-password | 1 | 500 | no |
| POST | /api/auth/login | 56 | 200, 401 | yes |
| POST | /api/auth/logout | 1 | 200 | yes |
| GET | /api/auth/me | 8 | 200, 401 | yes |
| POST | /api/auth/register | 3 | 200, 403 | yes |
| POST | /api/auth/reset-password | 1 | 500 | no |
| GET | /api/categories | 5 | 200 | yes |
| POST | /api/categories | 3 | 200, 400, 403 | yes |
| DELETE | /api/categories/{id} | 3 | 400, 404 | no |
| GET | /api/categories/{id} | 8 | 200 | yes |
| PUT | /api/categories/{id} | 1 | 200 | yes |
| GET | /api/center-managers | 5 | 200, 401, 403 | yes |
| POST | /api/center-managers | 2 | 201, 403 | yes |
| DELETE | /api/center-managers/{id} | 2 | 204, 404 | yes |
| GET | /api/center-managers/{id} | 7 | 200, 401, 403, 404 | yes |
| PUT | /api/center-managers/{id} | 1 | 204 | yes |
| GET | /api/center-managers/account/{accountId} | 5 | 200, 401, 403 | yes |
| GET | /api/check-ins | 7 | 200, 400, 401, 403 | yes |
| POST | /api/check-ins | 3 | 201, 400 | yes |
| POST | /api/class-bookings | 6 | 200, 400, 403 | yes |
| DELETE | /api/class-bookings/{bookingId}/member/{memberId} | 7 | 200 | yes |
| GET | /api/class-bookings/member/{memberId} | 9 | 200, 401, 403 | yes |
| GET | /api/class-sessions | 6 | 200 | yes |
| POST | /api/class-sessions | 10 | 201, 400 | yes |
| DELETE | /api/class-sessions/{id} | 6 | 204, 400, 404 | yes |
| GET | /api/class-sessions/{id} | 9 | 200, 404 | yes |
| PUT | /api/class-sessions/{id} | 3 | 204 | yes |
| GET | /api/class-sessions/class/{classId} | 5 | 200 | yes |
| GET | /api/classes | 8 | 200 | yes |
| POST | /api/classes | 8 | 200, 400 | yes |
| GET | /api/classes/{classId}/members | 5 | 200, 401, 403 | yes |
| DELETE | /api/classes/{id} | 7 | 200, 400, 404 | yes |
| GET | /api/classes/{id} | 18 | 200, 404 | yes |
| PUT | /api/classes/{id} | 5 | 200, 400, 403 | yes |
| GET | /api/coaches | 5 | 200 | yes |
| POST | /api/coaches | 3 | 200, 403 | yes |
| DELETE | /api/coaches/{id} | 4 | 200, 400, 404 | yes |
| GET | /api/coaches/{id} | 9 | 200, 404 | yes |
| PUT | /api/coaches/{id} | 2 | 200, 403 | yes |
| GET | /api/coaches/me | 7 | 200, 401, 403 | yes |
| GET | /api/coaches/me/classes | 5 | 200, 401, 403 | yes |
| GET | /api/coaches/me/members | 7 | 200, 401, 403 | yes |
| GET | /api/coaches/me/members/{memberId}/training-results | 13 | 200, 401, 403 | yes |
| GET | /api/coaches/me/training-plans | 13 | 200, 400, 401, 403 | yes |
| GET | /api/coaches/me/training-results | 13 | 200, 400, 401, 403 | yes |
| GET | /api/dashboard/classes/summary | 5 | 200, 401, 403 | yes |
| GET | /api/dashboard/members/summary | 5 | 200, 401, 403 | yes |
| GET | /api/dashboard/memberships/summary | 5 | 200, 401, 403 | yes |
| GET | /api/dashboard/revenue | 8 | 200, 400, 401, 403 | yes |
| GET | /api/invoices | 7 | 200, 401, 403 | yes |
| POST | /api/invoices | 4 | 200, 400, 403 | yes |
| DELETE | /api/invoices/{id} | 12 | 200, 400, 403 | yes |
| GET | /api/invoices/{id} | 32 | 200, 401, 403 | yes |
| PUT | /api/invoices/{id} | 3 | 200, 403, 409 | yes |
| GET | /api/invoices/{id}/export | 9 | 200, 401, 403 | yes |
| GET | /api/invoices/members/me | 5 | 200, 401, 403 | yes |
| POST | /api/media/images | 4 | 200, 400, 502 | yes |
| GET | /api/members | 9 | 200, 400, 401, 403 | yes |
| POST | /api/members | 1 | 400 | no |
| DELETE | /api/members/{id} | 3 | 200, 404 | yes |
| GET | /api/members/{id} | 9 | 200, 401, 403, 404 | yes |
| PUT | /api/members/{id} | 2 | 200, 403 | yes |
| GET | /api/members/{id}/summary | 6 | 200, 401, 403 | yes |
| GET | /api/members/{memberId}/memberships | 8 | 200, 401, 403 | yes |
| GET | /api/members/me | 12 | 200, 401, 403 | yes |
| PUT | /api/members/me | 2 | 200, 400 | yes |
| GET | /api/members/me/attendances | 5 | 200, 401, 403 | yes |
| GET | /api/members/me/check-ins | 8 | 200, 400, 401, 403 | yes |
| GET | /api/members/me/class-bookings | 12 | 200, 401, 403 | yes |
| GET | /api/members/me/invoices | 5 | 200, 401, 403 | yes |
| GET | /api/members/me/memberships | 10 | 200, 400, 401, 403 | yes |
| GET | /api/members/me/training-plans | 10 | 200, 400, 401, 403 | yes |
| GET | /api/members/me/training-results | 10 | 200, 400, 401, 403 | yes |
| GET | /api/membership-packages | 9 | 200, 400 | yes |
| POST | /api/membership-packages | 3 | 200, 400 | yes |
| DELETE | /api/membership-packages/{id} | 3 | 200, 404 | yes |
| GET | /api/membership-packages/{id} | 10 | 200, 404 | yes |
| PUT | /api/membership-packages/{id} | 2 | 200, 403 | yes |
| GET | /api/memberships | 9 | 200, 400, 401, 403 | yes |
| POST | /api/memberships | 3 | 200, 403 | yes |
| DELETE | /api/memberships/{id} | 12 | 204, 403, 404 | yes |
| GET | /api/memberships/{id} | 28 | 200, 401, 403, 404 | yes |
| PUT | /api/memberships/{id} | 2 | 204, 403 | yes |
| POST | /api/memberships/{id}/cancel | 4 | 200, 403 | yes |
| POST | /api/memberships/{id}/renew | 2 | 200, 403 | yes |
| GET | /api/memberships/{id}/status | 6 | 200, 401, 403 | yes |
| POST | /api/notifications | 5 | 200, 400, 403 | yes |
| DELETE | /api/notifications/{id} | 4 | 200 | yes |
| PUT | /api/notifications/{id}/read | 2 | 200, 404 | yes |
| GET | /api/notifications/me | 16 | 200, 400, 401 | yes |
| PUT | /api/notifications/read-all | 1 | 200 | yes |
| POST | /api/payments/{id}/cancel | 5 | 200, 403 | yes |
| POST | /api/payments/{id}/refund-confirm | 5 | 200, 400, 403 | yes |
| GET | /api/payments/{paymentId} | 74 | 200, 401, 403 | yes |
| POST | /api/payments/{paymentId}/confirm | 3 | 200, 401, 403 | yes |
| POST | /api/payments/checkout | 4 | 200, 409 | yes |
| POST | /api/payments/class-checkout | 13 | 200, 400, 409 | yes |
| GET | /api/payments/mock-gateway | 1 | 400 | no |
| GET | /api/payments/options | 6 | 200 | yes |
| POST | /api/payments/upgrade-checkout | 6 | 200, 400, 404, 409 | yes |
| GET | /api/receptionists | 5 | 200, 401, 403 | yes |
| POST | /api/receptionists | 2 | 201, 403 | yes |
| DELETE | /api/receptionists/{id} | 2 | 404, 409 | no |
| GET | /api/receptionists/{id} | 6 | 200, 401, 403 | yes |
| PUT | /api/receptionists/{id} | 1 | 204 | yes |
| GET | /api/receptionists/account/{accountId} | 5 | 200, 401, 403 | yes |
| GET | /api/receptionists/me | 5 | 200, 401, 403 | yes |
| GET | /api/rooms | 6 | 200 | yes |
| POST | /api/rooms | 3 | 200, 400 | yes |
| DELETE | /api/rooms/{id} | 3 | 200, 400, 404 | yes |
| GET | /api/rooms/{id} | 7 | 200, 404 | yes |
| PUT | /api/rooms/{id} | 2 | 200 | yes |
| POST | /api/sepay/webhook | 2 | 401 | no |
| GET | /api/support-requests | 9 | 200, 400, 401, 403 | yes |
| POST | /api/support-requests | 1 | 201 | yes |
| PUT | /api/support-requests/{id} | 2 | 204, 403 | yes |
| POST | /api/training-plans | 4 | 200, 404 | yes |
| DELETE | /api/training-plans/{id} | 4 | 200, 404 | yes |
| GET | /api/training-plans/{id} | 18 | 200, 401, 403, 404 | yes |
| PUT | /api/training-plans/{id} | 2 | 200, 403 | yes |
| POST | /api/training-plans/class/{classId} | 4 | 200, 403, 404 | yes |
| POST | /api/training-results | 3 | 200, 400 | yes |
| DELETE | /api/training-results/{id} | 2 | 200, 404 | yes |
| GET | /api/training-results/{id} | 13 | 200, 401, 403, 404 | yes |
| PUT | /api/training-results/{id} | 2 | 200, 403 | yes |
| GET | /WeatherForecast | 5 | 200 | yes |
