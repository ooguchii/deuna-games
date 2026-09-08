"use client";

import {
  useSyncExternalStore,
} from "react";

const ACCOUNT_AVATAR_CHANGED_EVENT =
  "deuna:account-avatar-changed";

type AvatarWindow = Window & {
  __deunaAccountAvatarRevision?: number;
};

function readClientRevision() {
  if (typeof window === "undefined") return 0;

  const value = (window as AvatarWindow).__deunaAccountAvatarRevision;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return 0;
  }

  return value;
}

function subscribe(listener: () => void) {
  window.addEventListener(
    ACCOUNT_AVATAR_CHANGED_EVENT,
    listener
  );

  return () => {
    window.removeEventListener(
      ACCOUNT_AVATAR_CHANGED_EVENT,
      listener
    );
  };
}

function getServerRevision() {
  return 0;
}

export function notifyAccountAvatarChanged() {
  const target = window as AvatarWindow;
  target.__deunaAccountAvatarRevision = readClientRevision() + 1;
  window.dispatchEvent(
    new CustomEvent(ACCOUNT_AVATAR_CHANGED_EVENT)
  );
}

export function useAccountAvatarRevision() {
  return useSyncExternalStore(
    subscribe,
    readClientRevision,
    getServerRevision
  );
}
