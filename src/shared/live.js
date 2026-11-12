/* Helpers both dashboards use to turn backend rows into the shapes the screens were designed around. */
import { paise } from "@/shared/api/client";

/** A stable chip colour for a name, so the same brand always gets the same colour. */
export function toneOf(key) {
  let h = 0;
  for (const ch of key || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (["c", "b", "y"])[h % 3];
}

export function initialsOf(name) {
  const w = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** "2026-11-22" from a date or timestamp; "" when missing. */
export const day = (v) => (typeof v === "string" && v ? v.slice(0, 10) : "");

export const isoOr = (v, fallback) => (typeof v === "string" && v ? v : fallback);

export const nowIso = () => new Date().toISOString();

export const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Whole calendar days from today (IST) to an ISO day. */
export function daysUntil(iso) {
  const a = Date.parse(iso.slice(0, 10) + "T12:00:00+05:30"),
    b = Date.parse(todayIst() + "T12:00:00+05:30");
  return Math.round((a - b) / 864e5);
}

export const addDaysIso = (iso, n) => {
  const d = new Date(iso.slice(0, 10) + "T12:00:00+05:30");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

export const amount = (m) => paise(m);

/** Backend platforms are free text; the screens know two. */
export const platformOf = (p) =>
  String(p || "")
    .toLowerCase()
    .includes("you")
    ? "youtube"
    : "instagram";

/** "1 Reel + 2 Stories" → "Reel". */
export function formatOf(deliverables, platform) {
  const d = String(deliverables || "").toLowerCase();
  if (d.includes("short")) return "Short";
  if (d.includes("carousel")) return "Carousel";
  if (d.includes("reel")) return "Reel";
  if (d.includes("video") || d.includes("vlog")) return "Video";
  if (d.includes("stor")) return "Story";
  return platformOf(platform) === "youtube" ? "Video" : "Reel";
}

/** Usage rights are an object since 2026-11-12; older rows are text. Either way screens get one line. */
export function usageText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  const r = v;
  const DUR = {
    perpetual: "Perpetual",
    "12m": "12 months",
    "6m": "6 months",
    "3m": "3 months",
  };
  const CH = { organic_social: "organic social", paid_ads: "paid ads" };
  const parts = [];
  const d = String(r.duration || "");
  if (d) parts.push(DUR[d] || d);
  const ch = Array.isArray(r.channels)
    ? r.channels.map(c => CH[c] || String(c).replace(/_/g, " "))
    : [];
  if (ch.length) parts.push(ch.join(" + "));
  if (r.exclusivity) parts.push("exclusive" + (r.exclusivityCategory ? ` in ${r.exclusivityCategory}` : ""));
  const t = String(r.territory || "");
  if (t) parts.push(t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1));
  return parts.join(" · ");
}

/** "1 Reel + 2 Stories" or a list → ["1 Reel", "2 Stories"]. */
export function listOf(v) {
  if (Array.isArray(v))
    return v
      .map(x => (typeof x === "string" ? x : String(x?.title ?? "")))
      .filter(Boolean);
  return String(v || "")
    .split(/\s*(?:\+|\n|;|•)\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** "Mumbai, Maharashtra" → ["Mumbai", "Maharashtra"]. */
export function splitLocation(loc) {
  const parts = String(loc || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return [parts[0] || "", parts.slice(1).join(", ")];
}

/** A party name out of whatever object the backend nests ({ name }, { displayName }, { brandName }). */
export function nameOf(o, fallback = "") {
  if (!o) return fallback;
  if (typeof o === "string") return o;
  return String(o.name || o.displayName || o.brandName || o.fullName || o.title || fallback);
}

export function idOf(o) {
  if (!o) return "";
  if (typeof o === "string") return o;
  return String(o.id ?? "");
}

/** Per-account extras the backend has no field for yet, kept on this device. */
export function extras(scope, userId) {
  const key = `ll-extra-${scope}-${userId}`;
  return {
    get() {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}");
      } catch {
        return {};
      }
    },
    set(v) {
      try {
        localStorage.setItem(key, JSON.stringify({ ...this.get(), ...v }));
      } catch {
        /* storage blocked: the extra is kept for this visit only */
      }
    },
  };
}

/** Runs loaders side by side; a failing one returns its fallback and is reported, the rest still load. */
export async function settle(p, fallback, label, errors) {
  try {
    return await p;
  } catch (e) {
    const code = e?.status;
    if (code !== 404 && code !== 403) errors.push(label);
    return fallback;
  }
}
