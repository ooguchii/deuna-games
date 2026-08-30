"use client";

import {
  createContext,
  type ReactNode,
  useContext,
} from "react";

import {
  sourcePublicPagesConfig,
  type PublicPagesConfig,
} from "@/data/public-pages-config";

type FinderCopy = PublicPagesConfig["finder"];

const PublicFinderCopyContext = createContext<FinderCopy>(
  sourcePublicPagesConfig.finder
);

export function PublicFinderCopyProvider({
  copy,
  children,
}: {
  copy: FinderCopy;
  children: ReactNode;
}) {
  return (
    <PublicFinderCopyContext.Provider value={copy}>
      {children}
    </PublicFinderCopyContext.Provider>
  );
}

export function usePublicFinderCopy() {
  return useContext(PublicFinderCopyContext);
}
