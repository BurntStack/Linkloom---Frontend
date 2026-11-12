/* What the shared sign-in page (signin.html) and the two dashboards agree on.
   signin.html is a separate document, so it leaves a one-shot note for the dashboard it opens, which turns it into that
   dashboard's normal session. Signing out goes the other way, back to signin.html.

   Stand-in until the real API exists, like the sessions in session.ts: any email and password are accepted, as the page
   itself says. This is a convenience, not security: the server has to enforce sign-in. */
export type Role = "creator" | "brand";

export interface SignInNote {
  /** Empty for "Continue with Google": the dashboard keeps the account's own address. */
  email: string;
  remember: boolean;
}

const key = (role: Role): string => `ll-signin-${role}`;

const storageWorks = (): boolean => {
  try {
    sessionStorage.setItem("ll-probe", "1");
    sessionStorage.removeItem("ll-probe");
    return true;
  } catch {
    return false;
  }
};

export function leaveSignInNote(role: Role, note: SignInNote): void {
  try {
    sessionStorage.setItem(key(role), JSON.stringify(note));
  } catch {
    /* no storage: the dashboard stays on its own sign-in screen, which works without it */
  }
}

export function takeSignInNote(role: Role): SignInNote | null {
  try {
    const raw = sessionStorage.getItem(key(role));
    sessionStorage.removeItem(key(role));
    return raw ? (JSON.parse(raw) as SignInNote) : null;
  } catch {
    return null;
  }
}

/** Signed-out arrivals start at the shared page, except on the account screens it links to.
    Returns false when the page is on its way out, so the dashboard should not boot. */
export function sendToSignInIfNeeded(role: Role, signedIn: boolean, accountRoutes: ReadonlySet<string>): boolean {
  const route = location.hash.slice(1).split("-")[0];
  if (signedIn || accountRoutes.has(route) || !storageWorks()) return true;
  location.replace(`signin.html?role=${role}`);
  return false;
}

/** The moment someone signs out, hand over to the shared page. An expired session stays put: the dashboard explains it. */
export function signInPageAfterSignOut(role: Role, isSignedIn: () => boolean, hasExpired: () => boolean): () => void {
  let was = isSignedIn();
  return () => {
    const now = isSignedIn();
    if (was && !now && !hasExpired()) location.href = `signin.html?role=${role}&out=1`;
    was = now;
  };
}

/** The way back to the marketing site, under the sidebar's nav. */
export function addSiteLink(): void {
  document.querySelector(".nav-note")?.insertAdjacentHTML("afterend", `<a class="nav-site" href="index.html">← linkloom.in</a>`);
}
