/* What the shared sign-in page and the two dashboards agree on. */

const key = (role) => `ll-signin-${role}`;

const storageWorks = () => {
  try {
    sessionStorage.setItem("ll-probe", "1");
    sessionStorage.removeItem("ll-probe");
    return true;
  } catch {
    return false;
  }
};

export function leaveSignInNote(role, note) {
  try {
    sessionStorage.setItem(key(role), JSON.stringify(note));
  } catch {
    /* no storage */
  }
}

export function takeSignInNote(role) {
  try {
    const raw = sessionStorage.getItem(key(role));
    sessionStorage.removeItem(key(role));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function sendToSignInIfNeeded(role, signedIn, accountRoutes) {
  const route = location.hash.slice(1).split("-")[0];
  if (signedIn || accountRoutes.has(route) || !storageWorks()) return true;
  location.replace(`signin.html?role=${role}`);
  return false;
}

export function signInPageAfterSignOut(role, isSignedIn, hasExpired) {
  let was = isSignedIn();
  return () => {
    const now = isSignedIn();
    if (was && !now && !hasExpired()) location.href = `signin.html?role=${role}&out=1`;
    was = now;
  };
}

export function addSiteLink() {
  document.querySelector(".nav-note")?.insertAdjacentHTML("afterend", `<a class="nav-site" href="index.html">← linkloom.in</a>`);
}
