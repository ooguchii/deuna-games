import "server-only";

/*
 * `bootstrap` tiene dos significados históricos:
 *
 * - importación/migración: representa el snapshot público inicial;
 * - creación desde Admin: conserva numeración/historia interna mientras el
 *   contenido nace `public_visible=false` y su revisión 1 es `draft_saved`.
 *
 * La exposición pública no puede inferirse de actor_user_id: esa FK usa
 * ON DELETE SET NULL y perdería la distinción si se elimina un Admin.
 * Este predicado mantiene una única semántica para serving, limpieza y
 * cualquier consumidor futuro del historial publicado.
 *
 * Las consultas que lo interpolen deben usar el alias `publication` para
 * deuna_admin.editorial_publications.
 */
export const PUBLIC_EXPOSURE_PUBLICATION_SQL = `(
  publication.action IN ('published', 'rollback')
  OR (
    publication.action = 'bootstrap'
    AND NOT EXISTS (
      SELECT 1
        FROM deuna_admin.editorial_revisions AS revision
       WHERE revision.item_id = publication.item_id
         AND revision.revision = 1
         AND revision.action = 'draft_saved'
    )
  )
)`;
