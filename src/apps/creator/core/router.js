/* router: #name or #name-param — React-compatible version.
   React (App.jsx / useHashRoute) owns the DOM; this module keeps the views registry and helpers. */

export const views = {};

export const register = (name, def) => {
  views[name] = def;
};

export const go = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

export const getCurrent = () => {
  const h = location.hash.replace(/^#/, "");
  const i = h.indexOf("-");
  return i < 0 ? { name: h, param: null } : { name: h.slice(0, i), param: h.slice(i + 1) };
};

/** Dispatches lld-route so React's useHashRoute increments the render key (force re-render). */
export const route = () => {
  window.dispatchEvent(new CustomEvent("lld-route"));
};

let _guard = null;
export const setRouteGuard = (g) => { _guard = g; };
export const getGuard = () => _guard;

let _guestRoutes = new Set();
export const setGuestRoutes = (r) => { _guestRoutes = r; };
export const getGuestRoutes = () => _guestRoutes;
