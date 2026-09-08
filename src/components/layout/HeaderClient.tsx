"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ACCOUNT_AVATAR_CHANGED_EVENT,
} from "@/lib/accounts/avatar-events";
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
};

type AvatarState = {
  key: string;
  url: string;
};

export default function HeaderClient(props: HeaderClientProps) {
  const [revision, setRevision] = useState(0);
  const [avatar, setAvatar] = useState<AvatarState | null>(null);
  const avatarKey = props.accountIdentity
    ? `${props.accountIdentity.username}:${revision}`
    : null;

  useEffect(() => {
    const handleAvatarChanged = () => {
      setRevision((current) => current + 1);
    };

    window.addEventListener(
      ACCOUNT_AVATAR_CHANGED_EVENT,
      handleAvatarChanged
    );

    return () => {
      window.removeEventListener(
        ACCOUNT_AVATAR_CHANGED_EVENT,
        handleAvatarChanged
      );
    };
  }, []);

  useEffect(() => {
    if (!avatarKey) return;

    let active = true;
    let objectUrl: string | null = null;

    void fetch(`/api/account/avatar?r=${revision}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (response.status === 204 || !response.ok) return null;

        const blob = await response.blob();
        return blob.size > 0 && blob.type === "image/webp"
          ? blob
          : null;
      })
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatar({
          key: avatarKey,
          url: objectUrl,
        });
      })
      .catch(() => {});

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarKey, revision]);

  const accountAvatarUrl = avatar?.key === avatarKey
    ? avatar.url
    : null;

  return (
    <HeaderClientBase
      {...props}
      accountAvatarUrl={accountAvatarUrl}
    />
  );
}
