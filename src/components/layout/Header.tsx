import {
  getAccountGamePreferences,
} from "@/lib/accounts/personalization-service";
import {
  readAccountSession,
} from "@/lib/accounts/session";
import {
  resolveAccountUpdateNotifications,
  type AccountUpdateNotification,
} from "@/lib/accounts/update-notifications";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  getPublicResolvedUpdates,
} from "@/lib/updates/public-updates";

import HeaderClient from "./HeaderClient";

export default async function Header() {
  const [config, session] = await Promise.all([
    getPublicSiteConfig(),
    readAccountSession(),
  ]);
  let notifications: AccountUpdateNotification[] | null = [];

  if (session) {
    try {
      const [preferences, updates] = await Promise.all([
        getAccountGamePreferences(session.userId),
        getPublicResolvedUpdates(),
      ]);
      notifications = resolveAccountUpdateNotifications(
        preferences,
        updates
      );
    } catch {
      notifications = null;
    }
  }

  return (
    <HeaderClient
      siteName={config.name}
      accountAuthenticated={Boolean(session)}
      accountNotifications={notifications}
    />
  );
}
