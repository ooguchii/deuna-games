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

  const searchResult = useMemo(
    () => searchCpuCatalog(query, 10),
    [query]
  );
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
        <div className={styles.searchArea}>
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

          {query.trim() && (
            <div
              id="detected-cpu-results"
              className={styles.results}
              role="listbox"
              aria-label="Procesadores coincidentes"
              aria-live="polite"
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
            </div>
          )}
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
  );
}
