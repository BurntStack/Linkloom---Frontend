/* The one place the frontend talks to the backend.

   Backend contract (collab-api):
   - Every response is { success, data, error: { code, message, details, requestId }, meta: { nextCursor, hasMore } }.
   - JWT bearer auth. The access token lasts 15 minutes; POST /v1/auth/token/refresh/ { refresh } renews it.
   - Lists take ?limit= (max 50) and ?cursor= from meta.nextCursor.
   - Money is { amount: paise, currency: "INR" }.

   Tokens live in localStorage when the person ticked "Remember me", otherwise in sessionStorage for this tab. */
const DEFAULT_BASE = "https://collab-api-ewju.onrender.com";
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
const AUTH_KEY = "ll-auth";

/** The parity build runs on the prototype's sample data and must never call the server. */
export const apiEnabled = (): boolean => !import.meta.env.VITE_TEST_HOOKS;

export type Role = "creator" | "brand";

export interface ApiUser {
  id: string;
  role: Role | null;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  needsOnboarding?: boolean;
  /** false for accounts made with a one-time code before passwords existed (2026-11-12). */
  hasPassword?: boolean;
  kycStatus?: KycState;
  [k: string]: unknown;
}

export type KycState = "not_started" | "in_progress" | "pending" | "verified" | "rejected";

export interface Tokens {
  access: string;
  refresh: string;
  user?: ApiUser | null;
}

export interface Money {
  amount: number;
  currency: string;
}

/* ---------- token storage ---------- */

const stores = (): Storage[] => {
  const out: Storage[] = [];
  try {
    out.push(localStorage);
  } catch {
    /* blocked */
  }
  try {
    out.push(sessionStorage);
  } catch {
    /* blocked */
  }
  return out;
};

export function readAuth(): Tokens | null {
  for (const s of stores()) {
    try {
      const raw = s.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw) as Tokens;
    } catch {
      /* unreadable: try the next one */
    }
  }
  return null;
}

export function saveAuth(t: Tokens, remember?: boolean): void {
  const prev = readAuth();
  const keep =
    remember ??
    (() => {
      try {
        return !!localStorage.getItem(AUTH_KEY);
      } catch {
        return false;
      }
    })();
  const next: Tokens = {
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

export function setStoredUser(user: ApiUser): void {
  const t = readAuth();
  if (t) saveAuth({ ...t, user });
}

export function clearAuth(): void {
  for (const s of stores()) {
    try {
      s.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }
}

export const getToken = (): string | null => readAuth()?.access ?? null;
export const isSignedIn = (): boolean => !!readAuth()?.refresh;
export const storedUser = (): ApiUser | null => readAuth()?.user ?? null;

/* ---------- errors ---------- */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = "",
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** First message for a field from a VALIDATION_ERROR, if the server named one. */
  field(name: string): string | null {
    const d = this.details as Record<string, unknown> | null;
    const v = d && typeof d === "object" ? d[name] : null;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    if (typeof v === "string") return v;
    return null;
  }
}

const OFFLINE = "We couldn't reach Linkloom. Check your connection and try again.";
const FALLBACK = "Something went wrong. Please try again.";
/** A 5xx: the server failed, whatever the person typed. Its own message ("Something went wrong.") reads like a wrong password. */
const SERVER_DOWN = "Linkloom's server had a problem. Please try again in a minute.";

/** Called once when the session can no longer be refreshed. The dashboards send the person to sign-in. */
let onSessionLost: (() => void) | null = null;
export const setSessionLostHandler = (f: () => void): void => {
  onSessionLost = f;
};

/* ---------- requests ---------- */

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** false for sign-in calls: never send a token and never try to refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown } | null;
  meta?: { nextCursor?: string | null; hasMore?: boolean } | null;
}

const url = (path: string, query?: RequestOptions["query"]): string => {
  const u = new URL(API_BASE + path);
  if (query)
    for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
};

/** "ok": a fresh access token is stored. "rejected": the backend says the session is over (signed out, revoked, or
    past its 7 days). "failed": the server couldn't be reached or errored, so nothing is known and the session stays. */
type Renewal = "ok" | "rejected" | "failed";

let refreshing: Promise<Renewal> | null = null;

/* The backend rotates the refresh token on every renewal and rejects the old one. Two tabs renewing at the same moment
   would send the same token, and the slower one would be told the session expired, signing every tab out. So renewals
   queue on a lock shared by all of this site's tabs, and a tab that finds the stored token already replaced by another
   tab simply uses the new one. */
function renew(): Promise<Renewal> {
  if (refreshing) return refreshing;
  const started = readAuth()?.refresh;
  if (!started) return Promise.resolve("rejected");
  const run = async (): Promise<Renewal> => {
    const t = readAuth();
    if (!t?.refresh) return "rejected";
    if (t.refresh !== started) return "ok"; // another tab renewed while this one waited
    try {
      const res = await fetch(url("/v1/auth/token/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: t.refresh }),
      });
      if (res.status === 401 || res.status === 400) {
        const now = readAuth();
        if (now?.refresh && now.refresh !== t.refresh) return "ok"; // renewed by a tab without the lock (older browsers)
        clearAuth();
        return "rejected";
      }
      const env = (await res.json().catch(() => null)) as Envelope<{
        access: string;
        refresh?: string;
      }> | null;
      const d = env?.data;
      if (!res.ok || !d?.access) return "failed";
      if (!readAuth()) return "rejected"; // signed out in another tab meanwhile
      saveAuth({ access: d.access, refresh: d.refresh || t.refresh, user: t.user });
      return "ok";
    } catch {
      return "failed";
    }
  };
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  refreshing = (locks?.request ? locks.request("ll-auth-refresh", run) : run()).finally(() =>
    setTimeout(() => (refreshing = null), 0),
  );
  return refreshing;
}

/** Renews the access token once, however many requests (and tabs) are waiting on it. */
export const refreshSession = (): Promise<boolean> => renew().then(r => r === "ok");

/** True when the access token is a JWT whose expiry has passed (or is seconds away). Anything unreadable is "not known". */
function expired(token: string): boolean {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const exp = Number(JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).exp);
    return exp > 0 && exp * 1000 < Date.now() + 10_000;
  } catch {
    return false;
  }
}

async function raw<T>(
  path: string,
  o: RequestOptions,
  retried = false,
): Promise<{ data: T; meta: Envelope<T>["meta"] }> {
  const useAuth = o.auth !== false;
  let token = useAuth ? getToken() : null;
  /* A returning visitor's 15-minute token has almost always run out: renew it first rather than spend a round trip on a 401. */
  if (token && !retried && expired(token) && (await refreshSession())) token = getToken();
  let res: Response;
  try {
    res = await fetch(url(path, o.query), {
      method: o.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(o.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      signal: o.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, OFFLINE, "NETWORK");
  }
  if (res.status === 204) return { data: undefined as T, meta: null };
  const env = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.status === 401 && useAuth && token && !retried) {
    const r = await renew();
    if (r === "ok") return raw<T>(path, o, true);
    /* Couldn't renew because the server is asleep, restarting or offline: keep the person signed in and let them retry.
       Only the backend rejecting the session itself ends it. */
    if (r === "failed") throw new ApiError(0, navigator.onLine === false ? OFFLINE : SERVER_DOWN, "NETWORK");
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
  return { data: (env && "data" in env ? env.data : env) as T, meta: env?.meta ?? null };
}

/** One request; resolves to `data`. */
export async function api<T>(path: string, o: RequestOptions = {}): Promise<T> {
  return (await raw<T>(path, o)).data;
}

/** One page of a list. */
export async function apiPage<T>(
  path: string,
  o: RequestOptions = {},
): Promise<{ items: T[]; next: string | null }> {
  const r = await raw<T[]>(path, o);
  return {
    items: Array.isArray(r.data) ? r.data : [],
    next: r.meta?.hasMore === false ? null : (r.meta?.nextCursor ?? null),
  };
}

/** Every page of a list, up to `max` rows. */
export async function apiAll<T>(path: string, o: RequestOptions = {}, max = 500): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: T[]; next: string | null } = await apiPage<T>(path, {
      ...o,
      query: { limit: 50, ...o.query, ...(cursor ? { cursor } : {}) },
    });
    out.push(...page.items);
    cursor = page.next;
  } while (cursor && out.length < max);
  return out;
}

/* ---------- small helpers shared by both dashboards ---------- */

export const paise = (m: Money | number | null | undefined): number =>
  m == null ? 0 : typeof m === "number" ? m : Math.round(Number(m.amount) || 0);

/** The form the backend expects for money it is sent. */
export const money = (p: number): Money => ({ amount: Math.round(p), currency: "INR" });

/** Random key for POSTs that must not run twice. */
export const idemKey = (): string =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now();
