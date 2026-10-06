// Every endpoint that exists in SWP_SportCenter.Api today.
// Features without a back-end yet use src/api/previewStore.js instead (UI-only).
import { http } from './client.js';

const crud = (base) => ({
  list: () => http.get(base),
  get: (id) => http.get(`${base}/${id}`),
  create: (body) => http.post(base, body),
  update: (id, body) => http.put(`${base}/${id}`, body),
  remove: (id) => http.del(`${base}/${id}`),
});

export const api = {
  categories: crud('/api/categories'),
  rooms: crud('/api/rooms'),

  packages: {
    ...crud('/api/membership-packages'),
    list: async () => {
      const response = await http.get('/api/membership-packages');
      let items = response.items || response.data || response;
      return items.map(item => ({
        ...item,
        id: item.membershipPackageId
      }));
    }
  },

  auth: {
    login: (data) => http.post('/api/auth/login', data),
    register: (data) => http.post('/api/auth/register', data),
  },

  accounts: {
    ...crud('/api/accounts'),
    list: async () => {
      const response = await http.get('/api/accounts');
      let data = response.items || response.data || response;
      return data.map(item => ({ ...item, id: item.id || item.accountId }));
    }
  },

  receptionists: {
    ...crud('/api/receptionists'),
    list: async () => {
      const response = await http.get('/api/receptionists');
      let data = response.items || response.data || response;
      return data.map(item => ({ ...item, id: item.id || item.accountId }));
    }
  },

  memberships: {
    ...crud('/api/memberships'),
    list: async () => {
      const response = await http.get('/api/memberships');
      let data = response.items || response.data || response;
      return data.map(item => ({
        ...item,
        id: item.membershipId || item.id 
      }));
    }
  },

  members: {
    ...crud('/api/members'),
    list: async () => {
      const response = await http.get('/api/members');
      let data = response.items || response.data || response;
      return data.map(item => ({
        ...item,
        id: item.memberId || item.id 
      }));
    }
  },

  classes: {
    ...crud('/api/classes'),
    members: (classId) => http.get(`/api/classes/${classId}/members`),
  },

  schedules: {
    ...crud('/api/class-sessions'),
    byClass: (classId) => http.get(`/api/class-sessions/class/${classId}`),
    attendance: (sessionId) => http.get(`/api/attendances/session/${sessionId}`),
  },

  coaches: {
    ...crud('/api/coaches'),
    byAccount: (accountId) => http.get(`/api/coaches/me`),
    classes: (coachId) => http.get(`/api/coaches/me/classes`),
    members: (coachId) => http.get(`/api/coaches/me/members`),
  },

  managers: crud('/api/center-managers'),
  invoices: crud('/api/invoices'),

  auditLogs: {
    list: () => http.get('/api/audit-logs'),
    byAccount: (accountId) => http.get(`/api/audit-logs/account/${accountId}`),
  },

  bookings: {
    byMember: (memberId) => http.get(`/api/members/${memberId}/class-registrations`),
    create: (body) => http.post('/api/class-registrations', body),
    cancel: (bookingId, memberId) => http.del(`/api/class-registrations/${bookingId}?memberId=${memberId}`),
  },

  attendance: {
    byMember: (memberId) => http.get(`/api/members/${memberId}/attendance`),
    record: (body) => http.post('/api/attendance', body),
    update: (id, body) => http.put(`/api/attendance/${id}`, body),
  },
};
