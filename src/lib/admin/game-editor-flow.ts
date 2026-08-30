export type GameEditorSection =
  | "ficha"
  | "datos"
  | "requisitos"
  | "multimedia"
  | "descargas";

export type GameEditorContinuation =
  | Exclude<GameEditorSection, "ficha">
  | "publicacion";

const nextSection: Record<
  GameEditorSection,
  GameEditorContinuation
> = {
  ficha: "datos",
  datos: "requisitos",
  requisitos: "multimedia",
  multimedia: "descargas",
  descargas: "publicacion",
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
