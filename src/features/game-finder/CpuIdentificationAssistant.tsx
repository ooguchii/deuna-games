"use client";

import {
  CheckCircle2,
  Clipboard,
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
  matchCpuName,
  suggestCpuNames,
} from "./cpu-matcher";
import {
  findCpuById,
} from "./hardware-catalog";

import styles from "./CpuIdentificationAssistant.module.css";

const WINDOWS_CPU_COMMAND =
  "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name";

type CpuIdentificationAssistantProps = {
  logicalProcessors: number | null;
  onConfirmed: () => void;
  onCancel: () => void;
};

export default function CpuIdentificationAssistant({
  logicalProcessors,
  onConfirmed,
  onCancel,
}: CpuIdentificationAssistantProps) {
  const [rawName, setRawName] = useState("");
  const [selectedCpuId, setSelectedCpuId] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const exactMatch = useMemo(
    () => matchCpuName(rawName),
    [rawName]
  );
  const suggestions = useMemo(
    () => suggestCpuNames(rawName, 3),
    [rawName]
  );
  const selectedCpu = selectedCpuId
    ? findCpuById(selectedCpuId)
    : exactMatch?.cpu ?? null;

  async function copyWindowsCommand() {
    try {
      await navigator.clipboard.writeText(WINDOWS_CPU_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

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
      aria-label="Confirmar procesador detectado"
    >
      <div className={styles.heading}>
        <Info size={15} aria-hidden="true" />
        <div>
          <strong>Falta confirmar el modelo de CPU</strong>
          <span>
            {logicalProcessors
              ? `El navegador detectó ${logicalProcessors} hilos, pero no puede leer el modelo exacto.`
              : "El navegador no puede leer el modelo exacto del procesador."}
          </span>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Cerrar confirmación de CPU"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.inputRow}>
        <label className={styles.searchField} htmlFor="detected-cpu-name">
          <Search size={15} aria-hidden="true" />
          <input
            id="detected-cpu-name"
            type="text"
            value={rawName}
            onChange={(event) => {
              setRawName(event.target.value);
              setSelectedCpuId("");
              setSaveError(false);
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Pega el nombre exacto del procesador"
          />
        </label>

        <button
          type="button"
          className={styles.confirmButton}
          disabled={!selectedCpu}
          onClick={confirmCpu}
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          Confirmar
        </button>
      </div>

      {rawName.trim() && (
        <div className={styles.matchArea} aria-live="polite">
          {exactMatch ? (
            <span className={styles.exactMatch}>
              <CheckCircle2 size={14} aria-hidden="true" />
              {exactMatch.cpu.name}
            </span>
          ) : suggestions.length ? (
            <div className={styles.suggestions}>
              <span>¿Es uno de estos?</span>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.cpu.id}
                  type="button"
                  data-selected={selectedCpuId === suggestion.cpu.id}
                  onClick={() => setSelectedCpuId(suggestion.cpu.id)}
                >
                  {suggestion.cpu.name}
                </button>
              ))}
            </div>
          ) : (
            <span className={styles.noMatch}>
              No encontramos ese modelo. Puedes elegirlo desde Configurar perfil.
            </span>
          )}
        </div>
      )}

      <details className={styles.help}>
        <summary>¿Dónde veo el nombre exacto?</summary>
        <div className={styles.helpContent}>
          <code>{WINDOWS_CPU_COMMAND}</code>
          <button type="button" onClick={copyWindowsCommand}>
            <Clipboard size={13} aria-hidden="true" />
            {copied ? "Copiado" : "Copiar comando"}
          </button>
        </div>
        <p>Se procesa localmente en tu navegador.</p>
      </details>

      {saveError && (
        <p className={styles.error} role="alert">
          El navegador no permitió guardar la CPU confirmada.
        </p>
      )}
    </div>
  );
}