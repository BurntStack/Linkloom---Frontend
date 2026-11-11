/* The clock. The parity build compares against the prototype, whose sample data is written relative to a pinned moment,
   so only that build pins "now". The real app uses the device's time; dates from the server are absolute. */
const PINNED = new Date("2026-11-04T10:42:00+05:30");
export const today = (): Date => (import.meta.env.VITE_TEST_HOOKS ? new Date(PINNED) : new Date());
