/* KYC gate: first tap on Bid checks verification and keeps the job */
import { go } from "./router";
import { store } from "./store";

export const kycGate = (jobId) => {
  const k = store.s.kyc;
  if (k.status === "verified") {
    go("#bid-" + jobId);
    return true;
  }
  store.set(s => {
    s.kyc.returnTo = "#bid-" + jobId;
  }, "kyc-return");
  go("#kyc");
  return false;
};
