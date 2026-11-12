/* Live updates over a WebSocket. A ticket from POST /v1/realtime/ticket/ works once, within 30 s.
   Events: connected, new_message { conversationId, message }, notification { notification }.
   On every reconnect the dashboards refetch, because events sent while offline are not replayed. */
import { api, API_BASE, isSignedIn } from "./client";

const listeners = new Set();
let ws = null;
let ping = null;
let retry = 0;
let started = false;
let timer = null;

export const onLive = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

async function connect() {
  if (!isSignedIn()) return;
  try {
    const t = await api("/v1/realtime/ticket/", { method: "POST" });
    const base = API_BASE.replace(/^http/, "ws");
    ws = new WebSocket(`${base}${t.path || "/ws/"}?ticket=${encodeURIComponent(t.ticket)}`);
  } catch {
    schedule();
    return;
  }
  ws.onopen = () => {
    retry = 0;
    ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25000);
  };
  ws.onmessage = m => {
    let e;
    try {
      e = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (!("event" in e)) return;
    listeners.forEach(f => {
      try {
        f(e);
      } catch (err) {
        console.error(err);
      }
    });
  };
  ws.onclose = () => {
    if (ping) clearInterval(ping);
    ping = null;
    ws = null;
    schedule();
  };
}

function schedule() {
  if (!started || timer) return;
  const wait = Math.min(30000, 1000 * 2 ** retry++) + Math.random() * 500;
  timer = setTimeout(() => {
    timer = null;
    void connect();
  }, wait);
}

export function startLive() {
  if (started) return;
  started = true;
  void connect();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !ws && !timer) void connect();
  });
}

export function stopLive() {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
  ws?.close();
}
