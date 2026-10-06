// Thin fetch wrapper for the ASP.NET Core API.
// - In development, leave VITE_API_BASE_URL empty: Vite proxies /api to the back-end (see vite.config.js).
// - In production, set VITE_API_BASE_URL to the API origin, e.g. https://api.example.com

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline; // true when the back-end could not be reached at all
    this.details = details;
  }
}

const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// ASP.NET Core returns ProblemDetails: { title, detail } or validation { errors: { Field: [msg] } }
function messageFrom(body, status) {
  if (body?.errors && typeof body.errors === 'object') {
    const first = Object.values(body.errors).flat().filter(Boolean);
    if (first.length) return first.join(' ');
  }
  if (body?.detail) return body.detail;
  if (body?.title) return body.title;
  if (status === 404) return 'Not found.';
  return `Request failed (HTTP ${status}).`;
}

export async function request(method, path, body) {
  let res;
  
  // 1. Chuẩn bị Headers cơ bản
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // 2. Lấy Token từ localStorage và đính kèm vào Authorization Header
  const token = localStorage.getItem('sportcenter.token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers, // Sử dụng bộ headers đã được đính kèm Token
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('The API could not be reached. Start the back-end and try again.', { offline: true });
  }

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? parse(text) : null;

  if (!res.ok) {
    // The Vite dev proxy answers 500/502/503/504 with an empty, non-JSON body when the back-end is down.
    const offline = [502, 503, 504].includes(res.status) || (res.status === 500 && data === null);
    if (offline) {
      throw new ApiError('The API could not be reached. Start the back-end and try again.', { status: res.status, offline: true });
    }
    throw new ApiError(messageFrom(data, res.status), { status: res.status, details: data });
  }
  return data;
}

export const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  del: (path) => request('DELETE', path),
};