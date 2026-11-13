/* Sign-in, sign-up completion and sign-out. Both dashboards and signin.html use these. */
import {
  api,
  ApiError,
  clearAuth,
  readAuth,
  saveAuth,
  setStoredUser,
} from "./client";

/** "9876543210", "+91 98765 43210" or an email address → what /otp/request/ wants. */
export function destinationOf(input) {
  const v = input.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { channel: "email", destination: v.toLowerCase() };
  const digits = v.replace(/[\s()-]/g, "");
  const m = /^(?:\+?91)?([6-9]\d{9})$/.exec(digits);
  return m ? { channel: "sms", destination: m[1] } : null;
}

export const requestOtp = (channel, destination, purpose) =>
  api("/v1/auth/otp/request/", {
    method: "POST",
    body: purpose ? { channel, destination, purpose } : { channel, destination },
    auth: false,
  });

/** Resets the password using a password_reset OTP. Returns the signed-in user if the backend issues tokens. */
export async function resetPassword(challengeId, code, password, remember = true) {
  const t = await api("/v1/auth/password/reset/", {
    method: "POST",
    body: { challengeId, code, password, confirmPassword: password },
    auth: false,
  });
  if (t?.access) saveAuth(t, remember);
  return t?.user ?? null;
}

export async function verifyOtp(challengeId, code, remember = true) {
  const t = await api("/v1/auth/otp/verify/", {
    method: "POST",
    body: { challengeId, code },
    auth: false,
  });
  saveAuth(t, remember);
  return t.user ?? fetchMe();
}

export async function googleSignIn(idToken, role, remember = true) {
  const t = await api("/v1/auth/google/", { method: "POST", body: { idToken, role }, auth: false });
  saveAuth(t, remember);
  return t.user ?? fetchMe();
}

export const PASSWORD_LOGIN = "/v1/auth/login/";

/** POST { identifier, password }: the identifier is an email or a 10-digit mobile number. Returns tokens + user. */
export async function passwordSignIn(d, password, remember = true) {
  const t = await api(PASSWORD_LOGIN, {
    method: "POST",
    body: { identifier: d.destination, password },
    auth: false,
  });
  saveAuth(t, remember);
  return t.user ?? fetchMe();
}

/** Sets a new password for the signed-in account. */
export async function changePassword(password) {
  await api("/v1/auth/password/change/", { method: "POST", body: { password, confirmPassword: password } });
}

export async function fetchMe() {
  const u = await api("/v1/auth/me/");
  const user = u?.user ?? u;
  setStoredUser(user);
  return user;
}

export async function completeSignup(d) {
  const body = { role: d.role, fullName: d.fullName.trim() };
  if (d.role === "brand" && d.brandName) body.brandName = d.brandName.trim();
  if (d.role === "creator" && d.displayName) body.displayName = d.displayName.trim();
  if (d.phone) body.phone = d.phone.trim();
  if (d.password) {
    body.password = d.password;
    body.confirmPassword = d.password;
  }
  const r = await api("/v1/auth/signup/complete/", { method: "POST", body });
  if (r?.access) saveAuth(r);
  const user = r?.user ?? r;
  if (user && user.id) setStoredUser(user);
  return user?.id ? user : fetchMe();
}

export async function signOut() {
  const t = readAuth();
  try {
    if (t?.refresh) await api("/v1/auth/logout/", { method: "POST", body: { refresh: t.refresh } });
  } catch {
    /* the tokens go anyway */
  }
  clearAuth();
}

/** Human wording for the auth error codes the backend documents. */
export function authMessage(e) {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (e.code) {
    case "AUTH_INVALID":
    case "INVALID_CREDENTIALS":
      return 'That email or number and password don\'t match. Try again, or use "Forgot password?" to sign in with a code.';
    case "OTP_INVALID":
      return "That code is wrong or has expired. Check it, or ask for a new one.";
    case "GOOGLE_TOKEN_INVALID":
      return "Google sign-in didn't go through. Please try again.";
    case "GOOGLE_EMAIL_UNVERIFIED":
      return "Your Google account's email isn't verified yet. Verify it with Google, or sign in with a code.";
    case "INVALID_PHONE":
      return "Enter a 10-digit Indian mobile number.";
    case "USER_EXISTS":
    case "EMAIL_EXISTS":
    case "PHONE_EXISTS":
    case "ALREADY_REGISTERED":
    case "DUPLICATE_EMAIL":
    case "DUPLICATE_PHONE":
      return "An account with this email or number already exists.";
    case "REAUTH_REQUIRED":
      return "Please use the Forgot password? flow to set a new password.";
    case "TIMEOUT":
      return "The server is starting up — this can take up to a minute on the free plan. Please wait a moment and try again.";
    default:
      return e.message;
  }
}
