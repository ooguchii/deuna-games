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
  accountAvatarDigest: string | null;
};

export default function HeaderClient({
  accountAvatarDigest,
  ...props
}: HeaderClientProps) {
  const accountAvatarUrl =
    props.accountIdentity && accountAvatarDigest
      ? `/api/account/avatar?v=${encodeURIComponent(accountAvatarDigest)}`
      : null;

  return (
    <HeaderClientBase
      {...props}
      accountAvatarUrl={accountAvatarUrl}
    />
  );
}
