import AdminShell from "@/components/admin/AdminShell";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await verifyAdminSession();

  return (
    <AdminShell session={session}>
      {children}
    </AdminShell>
  );
}
