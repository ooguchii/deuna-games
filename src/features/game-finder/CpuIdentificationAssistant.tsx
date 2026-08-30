"use client";

import {
  CheckCircle2,
  Clipboard,
  Cpu,
  Info,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import {
  readConfirmedCpu,
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

export default function CpuIdentificationAssistant() {
  const [confirmedCpu, setConfirmedCpu] = useState(
    () => readConfirmedCpu()
  );
  const [editing, setEditing] = useState(
    () => readConfirmedCpu() === null
  );
  const [rawName, setRawName] = useState("");
  const [selectedCpuId, setSelectedCpuId] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const exactMatch = useMemo(
    () => matchCpuName(rawName),
    [rawName]
  );
  const suggestions = useMemo(
    () => suggestCpuNames(rawName, 5),
    [rawName]
  );
  const selectedCpu = selectedCpuId
    ? findCpuById(selectedCpuId)
    : exactMatch?.cpu ?? null;
  const logicalProcessors =
    typeof navigator !== "undefined" &&
    Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null;

  async function copyWindowsCommand() {
    try {
      await navigator.clipboard.writeText(
        WINDOWS_CPU_COMMAND
      );
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
    setConfirmedCpu(selectedCpu);
    setEditing(false);

    // El detector y el modelo de FPS comparten el perfil resuelto al montar.
    // Recargar garantiza que todas las superficies usen la CPU confirmada en
    // la misma operación, sin introducir un segundo estado global paralelo.
    window.location.reload();
  }

  if (confirmedCpu && !editing) {
    return (
      <section
        className={styles.confirmedBar}
        aria-label="Procesador confirmado"
      >
        <span className={styles.iconBox}>
          <Cpu size={21} aria-hidden="true" />
        </span>
        <div className={styles.confirmedCopy}>
          <span>CPU CONFIRMADA</span>
          <strong>{confirmedCpu.name}</strong>
          <small>
            Se usa el modelo exacto para calcular rendimiento.
          </small>
        </div>
        <CheckCircle2
          className={styles.confirmedIcon}
          size={20}
          aria-hidden="true"
        />
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setRawName(confirmedCpu.name);
            setEditing(true);
          }}
        >
          Cambiar
        </button>
      </section>
    );
  }

  return (
    <section
      className={styles.root}
      aria-labelledby="cpu-identification-title"
    >
      <div className={styles.header}>
        <span className={styles.iconBox}>
          <Cpu size={22} aria-hidden="true" />
        </span>
        <div>
          <span>IDENTIFICACIÓN DE CPU</span>
          <h2 id="cpu-identification-title">
            Confirma el procesador exacto
          </h2>
          <p>
            Los navegadores no exponen el modelo de CPU. DeUna puede ver
            {logicalProcessors
              ? ` ${logicalProcessors} hilos lógicos, pero `
              : " algunos datos generales, pero "}
            para FPS precisos conviene confirmar el nombre real una sola vez.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.identifyPanel}>
          <label htmlFor="cpu-raw-name">
            Nombre del procesador
          </label>
          <div className={styles.searchField}>
            <Search size={17} aria-hidden="true" />
            <input
              id="cpu-raw-name"
              type="text"
              value={rawName}
              onChange={(event) => {
                setRawName(event.target.value);
                setSelectedCpuId("");
                setSaveError(false);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="Ej.: AMD Ryzen 7 5800X3D 8-Core Processor"
            />
            {rawName && (
              <button
                type="button"
                onClick={() => {
                  setRawName("");
                  setSelectedCpuId("");
                }}
                aria-label="Limpiar nombre de CPU"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {rawName.trim() && (
            <div
              className={styles.matchArea}
              aria-live="polite"
            >
              {exactMatch ? (
                <div className={styles.exactMatch}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <div>
                    <span>COINCIDENCIA EXACTA</span>
                    <strong>{exactMatch.cpu.name}</strong>
                    <small>
                      Modelo y variante reconocidos con confianza alta.
                    </small>
                  </div>
                </div>
              ) : suggestions.length ? (
                <div className={styles.suggestions}>
                  <div className={styles.suggestionHeading}>
                    <Info size={16} aria-hidden="true" />
                    <span>
                      No hay una coincidencia inequívoca. Elige sólo si ves tu
                      modelo exacto:
                    </span>
                  </div>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.cpu.id}
                      type="button"
                      data-selected={
                        selectedCpuId === suggestion.cpu.id
                      }
                      onClick={() =>
                        setSelectedCpuId(suggestion.cpu.id)
                      }
                    >
                      <span>{suggestion.cpu.name}</span>
                      <small>
                        {Math.round(suggestion.confidence * 100)}% coincidencia
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.noMatch}>
                  <Info size={17} aria-hidden="true" />
                  <span>
                    No encontramos ese modelo en el catálogo. Puedes seguir
                    usando el selector manual del perfil sin inventar una
                    equivalencia.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={!selectedCpu}
              onClick={confirmCpu}
            >
              <CheckCircle2 size={17} aria-hidden="true" />
              Confirmar {selectedCpu?.name ?? "CPU"}
            </button>
            {confirmedCpu && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setRawName(confirmedCpu.name);
                  setSelectedCpuId("");
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            )}
          </div>

          {saveError && (
            <p className={styles.error} role="alert">
              El navegador no permitió guardar la confirmación local.
            </p>
          )}
        </div>

        <aside className={styles.helpPanel}>
          <div className={styles.helpTitle}>
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Obtener el nombre exacto en Windows</strong>
              <span>
                Abre PowerShell, ejecuta este comando y pega aquí el resultado.
              </span>
            </div>
          </div>
          <code>{WINDOWS_CPU_COMMAND}</code>
          <button
            type="button"
            className={styles.copyButton}
            onClick={copyWindowsCommand}
          >
            <Clipboard size={15} aria-hidden="true" />
            {copied ? "Copiado" : "Copiar comando"}
          </button>
          <p>
            El texto se procesa en tu navegador. No se envía el modelo de CPU
            a DeUna ni se usa para rastreo.
          </p>
        </aside>
      </div>
    </section>
  );
}
