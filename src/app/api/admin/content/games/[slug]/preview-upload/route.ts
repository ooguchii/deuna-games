import { rm } from "node:fs/promises";
import type { NextRequest } from "next/server";

import { adminRedirect } from "@/lib/admin/admin-route";
import { expectedRevisionSchema } from "@/lib/admin/content-forms";
import { getEditorialItem, saveGameMediaDraft } from "@/lib/admin/content-service";
import { authorizeAdminStreamingMediaRequest } from "@/lib/admin/streaming-media-admin-route";
import { storeEditorialPreviewVideoFromPath } from "@/lib/media/editorial-video";
import {
  withSavedGameVideoClip,
  type GameVideoTarget,
} from "@/lib/media/game-video-media";
import {
  DEFAULT_PREVIEW_FPS,
  DEFAULT_PREVIEW_QUALITY,
  DEFAULT_PREVIEW_VIEWPORT,
  MAX_PREVIEW_SOURCE_BYTES,
  parsePreviewFps,
  parsePreviewQuality,
  parsePreviewTrimWindow,
  parsePreviewViewport,
} from "@/lib/media/preview-video-policy";
import { isAcceptedStreamedPreviewSource, stageStreamedPreviewSource } from "@/lib/media/streamed-preview-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PreviewSaveTarget = GameVideoTarget | "library";

function contentLengthFromRequest(request: NextRequest) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

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
  const authorized = await authorizeAdminStreamingMediaRequest(request);
  if (!authorized.authorized) return authorized.response;
  const { slug } = await context.params;
  const redirectTarget = `/admin/juegos/${encodeURIComponent(slug)}`;
  const contentLength = contentLengthFromRequest(request);
  const contentType = request.headers.get("content-type") ?? "";
  const extension = request.headers.get("x-deuna-source-extension") ?? "";
  const revision = expectedRevisionSchema.safeParse(request.headers.get("x-deuna-expected-revision"));
  const trim = parsePreviewTrimWindow(request.headers.get("x-deuna-trim-start"), request.headers.get("x-deuna-trim-end"));
  const target = previewTarget(request.headers.get("x-deuna-preview-target"));
  const qualityHeader = request.headers.get("x-deuna-preview-quality");
  const quality = qualityHeader === null || qualityHeader.trim() === ""
    ? DEFAULT_PREVIEW_QUALITY
    : parsePreviewQuality(qualityHeader);
  const fpsHeader = request.headers.get("x-deuna-preview-fps");
  const fps = fpsHeader === null || fpsHeader.trim() === ""
    ? DEFAULT_PREVIEW_FPS
    : parsePreviewFps(fpsHeader);

  const viewportHeaders = [
    request.headers.get("x-deuna-viewport-x"),
    request.headers.get("x-deuna-viewport-y"),
    request.headers.get("x-deuna-viewport-zoom"),
    request.headers.get("x-deuna-viewport-aspect"),
  ] as const;
  const hasViewportHeaders = viewportHeaders.some(
    (value) => value !== null && value.trim() !== ""
  );
  const viewport = hasViewportHeaders
    ? parsePreviewViewport(...viewportHeaders)
    : DEFAULT_PREVIEW_VIEWPORT;

  if (!trim) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-recorte-invalido&seccion=multimedia`);
  if (!target) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-destino-invalido&seccion=multimedia`);
  if (!quality) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-calidad-invalida&seccion=multimedia`);
  if (!fps) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-fps-invalido&seccion=multimedia`);
  if (!viewport) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-encuadre-invalido&seccion=multimedia`);
  if (!revision.success || !request.body || (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_PREVIEW_SOURCE_BYTES)) || !isAcceptedStreamedPreviewSource(`source${extension}`, contentType, contentLength)) {
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=video-invalido&seccion=multimedia`);
  }
  let temporaryDirectory: string | null = null;
  try {
    const item = await getEditorialItem("game", slug);
    if (!item) return adminRedirect(authorized.adminOrigin, "/admin/juegos?estado=no-encontrado");
    if (item.revision !== revision.data) return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=conflicto&seccion=multimedia`);
    const staged = await stageStreamedPreviewSource(request.body, contentLength);
    temporaryDirectory = staged.directory;
    const upload = await storeEditorialPreviewVideoFromPath(
      slug,
      staged.filePath,
      trim,
      quality,
      target === "card" ? "card" : "hero",
      fps
    );

    if (target === "library") {
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
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=preview-subido&seccion=multimedia`);
  } catch (error) {
    console.error("No se pudo preparar el video editorial:", error instanceof Error ? error.message : "error no identificado");
    return adminRedirect(authorized.adminOrigin, `${redirectTarget}?estado=${errorState(error)}&seccion=multimedia`);
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
