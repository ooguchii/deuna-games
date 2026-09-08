"use client";

import type {
  AccountUpdateNotification,
} from "@/lib/accounts/update-notifications";

import HeaderClientBase from "./HeaderClientBase";

type HeaderClientProps = {
  siteName: string;
  accountIdentity: {
    username: string;
    displayName: string | null;
  } | null;
  accountNotifications: AccountUpdateNotification[] | null;
  accountAvatarVersion: string | null;
};

export default function HeaderClient({
  accountAvatarVersion,
  ...props
}: HeaderClientProps) {
  const accountAvatarUrl =
    props.accountIdentity && accountAvatarVersion
      ? `/api/account/avatar?v=${encodeURIComponent(accountAvatarVersion)}`
      : null;

  return (
    <HeaderClientBase
      {...props}
      accountAvatarUrl={accountAvatarUrl}
    />
  );
}
