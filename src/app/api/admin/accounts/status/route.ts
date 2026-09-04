import type { NextRequest } from "next/server";

import {
  setAdministratorActive,
} from "@/lib/admin/account-service";
import { reauthenticateAdmin } from "@/lib/admin/auth-service";
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
  adminAccountStatusSchema,
} from "@/lib/admin/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = ["userId", "active", "currentPassword"] as const;

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

  const parsed = adminAccountStatusSchema.safeParse({
    userId: form.get("userId"),
    active: form.get("active"),
    currentPassword: form.get("currentPassword"),
  });

  if (!parsed.success) {
    return adminRedirect(adminOrigin, "/admin/cuentas?estado=datos");
  }

  try {
    if (!(await reauthenticateAdmin(session.userId, parsed.data.currentPassword))) {
      return adminRedirect(adminOrigin, "/admin/cuentas?estado=reauth");
    }
    const changed = await setAdministratorActive(
      session.userId,
      parsed.data.userId,
      parsed.data.active
    );

    return adminRedirect(
      adminOrigin,
      changed
        ? `/admin/cuentas?estado=${parsed.data.active ? "activado" : "desactivado"}`
        : "/admin/cuentas?estado=no_encontrado"
    );
  } catch {
    return adminUnavailableResponse();
  }
}
