import {
  getAccountAvatarMetadata,
} from "@/lib/accounts/avatar-service";
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
  let accountAvatarDigest: string | null = null;

  if (session) {
    const [resolvedNotifications, avatarMetadata] = await Promise.all([
      Promise.all([
        getAccountGamePreferences(session.userId),
        getPublicResolvedUpdates(),
      ])
        .then(([preferences, updates]) =>
          resolveAccountUpdateNotifications(preferences, updates)
        )
        .catch(() => null),
      getAccountAvatarMetadata(session.userId).catch(() => null),
    ]);

    notifications = resolvedNotifications;
    accountAvatarDigest = avatarMetadata?.digest ?? null;
  }

  return (
    <HeaderClient
      siteName={config.name}
      accountIdentity={
        session
          ? {
              username: session.username,
              displayName: session.displayName,
            }
          : null
      }
      accountNotifications={notifications}
      accountAvatarDigest={accountAvatarDigest}
    />
  );
}
