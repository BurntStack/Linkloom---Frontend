/* What the creator dashboard starts from in the real app: no rows. src/creator/live/creator.ts fills it from the API.
   vite.config.ts serves this file in place of seed.ts in every build except the parity one. */
import { emptyCreatorState } from "@/creator/live/creator";
import type { State } from "@/creator/types";

export const seed: State = emptyCreatorState();
