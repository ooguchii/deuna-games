import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) =>
  needles.every((needle) => text.includes(needle));

const [previewPage, previewCss, catalog] = await Promise.all([
  source("src/app/admin/(protected)/juegos/[slug]/vista-previa/page.tsx"),
  source("src/app/admin/(protected)/juegos/[slug]/vista-previa/page.module.css"),
  source("src/components/games/GameCatalogClient.tsx"),
]);

assert(
  has(
    previewPage,
    'import GameCoverMedia from "@/components/ui/GameCoverMedia"',
    'import UniversalGameCardBase from "@/components/ui/UniversalGameCardBase"',
    'const game = item.payload',
    '<GameCoverMedia game={game} sizes="220px" />',
    '<UniversalGameCardBase',
    'game={game}',
    'variant="standard"',
    'CARD PÚBLICA · BORRADOR',
    'mismo renderer base que usan las Cards públicas',
    'snapshot publicado'
  ),
  "La vista previa Admin debe montar el borrador en los renderers canónicos de Portada y Card y explicar la frontera draft/público."
);

assert(
  !previewPage.includes('src={game.coverImage}\n') &&
    has(previewCss, ".cover {", "aspect-ratio: 4 / 5", ".cardPreviewFrame"),
  "La vista previa no debe volver a dibujar Portada directamente ni usar una relación distinta de 4:5."
);

assert(
  has(
    catalog,
    'import UniversalGameCard from "@/components/ui/UniversalGameCard"',
    '<UniversalGameCard',
    'game={game}',
    'variant="standard"'
  ),
  "El catálogo público debe conservar la misma variante estándar que previsualiza el Admin."
);

if (failures.length) {
  console.error("\nAdmin game Card preview: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Admin game Card preview: OK (borrador -> GameCoverMedia 4:5 + UniversalGameCardBase estándar; snapshot público separado)."
);
