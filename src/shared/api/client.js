/* The one place the frontend talks to the backend.

   Backend contract (collab-api):
   - Every response is { success, data, error: { code, message, details, requestId }, meta: { nextCursor, hasMore } }.
   - JWT bearer auth. The access token lasts 15 minutes; POST /v1/auth/token/refresh/ { refresh } renews it.
   - Lists take ?limit= (max 50) and ?cursor= from meta.nextCursor.
   - Money is { amount: paise, currency: "INR" }.

   Tokens live in localStorage when the person ticked "Remember me", otherwise in sessionStorage for this tab. */
const DEFAULT_BASE = "https://collab-api-ewju.onrender.com";
/* In dev (vite serve) without an explicit base URL, use the Vite proxy (/v1 → backend) so
   the browser sees same-origin requests and CORS never applies. */
export const API_BASE = (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL)
  ? ""
  : (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
const AUTH_KEY = "ll-auth";

/** The parity build runs on the prototype's sample data and must never call the server. */
export const apiEnabled = () => !import.meta.env.VITE_TEST_HOOKS;

const stores = () => {
  const out = [];
  try { out.push(localStorage); } catch { /* blocked */ }
  try { out.push(sessionStorage); } catch { /* blocked */ }
  return out;
};

export function readAuth() {
  for (const s of stores()) {
    try {
      const raw = s.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* unreadable: try the next one */
    }
  }
  return null;
}

export function saveAuth(t, remember) {
  const prev = readAuth();
  const keep =
    remember ??
    (() => {
      try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; }
    })();
  const next = {
    access: t.access,
    refresh: t.refresh || prev?.refresh || "",
    user: t.user ?? prev?.user ?? null,
  };
  clearAuth();
  try {
    (keep ? localStorage : sessionStorage).setItem(AUTH_KEY, JSON.stringify(next));
  } catch {
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(next));
    } catch {
      /* no storage at all: the person signs in again after a reload */
    }
  }
}

export function setStoredUser(user) {
  const t = readAuth();
  if (t) saveAuth({ ...t, user });
}

export function clearAuth() {
  for (const s of stores()) {
    try { s.removeItem(AUTH_KEY); } catch { /* ignore */ }
  }
}

export const getToken = () => readAuth()?.access ?? null;
export const isSignedIn = () => !!readAuth()?.refresh;
export const storedUser = () => readAuth()?.user ?? null;

export class ApiError extends Error {
  constructor(status, message, code = "", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** First message for a field from a VALIDATION_ERROR, if the server named one. */
  field(name) {
    const d = this.details;
    const v = d && typeof d === "object" ? d[name] : null;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    if (typeof v === "string") return v;
    return null;
  }
}

const OFFLINE = "We couldn't reach Linkloom. Check your connection and try again.";
const WAKING = "The server is starting up — this can take up to a minute on the free plan. Please wait a moment and try again.";
const FALLBACK = "Something went wrong. Please try again.";
/** A 5xx: the server failed, whatever the person typed. Its own message ("Something went wrong.") reads like a wrong password. */
const SERVER_DOWN = "Linkloom's server had a problem. Please try again in a minute.";

const TIMEOUT_MS = 25_000;

/** Called once when the session can no longer be refreshed. The dashboards send the person to sign-in. */
let onSessionLost = null;
export const setSessionLostHandler = (f) => { onSessionLost = f; };

const url = (path, query) => {
  const u = new URL((API_BASE || location.origin) + path);
  if (query)
    for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
};

let refreshing = null;

/** Renews the access token once, however many requests are waiting on it. */
export function refreshSession() {
  if (refreshing) return refreshing;
  const t = readAuth();
  if (!t?.refresh) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const res = await fetch(url("/v1/auth/token/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: t.refresh }),
      });
      if (res.status === 401 || res.status === 400) {
        clearAuth();
        return false;
      }
      const env = await res.json().catch(() => null);
      const d = env?.data;
      if (!res.ok || !d?.access) return false;
      saveAuth({ access: d.access, refresh: d.refresh || t.refresh, user: t.user });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

/** True when the access token is a JWT whose expiry has passed (or is seconds away). */
function expired(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const exp = Number(JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).exp);
    return exp > 0 && exp * 1000 < Date.now() + 10_000;
  } catch {
    return false;
  }
}

async function raw(path, o, retried = false) {
  const useAuth = o.auth !== false;
  let token = useAuth ? getToken() : null;
  if (token && !retried && expired(token) && (await refreshSession())) token = getToken();

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  if (o.signal) o.signal.addEventListener("abort", () => ctrl.abort(), { once: true });

  let res;
  try {
    res = await fetch(url(path, o.query), {
      method: o.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(tid);
    if (e?.name === "AbortError") {
      if (o.signal?.aborted) throw e;
      throw new ApiError(0, WAKING, "TIMEOUT");
    }
    throw new ApiError(0, OFFLINE, "NETWORK");
  }
  clearTimeout(tid);
  if (res.status === 204) return { data: undefined, meta: null };
  const env = await res.json().catch(() => null);
  if (res.status === 401 && useAuth && token && !retried) {
    if (await refreshSession()) return raw(path, o, true);
    clearAuth();
    onSessionLost?.();
  }
  if (!res.ok || env?.success === false) {
    const err = env?.error;
    const msg =
      res.status >= 500
        ? SERVER_DOWN
        : typeof err?.message === "string" && err.message
          ? err.message
          : FALLBACK;
    throw new ApiError(res.status, msg, err?.code || "", err?.details ?? null);
  }
  return { data: (env && "data" in env ? env.data : env), meta: env?.meta ?? null };
}

/** One request; resolves to `data`. */
export async function api(path, o = {}) {
  return (await raw(path, o)).data;
}

/** One page of a list. */
export async function apiPage(path, o = {}) {
  const r = await raw(path, o);
  if (!Array.isArray(r.data)) {
    console.error(`apiPage: expected array from ${path}, got ${typeof r.data}`);
  }
  return {
    items: Array.isArray(r.data) ? r.data : [],
    next: r.meta?.hasMore === false ? null : (r.meta?.nextCursor ?? null),
  };
}

/** Every page of a list, up to `max` rows. */
export async function apiAll(path, o = {}, max = 500) {
  const out = [];
  let cursor = null;
  do {
    const page = await apiPage(path, {
      ...o,
      query: { limit: 50, ...o.query, ...(cursor ? { cursor } : {}) },
    });
    out.push(...page.items);
    cursor = page.next;
  } while (cursor && out.length < max);
  return out;
}

export const paise = (m) =>
  m == null ? 0 : typeof m === "number" ? m : Math.round(Number(m.amount) || 0);

/** The form the backend expects for money it is sent. */
export const money = (p) => ({ amount: Math.round(p), currency: "INR" });

/** Random key for POSTs that must not run twice. */
export const idemKey = () =>
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
