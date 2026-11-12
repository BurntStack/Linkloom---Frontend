export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function $(s, c = document) {
  return c.querySelector(s);
}

export function $$(s, c = document) {
  return [...c.querySelectorAll(s)];
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, ch => ESCAPES[ch]);

export function liquid(root = document) {
  $$(".lq", root).forEach(b => {
    if (b.querySelector(":scope > .t")) return;
    const label = b.innerHTML.trim();
    b.innerHTML = `<span class="t">${label}</span><span class="t2" aria-hidden="true">${label}</span>`;
  });
}
