"use client";

import {
  CheckCircle2,
  Info,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  searchCpuCatalog,
} from "./cpu-catalog-search";
import {
  writeConfirmedCpu,
} from "./cpu-confirmation-storage";
import {
  cpuCatalog,
} from "./hardware-catalog";

import styles from "./CpuIdentificationAssistant.module.css";

type CpuIdentificationAssistantProps = {
  onConfirmed: () => void;
  onCancel: () => void;
};

type DropdownPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

const DROPDOWN_GAP = 6;
const DROPDOWN_ESTIMATED_HEIGHT = 226;

export default function CpuIdentificationAssistant({
  onConfirmed,
  onCancel,
}: CpuIdentificationAssistantProps) {
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCpuId, setSelectedCpuId] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition | null>(null);

  const logicalProcessors =
    typeof navigator !== "undefined" &&
    Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null;

  const searchResult = useMemo(
    () => searchCpuCatalog(query, 10),
    [query]
  );
  const selectedCpu = selectedCpuId
    ? cpuCatalog.find((cpu) => cpu.id === selectedCpuId) ?? null
    : null;

  const updateDropdownPosition = useCallback(() => {
    const anchor = searchAreaRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP;
    const spaceAbove = rect.top - DROPDOWN_GAP;
    const openAbove =
      spaceBelow < DROPDOWN_ESTIMATED_HEIGHT && spaceAbove > spaceBelow;

    setDropdownPosition(
      openAbove
        ? {
            left: rect.left,
            width: rect.width,
            bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
          }
        : {
            left: rect.left,
            width: rect.width,
            top: rect.bottom + DROPDOWN_GAP,
          }
    );
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [query, updateDropdownPosition]);

  function confirmCpu() {
    if (!selectedCpu) return;

    if (!writeConfirmedCpu(selectedCpu.id)) {
      setSaveError(true);
      return;
    }

    setSaveError(false);
    onConfirmed();
  }

  const dropdown =
    query.trim() && dropdownPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            id="detected-cpu-results"
            className={styles.results}
            role="listbox"
            aria-label="Procesadores coincidentes"
            aria-live="polite"
            style={dropdownPosition}
          >
            {searchResult.items.length ? (
              <>
                <div className={styles.resultMeta}>
                  {searchResult.total} coincidencia{searchResult.total === 1 ? "" : "s"}
                  {searchResult.total > searchResult.items.length
                    ? ` · mostrando las primeras ${searchResult.items.length}`
                    : ""}
                </div>

                <div className={styles.resultList}>
                  {searchResult.items.map((cpu) => {
                    const selected = selectedCpuId === cpu.id;
                    return (
                      <button
                        key={cpu.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-selected={selected}
                        onClick={() => {
                          setSelectedCpuId(cpu.id);
                          setSaveError(false);
                        }}
                      >
                        <span>{cpu.name}</span>
                        {selected && (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className={styles.noMatch} role="status">
                No encontramos procesadores con esa búsqueda. Prueba con menos palabras o sólo con el número del modelo.
              </p>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className={styles.root}
        role="region"
        aria-label="Elegir procesador exacto"
      >
        <div className={styles.heading}>
          <Info size={15} aria-hidden="true" />
          <div>
            <strong>Elige tu procesador</strong>
            <span>
              {logicalProcessors
                ? `Detectamos ${logicalProcessors} hilos lógicos, pero el navegador no puede ver el modelo exacto de CPU.`
                : "El navegador no puede ver el modelo exacto de CPU."}
              {" "}Búscalo en el catálogo y selecciona el correcto.
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            aria-label="Cerrar selección de CPU"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.inputRow}>
          <div ref={searchAreaRef} className={styles.searchArea}>
            <label className={styles.searchField} htmlFor="detected-cpu-search">
              <Search size={15} aria-hidden="true" />
              <input
                id="detected-cpu-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedCpuId("");
                  setSaveError(false);
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Buscar CPU: i5 12400, Ryzen 5600, 5800X3D..."
                aria-controls="detected-cpu-results"
                aria-expanded={Boolean(query.trim())}
              />
            </label>
          </div>

          <button
            type="button"
            className={styles.confirmButton}
            disabled={!selectedCpu}
            onClick={confirmCpu}
            title={selectedCpu ? `Confirmar ${selectedCpu.name}` : undefined}
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            Confirmar CPU
          </button>
        </div>

        {saveError && (
          <p className={styles.error} role="alert">
            El navegador no permitió guardar la CPU confirmada.
          </p>
        )}
      </div>

      {dropdown}
    </>
  );
}
