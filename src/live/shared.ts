/* Helpers both dashboards use to turn backend rows into the shapes the screens were designed around. */
import { paise, type Money } from "@/api/client";

export type Tone = "c" | "b" | "y";

/** A stable chip colour for a name, so the same brand always gets the same colour. */
export function toneOf(key: string): Tone {
  let h = 0;
  for (const ch of key || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (["c", "b", "y"] as const)[h % 3];
}

export function initialsOf(name: string): string {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** "2026-11-22" from a date or timestamp; "" when missing. */
export const day = (v: unknown): string => (typeof v === "string" && v ? v.slice(0, 10) : "");

export const isoOr = (v: unknown, fallback: string): string => (typeof v === "string" && v ? v : fallback);

export const nowIso = (): string => new Date().toISOString();

export const todayIst = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Whole calendar days from today (IST) to an ISO day. */
export function daysUntil(iso: string): number {
  const a = Date.parse(iso.slice(0, 10) + "T12:00:00+05:30"),
    b = Date.parse(todayIst() + "T12:00:00+05:30");
  return Math.round((a - b) / 864e5);
}

export const addDaysIso = (iso: string, n: number): string => {
  const d = new Date(iso.slice(0, 10) + "T12:00:00+05:30");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

export const amount = (m: Money | number | null | undefined): number => paise(m);

/** Backend platforms are free text; the screens know two. */
export const platformOf = (p: unknown): "instagram" | "youtube" =>
  String(p || "").toLowerCase().includes("you") ? "youtube" : "instagram";

/** "1 Reel + 2 Stories" → "Reel". */
export function formatOf(deliverables: unknown, platform?: string): "Reel" | "Video" | "Carousel" | "Short" | "Story" {
  const d = String(deliverables || "").toLowerCase();
  if (d.includes("short")) return "Short";
  if (d.includes("carousel")) return "Carousel";
  if (d.includes("reel")) return "Reel";
  if (d.includes("video") || d.includes("vlog")) return "Video";
  if (d.includes("stor")) return "Story";
  return platformOf(platform) === "youtube" ? "Video" : "Reel";
}

/** "1 Reel + 2 Stories" or a list → ["1 Reel", "2 Stories"]. */
export function listOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => (typeof x === "string" ? x : String((x as { title?: string })?.title ?? ""))).filter(Boolean);
  return String(v || "")
    .split(/\s*(?:\+|\n|;|•)\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** "Mumbai, Maharashtra" → ["Mumbai", "Maharashtra"]. */
export function splitLocation(loc: unknown): [string, string] {
  const parts = String(loc || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return [parts[0] || "", parts.slice(1).join(", ")];
}

/** A party name out of whatever object the backend nests ({ name }, { displayName }, { brandName }). */
export function nameOf(o: unknown, fallback = ""): string {
  if (!o) return fallback;
  if (typeof o === "string") return o;
  const r = o as Record<string, unknown>;
  return String(r.name || r.displayName || r.brandName || r.fullName || r.title || fallback);
}

export function idOf(o: unknown): string {
  if (!o) return "";
  if (typeof o === "string") return o;
  return String((o as { id?: unknown }).id ?? "");
}

/** Per-account extras the backend has no field for yet, kept on this device. */
export function extras<T extends object>(scope: string, userId: string): { get(): Partial<T>; set(v: Partial<T>): void } {
  const key = `ll-extra-${scope}-${userId}`;
  return {
    get() {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}") as Partial<T>;
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
export async function settle<T>(p: Promise<T>, fallback: T, label: string, errors: string[]): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const code = (e as { status?: number })?.status;
    if (code !== 404 && code !== 403) errors.push(label);
    return fallback;
  }
}
