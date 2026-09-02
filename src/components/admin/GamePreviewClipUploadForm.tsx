import GameVideoLibraryEditor from "@/components/admin/GameVideoLibraryEditor";

type Props = {
  slug: string;
  revision: number;
  currentPreview?: string;
};

/**
 * Compatibilidad temporal de importación para la página del editor de juegos.
 * La creación de videos ya no administra destinos: sólo agrega un WebM a la
 * biblioteca compartida. Hero/Card se asignan y encuadran desde Multimedia.
 */
export default function GamePreviewClipUploadForm({
  slug,
  revision,
}: Props) {
  return (
    <GameVideoLibraryEditor
      slug={slug}
      revision={revision}
    />
  );
}
