"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  Pencil,
  Search,
  X,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./AdminCatalog.module.css";

export type AdminUpdateCatalogItem = {
  key: string;
  gameSlug: string;
  version: string;
  type: string;
  revision: number;
  publicationNumber: number | null;
  status: "published" | "pending" | "hidden" | "unpublished";
  searchText: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function AdminUpdatesCatalog({
  items,
}: {
  items: AdminUpdateCatalogItem[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [game, setGame] = useState("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  const types = useMemo(
    () => [...new Set(items.map((item) => item.type))].sort(),
    [items]
  );
  const games = useMemo(
    () => [...new Set(items.map((item) => item.gameSlug))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery.trim());

    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (type !== "all" && item.type !== type) return false;
      if (game !== "all" && item.gameSlug !== game) return false;
      if (!needle) return true;
      return normalize(item.searchText).includes(needle);
    });
  }, [deferredQuery, game, items, status, type]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "/" && !editing) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasFilters = query || status !== "all" || type !== "all" || game !== "all";

  return (
    <section className={styles.panel} aria-labelledby="admin-updates-catalog-title">
      <h2 id="admin-updates-catalog-title" className={styles.srOnly}>
        Catálogo editorial de actualizaciones
      </h2>

      <div
        className={styles.toolbar}
        role="search"
        aria-label="Buscar y filtrar actualizaciones"
      >
        <div className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ID, juego, versión..."
            aria-label="Buscar actualizaciones"
          />
          <kbd aria-hidden="true">/</kbd>
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado">
            <option value="all">Todos los estados</option>
            <option value="published">Publicadas</option>
            <option value="pending">Cambios pendientes</option>
            <option value="hidden">Ocultas</option>
            <option value="unpublished">Sin publicar</option>
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo">
            <option value="all">Todos los tipos</option>
            {types.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={game} onChange={(event) => setGame(event.target.value)} aria-label="Filtrar por juego">
            <option value="all">Todos los juegos</option>
            {games.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {hasFilters && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                setQuery("");
                setStatus("all");
                setType("all");
                setGame("all");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div
        className={styles.resultBar}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>{filtered.length}</strong>
        <span>de {items.length} actualizaciones</span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>No hay actualizaciones que coincidan con los filtros actuales.</div>
      ) : (
        <div className={styles.tableViewport}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              Actualizaciones editoriales, juego relacionado, estado de publicación, revisión y acciones
            </caption>
            <thead>
              <tr>
                <th scope="col">Actualización</th>
                <th scope="col">Juego</th>
                <th scope="col">Estado</th>
                <th scope="col">Pub.</th>
                <th scope="col">Rev.</th>
                <th scope="col" className={styles.actionsColumn}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.key}>
                  <th scope="row">
                    <strong>{item.version}</strong>
                    <span>{item.key} · {item.type}</span>
                  </th>
                  <td>{item.gameSlug}</td>
                  <td>
                    {item.status === "published" ? (
                      <span className={styles.statusOk}>
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Publicada
                      </span>
                    ) : (
                      <span className={styles.statusPending}>
                        <CircleSlash2 size={15} aria-hidden="true" />
                        {item.status === "hidden"
                          ? "Oculta"
                          : item.status === "unpublished"
                            ? "Sin publicar"
                            : "Cambios pendientes"}
                      </span>
                    )}
                  </td>
                  <td>{item.publicationNumber ? `#${item.publicationNumber}` : "—"}</td>
                  <td>{item.revision}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        href={`/admin/actualizaciones/${encodeURIComponent(item.key)}`}
                        title={`Editar actualización ${item.version}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
