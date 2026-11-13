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
  let stop = () => {};
  load()
    .then(g => {
      if (gone) return;
      const width = Math.max(200, Math.min(400, Math.round(button.getBoundingClientRect().width || 320)));
      g.accounts.id.renderButton(host, { type: "standard", size: "large", width, text: "continue_with", shape: "pill" });
      /* Centre Google's iframe on the designed button and scale it once, just enough that Google's clickable button
         covers all of it. Do NOT stretch and scale every nested layer: the scaling compounds, pushes Google's real
         button below the designed one, and clicks land on nothing (the 2026-11-12 "Google login not working" bug).
         The iframe is the button plus Google's padding: 10 px each side, 2 px top and bottom. */
      const fit = () => {
        const ifr = host.querySelector("iframe");
        if (!ifr) return;
        host.querySelectorAll("div").forEach(n => {
          n.style.position = "static";
          n.style.transform = "none";
        });
        const w = ifr.offsetWidth || width + 20;
        const h = ifr.offsetHeight || 44;
        const s = Math.max(host.clientWidth / Math.max(1, w - 20), host.clientHeight / Math.max(1, h - 4)) * 1.04;
        Object.assign(ifr.style, {
          position: "absolute",
          left: "50%",
          top: "50%",
          margin: "0",
          transformOrigin: "center",
          transform: `translate(-50%, -50%) scale(${s.toFixed(3)})`,
        });
      };
      /* Google adds the iframe a moment after renderButton, and the designed button can change size */
      const mo = new MutationObserver(fit);
      mo.observe(host, { childList: true, subtree: true });
      const ro = new ResizeObserver(fit);
      ro.observe(host);
      stop = () => {
        mo.disconnect();
        ro.disconnect();
      };
      fit();
    })
    .catch(e => {
      host.remove();
      onError?.(e.message);
    });
  return () => {
    gone = true;
    stop();
    host.remove();
  };
}

export const googleConfigured = () => !!CLIENT_ID;
