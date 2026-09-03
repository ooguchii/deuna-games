import { z } from "zod";

export const accountRewardClaimSchema = z.object({
  intent: z.literal("claim"),
});
