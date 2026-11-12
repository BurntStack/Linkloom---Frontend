/* The libraries the landing page loaded from CDNs, at the same versions. Its sections read them from window. */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

Object.assign(window, { gsap, ScrollTrigger, Lenis });
