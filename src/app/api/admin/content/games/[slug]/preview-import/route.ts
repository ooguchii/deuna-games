import type { NextRequest } from "next/server";

import { adminRedirect, authorizeAdminFormRequest } from "@/lib/admin/admin-route";
import { expectedRevisionSchema } from "@/lib/admin/content-forms";
import { getEditorialItem, saveGameMediaDraft } from "@/lib/admin/content-service";
import { hasExactAdminFormFields } from "@/lib/admin/request-security";
import { storeEditorialPreviewVideoFromPath } from "@/lib/media/editorial-video";
import {
  prepareStagedEditorialPreviewForTrim,
  removeStagedEditorialPreviewSource,
  resolveStagedEditorialPreviewSource,
} from "@/lib/media/editorial-video-staging";
import {
  withSavedGameVideoClip,
  type GameVideoTarget,
} from "@/lib/media/game-video-media";
import {
  DEFAULT_PREVIEW_FPS,
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  parsePreviewFps,
  parsePreviewQuality,
  parsePreviewTrimWindow,
  parsePreviewViewport,
} from "@/lib/media/preview-video-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreviewSaveTarget = GameVideoTarget | "library";

const legacyFields = ["expectedRevision", "sourceToken", "startSeconds", "endSeconds"] as const;
const qualityFields = [...legacyFields, "quality"] as const;
const viewportFields = [
  ...qualityFields,
  "viewportX",
  "viewportY",
  "viewportZoom",
  "viewportAspect",
] as const;
const targetViewportFields = [...viewportFields, "target"] as const;
const targetViewportFpsFields = [...viewportFields, "fps", "target"] as const;

function previewTarget(value: string | null): PreviewSaveTarget | null {
  if (value === null || value.trim() === "") return "card";
  const normalized = value.trim().toLowerCase();
  return normalized === "cover" ||
    normalized === "hero" ||
    normalized === "card" ||
    normalized === "library"
    ? normalized
    : null;
}

function errorState(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("FFmpeg no está disponible") || message.includes("FFprobe no está disponible")) return "ffmpeg";
  if (message.includes("supera el límite seguro") || message.includes("demasiado pesado")) return "video-pesado";
  if (message.includes("recorte")) return "preview-recorte-invalido";
  return "video-invalido";
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const authorized = await authorizeAdminFormRequest(request);
  if (!authorized.authorized) return authorized.response;
  const { slug } = await context.params;
  const redirectTarget = `/admin/juegos/${encodeURIComponent(slug)}`;

  const hasTargetViewportFpsFields = hasExactAdminFormFields(authorized.form, targetViewportFpsFields);
  const hasTargetViewportFields = !hasTargetViewportFpsFields && hasExactAdminFormFields(authorized.form, targetViewportFields);
  const hasViewportFields = !hasTargetViewportFpsFields && !hasTargetViewportFields && hasExactAdminFormFields(authorized.form, viewportFields);
  const hasQualityFields = !hasTargetViewportFpsFields && !hasTargetViewportFields && !hasViewportFields && hasExactAdminFormFields(authorized.form, qualityFields);
  const isLegacyRequest = !hasTargetViewportFpsFields && !hasTargetViewportFields && !hasViewportFields && !hasQualityFields && hasExactAdminFormFields(authorized.form, legacyFields);

  if (!hasTargetViewportFpsFields && !hasTargetViewportFields && !hasViewportFields && !hasQualityFields && !isLegacyRequest) {
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=solicitud&seccion=multimedia`);
  }

  const revision = expectedRevisionSchema.safeParse(authorized.form.get("expectedRevision"));
  const sourceToken = authorized.form.get("sourceToken")?.trim() ?? "";
  const trim = parsePreviewTrimWindow(authorized.form.get("startSeconds"), authorized.form.get("endSeconds"));
  const target = previewTarget(
    hasTargetViewportFpsFields || hasTargetViewportFields
      ? authorized.form.get("target")
      : null
  );
  const quality = isLegacyRequest
    ? DEFAULT_PREVIEW_QUALITY
    : parsePreviewQuality(authorized.form.get("quality"));
  const fps = hasTargetViewportFpsFields
    ? parsePreviewFps(authorized.form.get("fps"))
    : DEFAULT_PREVIEW_FPS;
  const viewport = hasTargetViewportFpsFields || hasTargetViewportFields || hasViewportFields
    ? parsePreviewViewport(
        authorized.form.get("viewportX"),
        authorized.form.get("viewportY"),
        authorized.form.get("viewportZoom"),
        authorized.form.get("viewportAspect")
      )
    : DEFAULT_PREVIEW_VIEWPORT;

  if (!trim) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-recorte-invalido&seccion=multimedia`);
  if (!target) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-destino-invalido&seccion=multimedia`);
  if (!quality) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-calidad-invalida&seccion=multimedia`);
  if (!fps) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-fps-invalido&seccion=multimedia`);
  if (!viewport) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-encuadre-invalido&seccion=multimedia`);
  if (!revision.success || !/^[a-f0-9]{48}$/.test(sourceToken)) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-source-expirada&seccion=multimedia`);

  try {
    const item = await getEditorialItem("game", slug);
    if (!item) return adminRedirect(authorized.adminOrigin, "/admin/juegos?estado=no-encontrado");
    if (item.revision !== revision.data) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=conflicto&seccion=multimedia`);
    const source = await resolveStagedEditorialPreviewSource(slug, authorized.session.userId, sourceToken);
    if (!source) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-source-expirada&seccion=multimedia`);

    const prepared = await prepareStagedEditorialPreviewForTrim(source, trim);
    try {
      const upload = await storeEditorialPreviewVideoFromPath(
        slug,
        prepared.filePath,
        prepared.trim,
        quality,
        target === "card" ? "card" : "hero",
        fps
      );

      if (target === "library") {
        await removeStagedEditorialPreviewSource(sourceToken);
        return adminRedirect(
          authorized.adminOrigin,
          `${redirectTarget}?estado=recurso-subido&seccion=multimedia`
        );
      }

      const media = withSavedGameVideoClip(
        item.payload,
        target,
        upload.publicPath,
        viewport
      );
      const result = await saveGameMediaDraft(
        slug,
        revision.data,
        authorized.session.userId,
        media
      );
      if (result.outcome === "not_found") return adminRedirect(authorized.adminOrigin, "/admin/juegos?estado=no-encontrado");
      if (result.outcome === "conflict") return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=conflicto&seccion=multimedia`);
      await removeStagedEditorialPreviewSource(sourceToken);
      return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-subido&seccion=multimedia`);
    } finally {
      await prepared.cleanup();
    }
  } catch (error) {
    console.error("No se pudo preparar el video remoto:", error instanceof Error ? error.message : "error no identificado");
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=${errorState(error)}&seccion=multimedia`);
  }
}
