import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const [cardBase, tiltCss] = await Promise.all([
  source("src/components/ui/UniversalGameCardBase.tsx"),
  source("src/components/ui/UniversalGameCardTilt.module.css"),
]);
const reducedMotionStart = tiltCss.indexOf(
  "@media (prefers-reduced-motion: reduce)"
);
const reducedMotionBlock =
  reducedMotionStart >= 0 ? tiltCss.slice(reducedMotionStart) : "";
const pointerActivationCalls =
  cardBase.match(/activatePointerEffects\(event\)/g)?.length ?? 0;

assert(
  cardBase.includes('event.pointerType === "mouse"') &&
    cardBase.includes('event.pointerType === "pen"') &&
    cardBase.includes("setAttribute(") &&
    cardBase.includes('"data-tilt-active"') &&
    cardBase.includes('removeAttribute("data-tilt-active")') &&
    cardBase.includes('"(prefers-reduced-motion: reduce)"') &&
    !cardBase.includes('"(hover: hover) and (pointer: fine)"'),
  "El tilt debe usar el PointerEvent real de mouse/pen, rechazar touch implícitamente y respetar reduced-motion."
);

assert(
  pointerActivationCalls >= 2 &&
    cardBase.includes("function startCard(") &&
    cardBase.includes("function scheduleTilt(") &&
    cardBase.includes("schedulePreview();"),
  "Pointer enter y pointer move deben compartir la activación real del 3D, para que equipos híbridos no dependan de que pointerenter haya armado un latch previo."
);

assert(
  tiltCss.includes(".tiltCard.tiltCard") &&
    tiltCss.includes("overflow: clip;") &&
    tiltCss.includes("perspective(900px)") &&
    tiltCss.includes("transform-style: preserve-3d;") &&
    tiltCss.includes(".tiltClip") &&
    tiltCss.includes('data-tilt-active="true"') &&
    tiltCss.includes("translateZ(14px)") &&
    tiltCss.includes("@media (any-hover: none)") &&
    !tiltCss.includes("overflow: hidden;"),
  "La Card debe recortar con overflow: clip sin aplanar la escena 3D y conservar su profundidad."
);

assert(
  reducedMotionBlock.includes(".tiltCard.tiltCard") &&
    reducedMotionBlock.includes("transform: none;") &&
    reducedMotionBlock.includes("transition: none;") &&
    reducedMotionBlock.includes("filter: none;"),
  "Reduced-motion debe tener especificidad suficiente para anular perspectiva, parallax y transiciones incluso si la Card estaba activa."
);

if (failures.length > 0) {
  console.error("\nUniversal Game Card 3D: ERROR\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Universal Game Card 3D: OK (pointer real en enter/move -> tilt 3D preservado -> clip seguro -> touch/reduced-motion sin movimiento)."
);
