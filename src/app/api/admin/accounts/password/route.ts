import type { NextRequest } from "next/server";

import {
  resetAdministratorPassword,
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
  adminAccountPasswordSchema,
} from "@/lib/admin/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["userId", "password"] as const;

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

  const parsed = adminAccountPasswordSchema.safeParse({
    userId: form.get("userId"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return adminRedirect(adminOrigin, "/admin/cuentas?estado=datos");
  }

  try {
    const changed = await resetAdministratorPassword(
      session.userId,
      parsed.data.userId,
      parsed.data.password
    );

    return adminRedirect(
      adminOrigin,
      changed
        ? "/admin/cuentas?estado=clave"
        : "/admin/cuentas?estado=no_encontrado"
    );
  } catch {
    return adminUnavailableResponse();
  }
}
