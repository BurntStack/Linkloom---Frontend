/* Entry point. Import order is the prototype's <link>/<script> order: the cascade and the module side effects depend on it. */
import "./styles/core.css";
import "./styles/motion.css";
import "./screens/login/login.css";
import "./screens/setup/setup.css";
import "./screens/kyc/kyc.css";
import "./screens/profile/profile.css";
import "./screens/home/home.css";
import "./screens/jobs/jobs.css";
import "./screens/job/job.css";
import "./screens/bid/bid.css";
import "./screens/bids/bids.css";
import "./screens/active/active.css";
import "./screens/messages/messages.css";
import "./screens/earnings/earnings.css";
import "./styles/chrome.css";

import "./vendor-gsap";
import "./data/seed";
import { LLD } from "./core";
import { initSession } from "./session";
import "./ui/select";
import "./core/legacy-bridge"; // must stay here: after core and select, before anything that reads the globals
import "./motion/motion";
import "./screens/login/login";
import "./screens/setup/setup";
import "./screens/kyc/kyc";
import "./screens/profile/profile";
import "./screens/home/home";
import "./screens/jobs/jobs";
import "./screens/job/job";
import "./screens/bid/bid";
import "./screens/bids/bids";
import "./screens/active/active";
import "./screens/messages/messages";
import "./screens/earnings/earnings";

const ready = initSession();
if (ready === true) LLD.boot();
else if (ready) void ready.then(ok => ok && LLD.boot());
