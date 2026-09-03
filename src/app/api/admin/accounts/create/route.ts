import type { NextRequest } from "next/server";

import {
  createAdministrator,
} from "@/lib/admin/account-service";
import {
  adminRedirect,
  adminUnavailableResponse,
} from "@/lib/admin/admin-route";
import {
  getAdminOrigin,
} from "@/lib/admin/database-config";
import {
  hasExactAdminFormFields,
  readTrustedAdminForm,
} from "@/lib/admin/request-security";
import {
  verifyAdminOwnerSession,
} from "@/lib/admin/session";
import {
  adminCreateAccountSchema,
} from "@/lib/admin/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["username", "password", "displayName"] as const;

export async function POST(request: NextRequest) {
  const session = await verifyAdminOwnerSession();
  let adminOrigin: string;
  let form: URLSearchParams | null;

  try {
    adminOrigin = getAdminOrigin();
    form = await readTrustedAdminForm(request, adminOrigin);
  } catch {
    return adminUnavailableResponse();
  }

  if (!form || !hasExactAdminFormFields(form, fields)) {
    return adminRedirect(adminOrigin, "/admin/cuentas?estado=solicitud");
  }

  const parsed = adminCreateAccountSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
    displayName: form.get("displayName"),
  });

  if (!parsed.success) {
    return adminRedirect(adminOrigin, "/admin/cuentas?estado=datos");
  }

  try {
    const result = await createAdministrator(session.userId, parsed.data);

    return adminRedirect(
      adminOrigin,
      result.created
        ? "/admin/cuentas?estado=creado"
        : "/admin/cuentas?estado=usuario"
    );
  } catch {
    return adminUnavailableResponse();
  }
}
