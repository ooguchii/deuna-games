export type GameEditorSection =
  | "ficha"
  | "datos"
  | "requisitos"
  | "rendimiento"
  | "multimedia"
  | "descargas"
  | "valoracion";

export type GameEditorContinuation =
  | Exclude<GameEditorSection, "ficha">
  | "publicacion";

const nextSection: Record<
  GameEditorSection,
  GameEditorContinuation
> = {
  ficha: "datos",
  datos: "requisitos",
  requisitos: "rendimiento",
  rendimiento: "multimedia",
  multimedia: "descargas",
  descargas: "valoracion",
  valoracion: "publicacion",
};

export function requestedGameEditorContinuation(
  requestUrl: { searchParams: URLSearchParams },
  current: GameEditorSection
): GameEditorContinuation | null {
  const requested = requestUrl.searchParams.get("continuar");

  return requested === nextSection[current]
    ? requested
    : null;
}

export function gameEditorSuccessTarget(
  basePath: string,
  current: GameEditorSection,
  continuation: GameEditorContinuation | null
) {
  if (continuation === "publicacion") {
    return `${basePath}/publicacion`;
  }

  const section = continuation ?? current;
  return `${basePath}?estado=guardado&seccion=${section}`;
}
