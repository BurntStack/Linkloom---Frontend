const PINNED = new Date("2026-11-04T10:42:00+05:30");
export const today = () => (import.meta.env.VITE_TEST_HOOKS ? new Date(PINNED) : new Date());
