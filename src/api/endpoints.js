

import { http } from "./client.js";
import { readAllPages } from "./pagination.js";

export const isMissingRoute = (e) => (e?.status === 404 || e?.status === 405) && !e.details;

const ALL = "pageSize=500";
const itemsOf = (response) =>
  Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);

const withId = (key) => (row) => ({ ...row, id: row[key] ?? row.id });
const listOf = (path, key) => async () => {
  const rows = itemsOf(await http.get(path));
  return key ? rows.map(withId(key)) : rows;
};

const listAllOf = (path, key) => async () => {
  const rows = await readAllPages(path, http.get);
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
  ai: {
    options: (options) => http.get("/api/ai/options", options),
    chat: (body, options) => http.post("/api/ai/chat", body, { timeoutMs: 35000, ...options }),
    exerciseSuggestions: (body, options) => http.post("/api/ai/exercise-suggestions", body, { timeoutMs: 35000, ...options }),
  },
  categories: crud("/api/categories"),
  rooms: crud("/api/rooms"),

  packages: {
    ...crud("/api/membership-packages"),
    list: listOf(`/api/membership-packages?${ALL}`, "membershipPackageId"),
  },

  auth: {
    login: (data) => http.post("/api/auth/login", data),
    register: (data) => http.post("/api/auth/register", data),

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

    update: (id, body) => http.put(`/api/memberships/${id}`, body),
    remove: (id) => http.del(`/api/memberships/${id}`),

    renew: (id, receptionistId) =>
      http.post(`/api/memberships/${id}/renew${receptionistId ? `?receptionistId=${receptionistId}` : ""}`),
    cancel: (id) => http.post(`/api/memberships/${id}/cancel`),
    mine: listOf("/api/members/me/memberships?pageSize=50", "membershipId"),

    byMember: (memberId) => listOf(`/api/members/${memberId}/memberships?${ALL}`, "membershipId")(),
  },

  members: {
    ...crud("/api/members"),
    list: listOf(`/api/members?${ALL}`, "memberId"),
    me: {
      get: () => http.get("/api/members/me"),
      update: (data) => http.put("/api/members/me", data),
    },

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

        }
      }
      throw firstError ?? new Error("Không tìm thấy hồ sơ học viên của bạn.");
    },
  },

  classes: {
    ...crud("/api/classes"),

    members: (classId) => http.get(`/api/classes/${classId}/members`),
  },

  schedules: {
    ...crud("/api/class-sessions"),
    byClass: (classId) => http.get(`/api/class-sessions/class/${classId}`),
    attendance: (sessionId) =>
      http.get(`/api/attendances/session/${sessionId}`),

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
    mine: listAllOf("/api/members/me/training-plans", "trainingPlanId"),
    forCoach: listOf(`/api/coaches/me/training-plans?${ALL}`, "trainingPlanId"),
  },

  trainingResults: {
    get: (id) => http.get(`/api/training-results/${id}`),
    create: (body) => http.post("/api/training-results", body),
    update: (id, body) => http.put(`/api/training-results/${id}`, body),
    remove: (id) => http.del(`/api/training-results/${id}`),
    mine: listAllOf("/api/members/me/training-results", "trainingResultId"),
    forCoach: listOf(`/api/coaches/me/training-results?${ALL}`, "trainingResultId"),
    byMember: (memberId) =>
      listOf(`/api/coaches/me/members/${memberId}/training-results?${ALL}`, "trainingResultId")(),
  },

  invoices: {
    ...crud("/api/invoices"),
    reportList: listAllOf("/api/invoices"),
    mine: listAllOf("/api/members/me/invoices"),

    export: (id) => http.get(`/api/invoices/${id}/export`),
  },

  notifications: {
    mine: listOf("/api/notifications/me?pageSize=100"),
    markRead: (id) => http.put(`/api/notifications/${id}/read`),
    markAllRead: () => http.put("/api/notifications/read-all"),
    remove: (id) => http.del(`/api/notifications/${id}`),

    send: (body) => http.post("/api/notifications", body),
  },

  bookings: {
    mine: listOf("/api/members/me/class-bookings"),
    byMember: (memberId) => listOf(`/api/class-bookings/member/${memberId}`)(),

    create: (body) => http.post("/api/class-bookings", body),
    cancel: (bookingId, memberId) =>
      http.del(`/api/class-bookings/${bookingId}/member/${memberId}`),
  },

  checkIns: {
    create: (memberId) => http.post("/api/check-ins", { memberId }),

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

  supportRequests: {
    list: listOf(`/api/support-requests?${ALL}`),
    create: (body) => http.post("/api/support-requests", body),
    update: (id, body) => http.put(`/api/support-requests/${id}`, body),
  },

  auditLogs: {
    list: listOf("/api/audit-logs?pageSize=500"),
  },

  payments: {

    options: () => http.get("/api/payments/options"),
    checkout: (body) => http.post("/api/payments/checkout", body),

    upgradeCheckout: (body) => http.post("/api/payments/upgrade-checkout", body),

    classCheckout: (body) => http.post("/api/payments/class-checkout", body),

    get: (id) => http.get(`/api/payments/${id}`),
    refundConfirm: (id, reference) => http.post('/api/payments/' + id + '/refund-confirm', { reference }),
    confirm: (id) => http.post(`/api/payments/${id}/confirm`),

    cancel: (id) => http.post(`/api/payments/${id}/cancel`),
  },

  media: {
    uploadImage: (file) => {
      const body = new FormData();
      body.append("file", file);
      return http.post("/api/media/images", body);
    },
  },
};
