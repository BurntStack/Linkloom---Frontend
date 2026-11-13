/* DOM helpers shared by every screen. */

/** Read once at load, like the prototype. Motion reads the media query live; screens read this. */
export const RM: boolean = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** querySelector. Returns null on no match, like the DOM; a screen that knows the node exists asserts it with `!`. */
export function $<K extends keyof HTMLElementTagNameMap>(
  s: K,
  c?: ParentNode,
): HTMLElementTagNameMap[K] | null;
export function $<E extends Element = HTMLElement>(s: string, c?: ParentNode): E | null;
export function $(s: string, c: ParentNode = document): Element | null {
  return c.querySelector(s);
}

/** querySelectorAll, as a real array. */
export function $$<K extends keyof HTMLElementTagNameMap>(s: K, c?: ParentNode): HTMLElementTagNameMap[K][];
export function $$<E extends Element = HTMLElement>(s: string, c?: ParentNode): E[];
export function $$(s: string, c: ParentNode = document): Element[] {
  return [...c.querySelectorAll(s)];
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML-escapes any value for use in a template. Null and undefined become "". */
export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, ch => ESCAPES[ch]);

/* liquid buttons: <a class="lq lq-p">Label</a> -> label roll markup */
export function liquid(root: ParentNode = document): void {
  $$(".lq", root).forEach(b => {
    if (b.querySelector(":scope > .t")) return;
    const label = b.innerHTML.trim();
    b.innerHTML = `<span class="t">${label}</span><span class="t2" aria-hidden="true">${label}</span>`;
  });
}
