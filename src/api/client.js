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

// The API has no exception handler: a service that throws comes back as HTTP 500 with a plain-text
// stack trace ("System.Exception: Lớp học không tồn tại.\n   at ..."). Keep only the message.
function messageFromText(text) {
  const firstLine = (text ?? '').split('\n')[0].trim();
  if (!firstLine || firstLine.startsWith('<')) return null; // empty or an HTML error page
  return firstLine.replace(/^[\w.]+Exception:\s*/, '') || null;
}

// ASP.NET Core returns ProblemDetails: { title, detail } or validation { errors: { Field: [msg] } },
// some actions return a plain string (NotFound("...")) or { message }.
function messageFrom(body, status, text) {
  if (body?.errors && typeof body.errors === 'object') {
    const first = Object.values(body.errors).flat().filter(Boolean);
    if (first.length) return first.join(' ');
  }
  if (typeof body === 'string' && body) return body;
  if (body?.message) return body.message;
  if (body?.detail) return body.detail;
  if (body?.title) return body.title;
  const fromText = body === null ? messageFromText(text) : null;
  if (fromText) return fromText;
  if (status === 401) return 'Please sign in to see this.';
  if (status === 403) return 'Your account is not allowed to do this (HTTP 403).';
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
    // The Vite dev proxy answers 502 when the back-end is down; Render answers 502/503/504 while it starts.
    // A 500 comes from the API itself (see messageFromText), so it is a real error, not "offline".
    const offline = [502, 503, 504].includes(res.status);
    if (offline) {
      throw new ApiError('The API could not be reached. Start the back-end and try again.', { status: res.status, offline: true });
    }
    throw new ApiError(messageFrom(data, res.status, text), { status: res.status, details: data });
  }
  return data;
}

export const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  del: (path) => request('DELETE', path),
};