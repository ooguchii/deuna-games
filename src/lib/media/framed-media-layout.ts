import { resolvePreviewViewportCrop } from "@/lib/media/preview-video-policy";
import type { GameVideoViewport } from "@/types/game";

export type FramedMediaLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function resolveFramedMediaLayout(
  sourceWidth: number,
  sourceHeight: number,
  viewport: GameVideoViewport,
  frameWidth: number,
  frameHeight: number
): FramedMediaLayout | null {
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return null;
  }

  const crop = resolvePreviewViewportCrop(
    sourceWidth,
    sourceHeight,
    viewport
  );
  if (!crop) return null;

  // La ventana editorial cubre el destino y el recurso completo se desplaza
  // alrededor de su centro. Esta función no recorta ni recodifica bytes.
  const scale = Math.max(
    frameWidth / crop.width,
    frameHeight / crop.height
  );
  const cropCenterX = crop.x + crop.width / 2;
  const cropCenterY = crop.y + crop.height / 2;

  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    left: frameWidth / 2 - cropCenterX * scale,
    top: frameHeight / 2 - cropCenterY * scale,
  };
}
