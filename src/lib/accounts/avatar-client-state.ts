"use client";

import {
  useSyncExternalStore,
} from "react";

let revision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getRevision() {
  return revision;
}

function getServerRevision() {
  return 0;
}

export function notifyAccountAvatarChanged() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function useAccountAvatarRevision() {
  return useSyncExternalStore(
    subscribe,
    getRevision,
    getServerRevision
  );
}