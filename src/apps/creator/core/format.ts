/* Money and dates. Money is always integer paise. */
import type { IsoDate, IsoDay, Paise } from "../types";
import { today } from "./clock";

export interface InrOptions {
  /** Always show the paise: "₹12,500.00". */
  dec?: boolean;
  /** Force the minus sign: "−₹12,500". */
  sign?: boolean;
}

export const inr = (paise: Paise, o: InrOptions = {}): string => {
  // 1250000 -> "₹12,500"; o.dec -> "₹12,500.00"; o.sign -> "−₹..."
  const neg = paise < 0,
    p = Math.abs(Math.round(paise || 0));
  const r = Math.floor(p / 100),
    d = String(p % 100).padStart(2, "0");
  const s = "₹" + r.toLocaleString("en-IN") + (o.dec ? "." + d : "");
  return neg || o.sign ? "−" + s : s;
};
export const rupees = (n: number): Paise => Math.round(n * 100); // rupees -> paise (inputs only)
export const compact = (n: number): string =>
  n >= 1e5
    ? (n / 1e5).toFixed(n % 1e5 ? 1 : 0).replace(/\.0$/, "") + "L"
    : n >= 1e3
      ? Math.round(n / 1e3) + "K"
      : String(n);

/* Linkloom runs on a creator subscription: no per-deal platform fee. Creator receives the agreed price; tax/withholding is 'as per confirmed rules'. */
export const FEE_EXAMPLE = 0;
export interface Payout {
  price: Paise;
  fee: Paise;
  net: Paise;
}
export const payout = (paise: Paise): Payout => ({ price: paise, fee: 0, net: paise });

/** Parses an ISO day (read as noon IST) or a full timestamp. */
export const D = (s: IsoDate): Date => new Date(s + (s.length === 10 ? "T12:00:00+05:30" : ""));
export const fmtDate = (s: IsoDate, o: { year?: boolean } = {}): string =>
  D(s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(o.year ? { year: "numeric" } : {}),
    timeZone: "Asia/Kolkata",
  });
const istDay = (d: Date): number => Math.floor((d.getTime() + 19800000) / 864e5); // calendar day in IST
export const daysLeft = (s: IsoDate): number => istDay(D(s)) - istDay(today());
export const ago = (s: IsoDate): string => {
  const m = Math.round((today().getTime() - D(s).getTime()) / 6e4);
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d + " days ago";
};
export const ageFrom = (dob: IsoDay): number => {
  const t = today(),
    b = D(dob);
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
};

export const initials = (n: string): string =>
  n
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
