import "server-only";

import { homeRankingDay } from "@/lib/home/ranking";

/**
 * Capture one UTC civil day outside React render purity. Home ranking already
 * scores recency by UTC day, so sub-day precision would add no information.
 */
export function getHomeRankingReferenceTime() {
  return homeRankingDay(Date.now());
}
