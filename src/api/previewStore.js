// UI-ONLY data for features that have no back-end API yet.
// Same interface as the real API resources (list/get/create/update/remove) so a page can
// switch to the real endpoint later by changing one line in src/pages/staff/resources.jsx.
// Data lives in memory and resets when the page reloads.
import * as mock from './mockData.js';

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const newId = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`);

function previewResource(seed) {
  let rows = structuredClone(seed);
  return {
    preview: true,
    list: async () => (await wait(), structuredClone(rows)),
    get: async (id) => (await wait(), structuredClone(rows.find((r) => r.id === id) ?? null)),
    create: async (body) => {
      await wait();
      const row = { id: newId(), createdAt: new Date().toISOString(), ...body };
      rows = [row, ...rows];
      return structuredClone(row);
    },
    update: async (id, body) => {
      await wait();
      rows = rows.map((r) => (r.id === id ? { ...r, ...body, updatedAt: new Date().toISOString() } : r));
      return null;
    },
    remove: async (id) => {
      await wait();
      rows = rows.filter((r) => r.id !== id);
      return null;
    },
  };
}

export const preview = {
  members: previewResource(mock.members),
  receptionists: previewResource(mock.receptionists),
  packages: previewResource(mock.packages),
  memberships: previewResource(mock.memberships),
  accounts: previewResource(mock.accounts),
  trainingPlans: previewResource(mock.trainingPlans),
  trainingResults: previewResource(mock.trainingResults),
  notifications: previewResource(mock.notifications),
  memberInvoices: previewResource(mock.invoices.filter((i) => i.memberName === mock.members[0].fullName)),
};
