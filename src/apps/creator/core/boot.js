/* boot: sets up the data-go global click handler (used by screen-rendered HTML).
   React handles shell rendering; LLD.boot is overridden in main.jsx to mount React. */
import { go } from "./router";

export const boot = () => {
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-go]");
    if (a) {
      e.preventDefault();
      go(a.dataset.go);
    }
  });
};
