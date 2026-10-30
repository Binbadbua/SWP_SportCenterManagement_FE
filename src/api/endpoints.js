// Every endpoint that exists in SWP_SportCenter.Api today (routes checked against the API's swagger.json).
// Pages that use a newer route (auth.changePassword, payments — BE PR #30; media — PR #32) still explain the
// gap when isMissingRoute() says an older API answers without it.
import { http } from "./client.js";

// A route the API does not have answers 404/405 with an empty body; a real "not found" carries a message
export const isMissingRoute = (e) => (e?.status === 404 || e?.status === 405) && !e.details;

// Paged endpoints return { data, totalItems, pageSize, pageIndex } and default to 10 rows,
// so lists ask for one large page. Plain list endpoints return an array.
const ALL = "pageSize=500";
const itemsOf = (response) =>
  Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
// Some responses name their key membershipId / trainingPlanId…; the UI always uses `id`.
const withId = (key) => (row) => ({ ...row, id: row[key] ?? row.id });
const listOf = (path, key) => async () => {
  const rows = itemsOf(await http.get(path));
  return key ? rows.map(withId(key)) : rows;
};

const crud = (base) => ({
  list: () => http.get(base),
  get: (id) => http.get(`${base}/${id}`),
  create: (body) => http.post(base, body),
  update: (id, body) => http.put(`${base}/${id}`, body),
  remove: (id) => http.del(`${base}/${id}`),
});

export const api = {
  categories: crud("/api/categories"),
  rooms: crud("/api/rooms"),

  packages: {
    ...crud("/api/membership-packages"),
    list: listOf(`/api/membership-packages?${ALL}`, "membershipPackageId"),
  },

  auth: {
    login: (data) => http.post("/api/auth/login", data),
    register: (data) => http.post("/api/auth/register", data),
    // { currentPassword, newPassword } for the signed-in account → { message }
    changePassword: (body) => http.post("/api/auth/change-password", body),
  },

  accounts: {
    ...crud("/api/accounts"),
    list: listOf(`/api/accounts?${ALL}`, "accountId"),
  },

  receptionists: {
    ...crud("/api/receptionists"),
    list: listOf("/api/receptionists"),
    me: () => http.get("/api/receptionists/me"),
  },

  memberships: {
    list: listOf(`/api/memberships?${ALL}`, "membershipId"),
    get: (id) => http.get(`/api/memberships/${id}`),
    create: (body) => http.post("/api/memberships", body),
    // PUT takes { startDate, endDate, status } only
    update: (id, body) => http.put(`/api/memberships/${id}`, body),
    remove: (id) => http.del(`/api/memberships/${id}`),
    // A renewal is a new period + a pending invoice. Reception bill it themselves; a manager names the
    // receptionist it is billed to (the API refuses a manager's renewal without one).
    renew: (id, receptionistId) =>
      http.post(`/api/memberships/${id}/renew${receptionistId ? `?receptionistId=${receptionistId}` : ""}`),
    cancel: (id) => http.post(`/api/memberships/${id}/cancel`),
    mine: listOf("/api/members/me/memberships?pageSize=50", "membershipId"),
    // Reception / manager: one member's cards, e.g. to check them before booking a class for the member
    byMember: (memberId) => listOf(`/api/members/${memberId}/memberships?${ALL}`, "membershipId")(),
  },

  members: {
    ...crud("/api/members"),
    list: listOf(`/api/members?${ALL}`, "memberId"),
    me: {
      get: () => http.get("/api/members/me"),
      update: (data) => http.put("/api/members/me", data),
    },
    // The member ID of the signed-in member. GET /api/members/me is the real source; while it fails
    // (see CHANGELOG_AND_BE_ISSUES.md) the ID is read from the member's own memberships or plans.
    myId: async () => {
      let firstError;
      try {
        const me = await http.get("/api/members/me");
        if (me?.memberId) return me.memberId;
      } catch (e) {
        firstError = e;
      }
      for (const path of [
        "/api/members/me/memberships?pageSize=1",
        "/api/members/me/training-plans?pageSize=1",
        "/api/members/me/training-results?pageSize=1",
      ]) {
        try {
          const id = itemsOf(await http.get(path))[0]?.memberId;
          if (id) return id;
        } catch {
          /* try the next source */
        }
      }
      throw firstError ?? new Error("Không tìm thấy hồ sơ học viên của bạn.");
    },
  },

  classes: {
    ...crud("/api/classes"),
    // Every staff role (reception too, since the 23/10/2026 deploy)
    members: (classId) => http.get(`/api/classes/${classId}/members`),
  },

  schedules: {
    ...crud("/api/class-sessions"),
    byClass: (classId) => http.get(`/api/class-sessions/class/${classId}`),
    attendance: (sessionId) =>
      http.get(`/api/attendances/session/${sessionId}`),
    // The API has no "my sessions" endpoint: a coach's sessions are those of the classes they teach
    forCoach: async () => {
      const [sessions, mine] = await Promise.all([
        http.get("/api/class-sessions"),
        http.get("/api/coaches/me/classes"),
      ]);
      const ids = new Set(itemsOf(mine).map((c) => c.classId));
      return itemsOf(sessions).filter((s) => ids.has(s.classId));
    },
  },

  coaches: {
    ...crud("/api/coaches"),
    // The /me endpoints read the coach from the token; the arguments are kept for older callers.
    me: () => http.get("/api/coaches/me"),
    classes: () => http.get("/api/coaches/me/classes"),
    members: () => http.get("/api/coaches/me/members"),
  },

  managers: crud("/api/center-managers"),

  trainingPlans: {
    get: (id) => http.get(`/api/training-plans/${id}`),
    create: (body) => http.post("/api/training-plans", body),
    update: (id, body) => http.put(`/api/training-plans/${id}`, body),
    remove: (id) => http.del(`/api/training-plans/${id}`),
    mine: listOf("/api/members/me/training-plans?pageSize=100", "trainingPlanId"),
    forCoach: listOf(`/api/coaches/me/training-plans?${ALL}`, "trainingPlanId"),
  },

  trainingResults: {
    get: (id) => http.get(`/api/training-results/${id}`),
    create: (body) => http.post("/api/training-results", body),
    update: (id, body) => http.put(`/api/training-results/${id}`, body),
    remove: (id) => http.del(`/api/training-results/${id}`),
    mine: listOf("/api/members/me/training-results?pageSize=100", "trainingResultId"),
    forCoach: listOf(`/api/coaches/me/training-results?${ALL}`, "trainingResultId"),
    byMember: (memberId) =>
      listOf(`/api/coaches/me/members/${memberId}/training-results?${ALL}`, "trainingResultId")(),
  },

  invoices: {
    ...crud("/api/invoices"),
    mine: listOf("/api/members/me/invoices"),
    // Reception / manager: the invoice to print (same fields as GET /api/invoices/{id})
    export: (id) => http.get(`/api/invoices/${id}/export`),
  },

  notifications: {
    mine: listOf("/api/notifications/me?pageSize=100"),
    markRead: (id) => http.put(`/api/notifications/${id}/read`),
    markAllRead: () => http.put("/api/notifications/read-all"),
    remove: (id) => http.del(`/api/notifications/${id}`),
    // { accountIds: [], title, message }. A manager may send to anyone; a coach only to the members
    // booked into their classes (the API refuses the whole send otherwise).
    send: (body) => http.post("/api/notifications", body),
  },

  bookings: {
    mine: listOf("/api/members/me/class-bookings"),
    byMember: (memberId) => listOf(`/api/class-bookings/member/${memberId}`)(),
    // { memberId, classId }; reception also send paymentMethod when the class has a fee: the money is taken at
    // the desk and the API books and bills at once (B53)
    create: (body) => http.post("/api/class-bookings", body),
    cancel: (bookingId, memberId) =>
      http.del(`/api/class-bookings/${bookingId}/member/${memberId}`),
  },

  // A member coming in to train on their own (CHANGELOG Part B, B47): reception check the card valid today and log
  // the visit. { memberId } → { memberName, packageName, membershipEndDate, daysRemaining, checkInTime }. Paged.
  checkIns: {
    create: (memberId) => http.post("/api/check-ins", { memberId }),
    // date "YYYY-MM-DD" (Vietnam), newest first
    list: (date) => listOf(`/api/check-ins?${ALL}${date ? `&date=${date}` : ""}`)(),
    mine: listOf("/api/members/me/check-ins?pageSize=20"),
  },

  attendance: {
    mine: listOf("/api/members/me/attendances"),
    byMember: (memberId) => http.get(`/api/attendances/member/${memberId}`),
    record: (body) => http.post("/api/attendances", body),
    update: (id, body) => http.put(`/api/attendances/${id}`, body),
  },

  dashboard: {
    revenue: (from, to) =>
      http.get(`/api/dashboard/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    membersSummary: () => http.get("/api/dashboard/members/summary"),
    membershipsSummary: () => http.get("/api/dashboard/memberships/summary"),
    classesSummary: () => http.get("/api/dashboard/classes/summary"),
  },

  // A member creates requests and sees only their own (the API scopes GET to them); reception and
  // managers see every request and update its status. Paged, newest first.
  supportRequests: {
    list: listOf(`/api/support-requests?${ALL}`),
    create: (body) => http.post("/api/support-requests", body),
    update: (id, body) => http.put(`/api/support-requests/${id}`, body),
  },

  // Center manager only; paged, newest first, at most 500 a page. The API writes the entries itself (lib/audit.js).
  auditLogs: {
    list: listOf("/api/audit-logs?pageSize=500"),
  },

  // A member buys a package online:
  //   checkout { membershipPackageId, startDate, paymentMethod, returnUrl }
  //     → { paymentId, membershipId, invoiceId, amount, status, paymentUrl } — an inactive card + a pending
  //       invoice (paymentId = invoiceId). The API has no gateway yet, so paymentUrl is null: reception or a
  //       manager confirms the money within 30 minutes, after that the API cancels the order.
  //   get(paymentId) → { paymentId, status, amount, packageName, membershipId, invoiceId, paidAt }
  //   confirm(paymentId) — reception / manager only: invoice paid, card active
  payments: {
    // What the API takes online (CHANGELOG Part B, B54): { provider: "SePay", methods: [2], holdMinutes, upgrade }.
    // An older API without payment options answers 404: the website keeps orders that reception confirms.
    options: () => http.get("/api/payments/options"),
    checkout: (body) => http.post("/api/payments/checkout", body),
    // Move the member's current card to a longer package at once (B54): { membershipId, membershipPackageId,
    // paymentMethod, returnUrl }; the API takes off what is left of the current card
    upgradeCheckout: (body) => http.post("/api/payments/upgrade-checkout", body),
    // Booking a class with a fee (CHANGELOG Part B, B53): { classId, paymentMethod } → { paymentId, bookingId,
    // originalAmount, discountPercent, amount, status (1 waiting for reception, 2 booked), paymentUrl, expiresAt }.
    // The API works out the amount from the class's fee and the member's card.
    classCheckout: (body) => http.post("/api/payments/class-checkout", body),
    // SePay returns payUrl/qrCodeUrl as image URLs, plus bankAccountNumber, bankBin, paymentReference and expiresAt
    get: (id) => http.get(`/api/payments/${id}`),
    refundConfirm: (id, reference) => http.post('/api/payments/' + id + '/refund-confirm', { reference }),
    confirm: (id) => http.post(`/api/payments/${id}/confirm`),
    // The member drops their own order while it waits for a SePay bank transfer (B54): nothing was taken, a class place is freed
    cancel: (id) => http.post(`/api/payments/${id}/cancel`),
  },

  // Photos: the API keeps only a link (avatar ≤ 500 characters). The file goes to the API's Cloudinary store
  // first (JPEG, PNG, WebP or GIF, ≤ 5 MiB, any signed-in role) and the { url } it returns is what forms save.
  media: {
    uploadImage: (file) => {
      const body = new FormData();
      body.append("file", file);
      return http.post("/api/media/images", body);
    },
  },
};
