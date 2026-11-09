/* Sign-in, sign-up completion and sign-out. Both dashboards and signin.html use these. */
import { api, ApiError, clearAuth, readAuth, saveAuth, setStoredUser, type ApiUser, type Role, type Tokens } from "./client";

export type OtpChannel = "sms" | "email";

export interface OtpChallenge {
  challengeId: string;
  expiresIn: number;
}

/** "9876543210", "+91 98765 43210" or an email address → what /otp/request/ wants. */
export function destinationOf(input: string): { channel: OtpChannel; destination: string } | null {
  const v = input.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { channel: "email", destination: v.toLowerCase() };
  const digits = v.replace(/[\s()-]/g, "");
  const m = /^(?:\+?91)?([6-9]\d{9})$/.exec(digits);
  return m ? { channel: "sms", destination: m[1] } : null;
}

export const requestOtp = (channel: OtpChannel, destination: string): Promise<OtpChallenge> =>
  api<OtpChallenge>("/v1/auth/otp/request/", { method: "POST", body: { channel, destination }, auth: false });

export async function verifyOtp(challengeId: string, code: string, remember = true): Promise<ApiUser> {
  const t = await api<Tokens>("/v1/auth/otp/verify/", { method: "POST", body: { challengeId, code }, auth: false });
  saveAuth(t, remember);
  return t.user!;
}

export async function googleSignIn(idToken: string, role: Role, remember = true): Promise<ApiUser> {
  const t = await api<Tokens>("/v1/auth/google/", { method: "POST", body: { idToken, role }, auth: false });
  saveAuth(t, remember);
  return t.user!;
}

export async function fetchMe(): Promise<ApiUser> {
  const u = await api<ApiUser | { user: ApiUser }>("/v1/auth/me/");
  const user = (u as { user?: ApiUser }).user ?? (u as ApiUser);
  setStoredUser(user);
  return user;
}

export interface SignupDetails {
  role: Role;
  fullName: string;
  brandName?: string;
  displayName?: string;
}

export async function completeSignup(d: SignupDetails): Promise<ApiUser> {
  const body: Record<string, string> = { role: d.role, fullName: d.fullName.trim() };
  if (d.role === "brand" && d.brandName) body.brandName = d.brandName.trim();
  if (d.role === "creator" && d.displayName) body.displayName = d.displayName.trim();
  const r = await api<ApiUser | Tokens | { user: ApiUser }>("/v1/auth/signup/complete/", { method: "POST", body });
  if ((r as Tokens).access) saveAuth(r as Tokens);
  const user = (r as { user?: ApiUser }).user ?? (r as ApiUser);
  if (user && user.id) setStoredUser(user);
  return user?.id ? user : fetchMe();
}

export async function signOut(): Promise<void> {
  const t = readAuth();
  try {
    if (t?.refresh) await api("/v1/auth/logout/", { method: "POST", body: { refresh: t.refresh } });
  } catch {
    /* the tokens go anyway */
  }
  clearAuth();
}

/** Human wording for the auth error codes the backend documents. */
export function authMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (e.code) {
    case "OTP_INVALID":
      return "That code is wrong or has expired. Check it, or ask for a new one.";
    case "GOOGLE_TOKEN_INVALID":
      return "Google sign-in didn't go through. Please try again.";
    case "GOOGLE_EMAIL_UNVERIFIED":
      return "Your Google account's email isn't verified yet. Verify it with Google, or sign in with a code.";
    case "INVALID_PHONE":
      return "Enter a 10-digit Indian mobile number.";
    default:
      return e.message;
  }
}
