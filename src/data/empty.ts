/* What the creator dashboard starts from in the real app: no rows. src/live/creator.ts fills it from the API.
   vite.config.ts serves this file in place of seed.ts in every build except the parity one. */
import { emptyCreatorState } from "@/live/creator";
import type { State } from "@/types";

export const seed: State = emptyCreatorState();
