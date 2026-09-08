"use client";

import {
  type CSSProperties,
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
import styles from "./HeaderClientAvatar.module.css";

type HeaderClientProps = {
  siteName: string;
  accountIdentity: {
    username: string;
    displayName: string | null;
  } | null;
  accountNotifications: AccountUpdateNotification[] | null;
};

type AvatarStyle = CSSProperties & {
  "--account-avatar-image"?: string;
  "--account-avatar-icon-opacity"?: string;
};

export default function HeaderClient(props: HeaderClientProps) {
  const [revision, setRevision] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    setAvatarUrl(null);

    if (!props.accountIdentity) return;

    let active = true;
    let objectUrl: string | null = null;

    void fetch(`/api/account/avatar?r=${revision}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.blob();
      })
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      })
      .catch(() => {
        if (active) setAvatarUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.accountIdentity, revision]);

  const avatarStyle: AvatarStyle = avatarUrl
    ? {
        "--account-avatar-image": `url("${avatarUrl}")`,
        "--account-avatar-icon-opacity": "0",
      }
    : {};

  return (
    <div className={styles.scope} style={avatarStyle}>
      <HeaderClientBase {...props} />
    </div>
  );
}
