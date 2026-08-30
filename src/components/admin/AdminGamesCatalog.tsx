"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleSlash2,
  Eye,
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

export type AdminGameCatalogItem = {
  key: string;
  title: string;
  category: string;
  version: string | null;
  revision: number;
  publicationNumber: number | null;
  status: "published" | "pending" | "hidden" | "unpublished";
  searchText: string;
};

type SortMode = "title" | "status" | "revision";

const statusLabels = {
  all: "Todos los estados",
  published: "Publicados",
  pending: "Cambios pendientes",
  hidden: "Ocultos",
  unpublished: "Sin publicar",
} as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function AdminGamesCatalog({
  items,
}: {
  items: AdminGameCatalogItem[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortMode>("title");
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.category))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery.trim());

    return items
      .filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (category !== "all" && item.category !== category) return false;
        if (!needle) return true;
        return normalize(item.searchText).includes(needle);
      })
      .sort((a, b) => {
        if (sort === "revision") {
          return b.revision - a.revision || a.title.localeCompare(b.title, "es");
        }
        if (sort === "status") {
          return a.status.localeCompare(b.status) || a.title.localeCompare(b.title, "es");
        }
        return a.title.localeCompare(b.title, "es");
      });
  }, [category, deferredQuery, items, sort, status]);

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

  const hasFilters =
    query !== "" || status !== "all" || category !== "all" || sort !== "title";

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar juego, slug, versión, tag..."
            aria-label="Buscar juegos"
          />
          <kbd>/</kbd>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filtrar por estado"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            aria-label="Ordenar juegos"
          >
            <option value="title">Orden: nombre</option>
            <option value="status">Orden: estado</option>
            <option value="revision">Orden: revisión</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                setQuery("");
                setStatus("all");
                setCategory("all");
                setSort("title");
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className={styles.resultBar}>
        <strong>{filtered.length}</strong>
        <span>de {items.length} juegos</span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          No hay juegos que coincidan con los filtros actuales.
        </div>
      ) : (
        <div className={styles.tableViewport}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Juego</th>
                <th scope="col">Categoría</th>
                <th scope="col">Estado</th>
                <th scope="col">Pub.</th>
                <th scope="col">Rev.</th>
                <th scope="col" className={styles.actionsColumn}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.key}>
                  <th scope="row">
                    <strong>{item.title}</strong>
                    <span>
                      {item.key}
                      {item.version ? ` · ${item.version}` : ""}
                    </span>
                  </th>
                  <td>{item.category}</td>
                  <td>
                    {item.status === "published" ? (
                      <span className={styles.statusOk}>
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Publicado
                      </span>
                    ) : (
                      <span className={styles.statusPending}>
                        <CircleSlash2 size={13} aria-hidden="true" />
                        {item.status === "hidden"
                          ? "Oculto"
                          : item.status === "unpublished"
                            ? "Sin publicar"
                            : "Cambios pendientes"}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.publicationNumber
                      ? `#${item.publicationNumber}`
                      : "—"}
                  </td>
                  <td>{item.revision}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        href={`/admin/juegos/${encodeURIComponent(item.key)}`}
                        title="Editar juego"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Editar
                      </Link>
                      <Link
                        href={`/admin/juegos/${encodeURIComponent(item.key)}/vista-previa`}
                        title="Ver borrador"
                      >
                        <Eye size={13} aria-hidden="true" />
                        Previa
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
