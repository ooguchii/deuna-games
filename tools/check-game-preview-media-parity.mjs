import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const preview = await readFile(
  path.join(
    root,
    "src/app/admin/(protected)/juegos/[slug]/vista-previa/page.tsx"
  ),
  "utf8"
);
const failures = [];

function requireAll(...needles) {
  for (const needle of needles) {
    if (!preview.includes(needle)) {
      failures.push(
        `La vista previa editorial debe reutilizar el contrato público: ${needle}`
      );
    }
  }
}

function forbid(needle, message) {
  if (preview.includes(needle)) failures.push(message);
}

requireAll(
  'import GameDetailContainerMedia from "@/components/games/GameDetailContainerMedia"',
  'import GameGalleryVideo from "@/components/games/GameGalleryVideo"',
  'import GameCoverMedia from "@/components/ui/GameCoverMedia"',
  "resolvePublicGameGalleryItems",
  "galleryImageViewport",
  "getGameGalleryAccessibleFallback",
  "resolveGameImageCropAspectRatio",
  'resolveGameDestinationImage(game, "detail")',
  'resolveGameDestinationMediaMode(game, "detail")',
  "<GameDetailContainerMedia",
  "video={game.videoMedia?.detail}",
  "<GameCoverMedia",
  "const gallery = resolvePublicGameGalleryItems(game)",
  "<GameGalleryVideo"
);

forbid(
  "src={game.heroImage ?? game.coverImage}",
  "La preview no puede volver a usar Hero/Portada como imitación del Contenedor público."
);
forbid(
  "const gallery = Array.from(",
  "La preview no puede reconstruir una Galería paralela fuera del resolver público."
);
forbid(
  "...(game.heroImage ? [game.heroImage] : [])",
  "La preview no puede inyectar el Hero en Galería sólo para completar visualmente la maqueta."
);
forbid(
  "src={game.coverImage}",
  "La portada de preview debe reutilizar GameCoverMedia para conservar fallbacks y recorte canónicos."
);

if (failures.length > 0) {
  console.error("\nParidad multimedia de vista previa: ERROR\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Paridad multimedia de vista previa: OK (borrador privado + renderers públicos de Contenedor, portada y Galería)."
);
