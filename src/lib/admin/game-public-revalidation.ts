import "server-only";

import {
  revalidatePath,
} from "next/cache";

export function revalidatePublicGameSurfaces(
  slug: string
) {
  revalidatePath("/");
  revalidatePath("/juegos");
  revalidatePath("/actualizaciones");
  revalidatePath("/requisitos");
  revalidatePath(`/juegos/${slug}`);
  revalidatePath(`/juegos/${slug}/descargar`);
}
