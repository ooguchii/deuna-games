"use client";

import {
  CheckCircle2,
  Info,
  Search,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

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

function normalizeCpuSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cpuMatchesSearch(cpuName: string, query: string) {
  const terms = normalizeCpuSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return false;

  const searchable = normalizeCpuSearch(cpuName);
  return terms.every((term) => searchable.includes(term));
}

function cpuSearchPriority(cpuName: string, query: string) {
  const searchable = normalizeCpuSearch(cpuName);
  const normalizedQuery = normalizeCpuSearch(query);

  if (searchable === normalizedQuery) return 0;
  if (searchable.includes(normalizedQuery)) return 1;
  return 2;
}

export default function CpuIdentificationAssistant({
  onConfirmed,
  onCancel,
}: CpuIdentificationAssistantProps) {
  const [query, setQuery] = useState("");
  const [selectedCpuId, setSelectedCpuId] = useState("");
  const [saveError, setSaveError] = useState(false);

  const logicalProcessors =
    typeof navigator !== "undefined" &&
    Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null;

  const matchingCpus = useMemo(() => {
    if (!query.trim()) return [];

    return cpuCatalog
      .filter((cpu) => cpuMatchesSearch(cpu.name, query))
      .sort((a, b) => {
        const priorityDifference =
          cpuSearchPriority(a.name, query) - cpuSearchPriority(b.name, query);
        if (priorityDifference !== 0) return priorityDifference;
        return a.name.localeCompare(b.name, "es", { numeric: true });
      });
  }, [query]);

  const visibleCpus = matchingCpus.slice(0, 10);
  const selectedCpu = selectedCpuId
    ? cpuCatalog.find((cpu) => cpu.id === selectedCpuId) ?? null
    : null;

  function confirmCpu() {
    if (!selectedCpu) return;

    if (!writeConfirmedCpu(selectedCpu.id)) {
      setSaveError(true);
      return;
    }

    setSaveError(false);
    onConfirmed();
  }

  return (
    <div
      className={styles.root}
      role="region"
      aria-label="Elegir procesador exacto"
    >
      <div className={styles.heading}>
        <Info size={15} aria-hidden="true" />
        <div>
          <strong>Elegí tu procesador</strong>
          <span>
            {logicalProcessors
              ? `Detectamos ${logicalProcessors} hilos lógicos, pero el navegador no puede ver el modelo exacto de CPU.`
              : "El navegador no puede ver el modelo exacto de CPU."}
            {" "}Buscalo en el catálogo y seleccioná el correcto.
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
          />
        </label>

        <button
          type="button"
          className={styles.confirmButton}
          disabled={!selectedCpu}
          onClick={confirmCpu}
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          Confirmar CPU
        </button>
      </div>

      {query.trim() && (
        <div
          id="detected-cpu-results"
          className={styles.results}
          role="listbox"
          aria-label="Procesadores coincidentes"
          aria-live="polite"
        >
          {visibleCpus.length ? (
            <>
              <div className={styles.resultMeta}>
                {matchingCpus.length} coincidencia{matchingCpus.length === 1 ? "" : "s"}
                {matchingCpus.length > visibleCpus.length
                  ? ` · mostrando las primeras ${visibleCpus.length}`
                  : ""}
              </div>

              <div className={styles.resultList}>
                {visibleCpus.map((cpu) => {
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
              No encontramos procesadores con esa búsqueda. Probá con menos palabras o sólo con el número del modelo.
            </p>
          )}
        </div>
      )}

      {selectedCpu && (
        <div className={styles.selectedCpu} aria-live="polite">
          <CheckCircle2 size={14} aria-hidden="true" />
          Seleccionado: <strong>{selectedCpu.name}</strong>
        </div>
      )}

      {saveError && (
        <p className={styles.error} role="alert">
          El navegador no permitió guardar la CPU confirmada.
        </p>
      )}
    </div>
  );
}
