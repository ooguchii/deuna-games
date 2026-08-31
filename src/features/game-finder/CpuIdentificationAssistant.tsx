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
  useId,
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
import type {
  HardwareProfile,
} from "./types";

import styles from "./CpuIdentificationAssistant.module.css";

type CpuIdentificationAssistantProps = {
  hardware: HardwareProfile;
  ramLabel: string;
  onConfirmed: () => void;
  onCancel: () => void;
  showCloseButton?: boolean;
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
  hardware,
  ramLabel,
  onConfirmed,
  onCancel,
  showCloseButton = true,
}: CpuIdentificationAssistantProps) {
  const instanceId = useId();
  const inputId = `detected-cpu-search-${instanceId}`;
  const resultsId = `detected-cpu-results-${instanceId}`;
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

  const systemDetected =
    Boolean(hardware.os) && hardware.os !== "Sistema sin confirmar";
  const detectedParts = [
    hardware.gpu?.name ? `GPU ${hardware.gpu.name}` : null,
    hardware.ramGb ? `RAM ${ramLabel}` : null,
    systemDetected ? hardware.os : null,
    logicalProcessors ? `${logicalProcessors} hilos lógicos` : null,
  ].filter((value): value is string => Boolean(value));
  const missingParts = [
    hardware.cpuKnowledge !== "confirmed" ? "modelo exacto de CPU" : null,
    !hardware.gpu ? "GPU" : null,
    !hardware.ramGb ? "RAM" : null,
    !systemDetected ? "sistema" : null,
  ].filter((value): value is string => Boolean(value));

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
    if (!query.trim()) return;

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
            id={resultsId}
            className={styles.results}
            role="listbox"
            aria-label="Procesadores coincidentes"
            aria-live="polite"
            data-cpu-assistant-results="true"
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
        aria-label="Completar configuración del equipo"
      >
        <div className={styles.heading}>
          <Info size={15} aria-hidden="true" />
          <div>
            <strong>Configuración incompleta</strong>
            <span>
              {detectedParts.length
                ? `Detectado: ${detectedParts.join(" · ")}.`
                : "La detección automática quedó incompleta."}
            </span>
            <span>
              {missingParts.length
                ? `Falta: ${missingParts.join(", ")}.`
                : "No quedan componentes pendientes."}
              {" "}Busca el procesador en el catálogo y selecciona el correcto.
            </span>
          </div>
          {showCloseButton && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onCancel}
              aria-label="Cerrar configuración incompleta"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.inputRow}>
          <div ref={searchAreaRef} className={styles.searchArea}>
            <label className={styles.searchField} htmlFor={inputId}>
              <Search size={15} aria-hidden="true" />
              <input
                id={inputId}
                type="search"
                role="combobox"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setSelectedCpuId("");
                  setSaveError(false);
                  if (!nextQuery.trim()) {
                    setDropdownPosition(null);
                  }
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Buscar CPU: i5 12400, Ryzen 5600, 5800X3D..."
                aria-controls={resultsId}
                aria-expanded={Boolean(query.trim())}
                aria-autocomplete="list"
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