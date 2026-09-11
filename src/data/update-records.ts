import type {
  GameUpdate,
} from "@/types/update";

/*
 * Las actualizaciones son datos volátiles y sólo deben publicarse cuando una
 * versión, fecha y resumen puedan respaldarse con una fuente editorial real.
 * El fixture bundled queda vacío en lugar de simular un historial de parches.
 */
export const gameUpdates: GameUpdate[] = [];
