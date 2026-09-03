import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";

import HeaderClient from "./HeaderClient";

export default async function Header() {
  const config = await getPublicSiteConfig();

  return (
    <HeaderClient siteName={config.name} />
  );
}
