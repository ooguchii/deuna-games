"use client";

import { useEffect } from "react";

export default function AccountDashboardEntryViewNormalizer() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("vista")) return;

    url.searchParams.delete("vista");
    const search = url.searchParams.toString();
    const normalized = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;

    window.history.replaceState(window.history.state, "", normalized);
  }, []);

  return null;
}
