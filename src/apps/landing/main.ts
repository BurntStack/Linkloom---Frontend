/* Landing page entry. Import order is the original page's script order: each section reads helpers from window.LL. */
import "./landing.css";
import "../../shared/analytics";
import "./vendor";
import "./core";
import "./hero";
import "./steps";
import "./sides";
import "./trust";
import "./platforms";
import "./cta";
import "./footer";

(window as unknown as { LL: { boot(): void } }).LL.boot();
