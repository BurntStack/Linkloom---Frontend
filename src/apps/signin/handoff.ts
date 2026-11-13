/* What the shared sign-in page (signin.html) and the two dashboards share. Signing in and out happens on signin.html;
   the dashboards only link back to it. */
export type Role = "creator" | "brand";

/** The way back to the marketing site, under the sidebar's nav. */
export function addSiteLink(): void {
  document
    .querySelector(".nav-note")
    ?.insertAdjacentHTML("afterend", `<a class="nav-site" href="index.html">← linkloom.in</a>`);
}
