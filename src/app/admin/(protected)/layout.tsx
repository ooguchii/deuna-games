import AdminShell from "@/components/admin/AdminShell";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import { getPublicSiteConfig } from "@/lib/site/public-site-config";

import "../admin-professional.css";
import "../admin-professional-details.css";
import "../admin-theme-contract.css";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, siteConfig] = await Promise.all([
    verifyAdminSession(),
    getPublicSiteConfig(),
  ]);

  return (
    <AdminShell
      session={session}
      siteName={siteConfig.name}
      siteShortName={siteConfig.shortName}
    >
      <div className="admin-professional">
        {children}
      </div>
    </AdminShell>
  );
}
