/* Sign-in, sign-up completion and sign-out. Both dashboards and signin.html use these. */
import {
  api,
  ApiError,
  clearAuth,
  readAuth,
  saveAuth,
  setStoredUser,
  type ApiUser,
  type Role,
  type Tokens,
} from "./client";

export type OtpChannel = "sms" | "email";

export interface OtpChallenge {
  challengeId: string;
  expiresIn: number;
}

/** An email address → what /otp/request/ and /login/ want. Sign-in, sign-up and one-time codes are email-only:
    there is no mobile-number sign-in anywhere in the app (2026-11-13). */
export function emailDestination(input: string): { channel: OtpChannel; destination: string } | null {
  const v = input.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { channel: "email", destination: v.toLowerCase() } : null;
}

export const requestOtp = (channel: OtpChannel, destination: string): Promise<OtpChallenge> =>
  api<OtpChallenge>("/v1/auth/otp/request/", { method: "POST", body: { channel, destination }, auth: false });

export async function verifyOtp(challengeId: string, code: string, remember = true): Promise<ApiUser> {
  const t = await api<Tokens>("/v1/auth/otp/verify/", {
    method: "POST",
    body: { challengeId, code },
    auth: false,
  });
  saveAuth(t, remember);
  return t.user!;
}

export async function googleSignIn(idToken: string, role: Role, remember = true): Promise<ApiUser> {
  const t = await api<Tokens>("/v1/auth/google/", { method: "POST", body: { idToken, role }, auth: false });
  saveAuth(t, remember);
  return t.user!;
}

/* ---------- passwords ----------
   Sign-up checks the email once with a one-time code and sets the password in /signup/complete/.
   After that the account signs in with its email and password (Collab Backend API Reference v1, section 2.1). */
export const PASSWORD_LOGIN = "/v1/auth/login/";

/** POST { identifier, password }: the identifier is the account's email. Returns tokens + user. */
export async function passwordSignIn(
  d: { channel: OtpChannel; destination: string },
  password: string,
  remember = true,
): Promise<ApiUser> {
  const t = await api<Tokens>(PASSWORD_LOGIN, {
    method: "POST",
    body: { identifier: d.destination, password },
    auth: false,
  });
  saveAuth(t, remember);
  return t.user ?? fetchMe();
}

/** Sets a new password for the signed-in account. Within 10 minutes of signing in with a code or Google the old
    password is not needed, which is how "Forgot password?" and code-only accounts get one. */
export async function changePassword(password: string): Promise<void> {
  await api("/v1/auth/password/change/", { method: "POST", body: { password, confirmPassword: password } });
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
  /** Sent with confirmPassword. The backend rejects any field it doesn't know, so nothing else goes in the body. */
  password?: string;
}

export async function completeSignup(d: SignupDetails): Promise<ApiUser> {
  const body: Record<string, string> = { role: d.role, fullName: d.fullName.trim() };
  if (d.role === "brand" && d.brandName) body.brandName = d.brandName.trim();
  if (d.role === "creator" && d.displayName) body.displayName = d.displayName.trim();
  if (d.password) {
    body.password = d.password;
    body.confirmPassword = d.password;
  }
  const r = await api<ApiUser | Tokens | { user: ApiUser }>("/v1/auth/signup/complete/", {
    method: "POST",
    body,
  });
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
    case "AUTH_INVALID":
    case "INVALID_CREDENTIALS":
      return 'That email and password don\'t match. Try again, or use "Forgot password?" to get a code by email.';
    case "OTP_INVALID":
      return "That code is wrong or has expired. Check it, or ask for a new one.";
    case "OTP_DELIVERY_FAILED":
      return "We couldn't email the code just now. Check the address, then try again in a minute.";
    case "GOOGLE_TOKEN_INVALID":
      return "Google sign-in didn't go through. Please try again.";
    case "GOOGLE_EMAIL_UNVERIFIED":
      return "Your Google account's email isn't verified yet. Verify it with Google, or sign in with your email.";
    default:
      return e.message;
  }
}
