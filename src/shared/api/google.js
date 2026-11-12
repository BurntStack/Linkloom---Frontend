/* Google Identity Services. Google only issues an ID token from its own button (or One Tap), so the designed
   "Continue with Google" button gets Google's real button laid over it, invisible, at the same size.
   The page keeps its look; the click lands on Google's button. */
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "591280470035-mamos86blk66gpr7bufpv48ln9dntsef.apps.googleusercontent.com";

let loading = null;
let handler = null;

function load() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      const g = window.google;
      if (!g?.accounts?.id) return reject(new Error("Google sign-in did not load."));
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: r => r.credential && handler?.(r.credential),
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      resolve(g);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("Google sign-in could not load. Check your connection, or sign in with your password."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Lays Google's button over `button`. `onToken` gets the ID token after the person picks an account.
    Returns a function that removes the overlay. */
export function attachGoogle(button, onToken, onError) {
  handler = onToken;
  const host = document.createElement("div");
  host.className = "gsi-overlay";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "absolute",
    inset: "0",
    opacity: "0.001",
    overflow: "hidden",
    zIndex: "2",
    cursor: "pointer",
  });
  const parentStyle = getComputedStyle(button);
  if (parentStyle.position === "static") button.style.position = "relative";
  button.appendChild(host);
  let gone = false;
  load()
    .then(g => {
      if (gone) return;
      const width = Math.max(200, Math.min(400, Math.round(button.getBoundingClientRect().width || 320)));
      g.accounts.id.renderButton(host, { type: "standard", size: "large", width, text: "continue_with", shape: "pill" });
      const fit = () => host.querySelectorAll("div, iframe").forEach(n => {
        n.style.width = "100%";
        n.style.height = "100%";
        n.style.transform = "scale(1.6)";
        n.style.transformOrigin = "center";
      });
      setTimeout(fit, 50);
      setTimeout(fit, 600);
    })
    .catch(e => {
      host.remove();
      onError?.(e.message);
    });
  return () => {
    gone = true;
    host.remove();
  };
}

export const googleConfigured = () => !!CLIENT_ID;
