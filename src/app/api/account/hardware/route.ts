import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  findCpuById,
  findGpuById,
} from "@/features/game-finder/hardware-catalog";
import {
  clearAccountHardwareProfile,
  saveAccountHardwareProfile,
} from "@/lib/accounts/personalization-service";
import {
  accountHardwareSchema,
} from "@/lib/accounts/personalization-validation";
import {
  hasExactAccountFormFields,
  readTrustedAccountForm,
} from "@/lib/accounts/request-security";
import {
  readAccountSessionToken,
  resolveAccountSession,
} from "@/lib/accounts/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fields = [
  "intent",
  "cpuId",
  "gpuId",
  "ramGb",
  "memoryMode",
] as const;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const session = await resolveAccountSession(
    await readAccountSessionToken()
  );

  if (!session) {
    return json({ ok: false, error: "sesion" }, 401);
  }

  const form = await readTrustedAccountForm(request);

  if (!form || !hasExactAccountFormFields(form, fields)) {
    return json({ ok: false, error: "solicitud" }, 400);
  }

  const parsed = accountHardwareSchema.safeParse({
    intent: form.get("intent"),
    cpuId: form.get("cpuId"),
    gpuId: form.get("gpuId"),
    ramGb: form.get("ramGb"),
    memoryMode: form.get("memoryMode"),
  });

  if (!parsed.success) {
    return json({ ok: false, error: "datos" }, 400);
  }

  try {
    if (parsed.data.intent === "clear") {
      await clearAccountHardwareProfile(session.userId);
      return json({ ok: true });
    }

    const cpu = findCpuById(parsed.data.cpuId);
    const gpu = findGpuById(parsed.data.gpuId);
    const ramGb = Number(parsed.data.ramGb);

    if (
      !cpu ||
      !gpu ||
      !Number.isFinite(ramGb) ||
      ramGb < 1 ||
      ramGb > 256
    ) {
      return json({ ok: false, error: "hardware" }, 400);
    }

    await saveAccountHardwareProfile(session.userId, {
      cpuId: cpu.id,
      gpuId: gpu.id,
      ramGb: Math.round(ramGb * 10) / 10,
      memoryMode: parsed.data.memoryMode,
    });

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "servicio" }, 503);
  }
}
