import { today } from "./clock";

export const inr = (paise, o = {}) => {
  const neg = paise < 0, p = Math.abs(Math.round(paise || 0));
  const r = Math.floor(p / 100), d = String(p % 100).padStart(2, "0");
  const s = "₹" + r.toLocaleString("en-IN") + (o.dec ? "." + d : "");
  return neg || o.sign ? "−" + s : s;
};
export const rupees = (n) => Math.round(n * 100);
export const compact = (n) =>
  n >= 1e5
    ? (n / 1e5).toFixed(n % 1e5 ? 1 : 0).replace(/\.0$/, "") + "L"
    : n >= 1e3
      ? Math.round(n / 1e3) + "K"
      : String(n);

export const FEE_EXAMPLE = 0;
export const payout = (paise) => ({ price: paise, fee: 0, net: paise });

export const D = (s) => new Date(s + (s.length === 10 ? "T12:00:00+05:30" : ""));
export const fmtDate = (s, o = {}) =>
  D(s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(o.year ? { year: "numeric" } : {}),
    timeZone: "Asia/Kolkata",
  });
const istDay = (d) => Math.floor((d.getTime() + 19800000) / 864e5);
export const daysLeft = (s) => istDay(D(s)) - istDay(today());
export const ago = (s) => {
  const m = Math.round((today().getTime() - D(s).getTime()) / 6e4);
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d + " days ago";
};
export const ageFrom = (dob) => {
  const t = today(), b = D(dob);
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
};
export const initials = (n) =>
  n.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
