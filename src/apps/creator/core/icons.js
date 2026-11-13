const P = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
  bids: "M4 7h12M4 12h9M4 17h6M17 14l3 3-3 3",
  active: "M4 6h16v12H4zM4 10h16M9 14h6",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 13.5h2",
  chat: "M4 5h16v11H9l-5 4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  bell: "M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  check: "M5 12.5 10 17l9-10",
  close: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  filter: "M4 6h16M7 12h10M10 18h4",
  cal: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  pin: "M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  send: "M4 12 20 4l-6 16-3-7z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  flag: "M5 21V4h11l-2 4 2 4H5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
  camera: "M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  brief: "M3 6h18v12H3zM3 7l9 6 9-6",
  rail: "M7 12h3M14 12h3M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM19 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 8h6M9 11h6M11 8a3 3 0 0 1 0 6H9l4 3.5",
};

export function icon(n, cls = "") {
  if (n === "ig")
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>`;
  if (n === "yt")
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/></svg>`;
  if (n === "tw")
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.251 2.25H8.08l4.26 5.631 5.904-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  if (n === "li")
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M7 10v8M7 7.5h.01M11 10v8M11 13a3 3 0 0 1 6 0v5"/></svg>`;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || P.info}"/></svg>`;
}
