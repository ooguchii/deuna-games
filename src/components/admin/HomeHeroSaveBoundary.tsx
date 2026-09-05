"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import styles from "./HomeHeroEditor.module.css";

const HERO_SAVE_ACTION = "/api/admin/content/home/hero";
const HERO_DRAFT_PREFIX = "deuna:hero-draft:";
const HERO_DRAFT_LATEST_KEY = `${HERO_DRAFT_PREFIX}latest`;

type SaveNotice = {
  error: boolean;
  message: string;
};

type SaveResponse = {
  state?: string;
  revision?: number;
};

type HeroSaveFields = {
  expectedRevision: string;
  heroJson: string;
};

function clearStoredHeroDrafts() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(HERO_DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // El guardado confirmado en el servidor sigue siendo la fuente de verdad.
  }
}

function readHeroSaveFields(form: HTMLFormElement): HeroSaveFields | null {
  const formData = new FormData(form);
  const expectedRevision = formData.get("expectedRevision");
  const heroJson = formData.get("heroJson");

  if (
    typeof expectedRevision !== "string" ||
    typeof heroJson !== "string"
  ) {
    return null;
  }

  return { expectedRevision, heroJson };
}

function readHeroState(fields: HeroSaveFields) {
  try {
    const parsed = JSON.parse(fields.heroJson) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const payload = parsed as Record<string, unknown>;
    return {
      mode: payload.mode,
      slugs: payload.slugs,
      presentation: payload.presentation,
    };
  } catch {
    return null;
  }
}

function normalizedHeroSaveFields(fields: HeroSaveFields): HeroSaveFields | null {
  const state = readHeroState(fields);
  if (!state) return null;
  return {
    expectedRevision: fields.expectedRevision,
    // `copy` sólo existía por compatibilidad con borradores antiguos. El Hero
    // actual no es dueño de esos textos y no debe enviarlos al guardar.
    heroJson: JSON.stringify(state),
  };
}

function persistHeroRecovery(form: HTMLFormElement) {
  const fields = readHeroSaveFields(form);
  if (!fields) return;

  try {
    const revision = Number(fields.expectedRevision);
    if (!Number.isInteger(revision) || revision < 1) return;
    const state = readHeroState(fields);
    if (!state) return;

    sessionStorage.setItem(
      HERO_DRAFT_LATEST_KEY,
      JSON.stringify({ revision, state })
    );
    sessionStorage.setItem(
      `${HERO_DRAFT_PREFIX}${revision}`,
      JSON.stringify(state)
    );
  } catch {
    // Si storage está bloqueado, el editor conserva igualmente el estado en memoria.
  }
}

function errorMessage(response: Response, result: SaveResponse | null) {
  if (response.status === 409) {
    return "Hay una revisión más reciente de Inicio. Tus cambios siguen aquí y en la copia local; recarga y revísalos antes de volver a guardar.";
  }
  if (response.status === 403) {
    return "El servidor rechazó la solicitud. Abre el editor desde su dirección HTTPS autorizada e intenta de nuevo. Tus cambios siguen aquí.";
  }
  if (response.status === 400 || result?.state === "datos") {
    return "No se pudo guardar porque algún valor del Hero no es válido. Tus cambios siguen aquí para que puedas revisarlos.";
  }
  if (response.status === 404) {
    return "No se encontró la configuración editorial de Inicio. Tus cambios siguen aquí; actualiza el panel antes de reintentar.";
  }
  if (response.status === 503) {
    return "El servicio administrativo no está disponible. Tus cambios siguen aquí y en la copia local; vuelve a intentarlo cuando el servicio responda.";
  }
  return "No se pudo guardar el borrador. Tus cambios siguen aquí y en la copia local; vuelve a intentarlo.";
}

export default function HomeHeroSaveBoundary({
  revision,
  children,
}: {
  revision: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const backupFrame = useRef<number | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);

  const findHeroForm = () =>
    rootRef.current?.querySelector<HTMLFormElement>(
      `form[action="${HERO_SAVE_ACTION}"]`
    ) ?? null;

  const scheduleRecoverySnapshot = () => {
    if (saving.current) return;
    if (backupFrame.current !== null) {
      cancelAnimationFrame(backupFrame.current);
    }
    backupFrame.current = requestAnimationFrame(() => {
      backupFrame.current = null;
      if (saving.current) return;
      const form = findHeroForm();
      if (!form) return;
      const submit = form.querySelector<HTMLButtonElement>(
        'button[type="submit"], button:not([type])'
      );
      if (submit?.disabled) {
        clearStoredHeroDrafts();
        return;
      }
      persistHeroRecovery(form);
    });
  };

  useEffect(() => {
    return () => {
      if (backupFrame.current !== null) {
        cancelAnimationFrame(backupFrame.current);
      }
    };
  }, []);

  useEffect(() => {
    if (savedRevision === null || revision < savedRevision) return;
    saving.current = false;
    setSavePending(false);
    setSavedRevision(null);
  }, [revision, savedRevision]);

  useEffect(() => {
    if (savedRevision === null) return;
    const timeout = window.setTimeout(() => {
      saving.current = false;
      setSavePending(false);
      setNotice((current) =>
        current?.error
          ? current
          : {
              error: false,
              message: `Borrador guardado correctamente · revisión ${savedRevision}. Si la revisión visible todavía no cambió, actualiza el panel antes de seguir editando.`,
            }
      );
    }, 5_000);
    return () => window.clearTimeout(timeout);
  }, [savedRevision]);

  const saveHero = async (event: FormEvent<HTMLDivElement>) => {
    const form = event.target;
    if (
      !(form instanceof HTMLFormElement) ||
      form.getAttribute("action") !== HERO_SAVE_ACTION
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (saving.current) return;

    const rawFields = readHeroSaveFields(form);
    const fields = rawFields ? normalizedHeroSaveFields(rawFields) : null;
    if (!fields) {
      setNotice({
        error: true,
        message: "No se pudo preparar el guardado del Hero. Tus cambios siguen abiertos en el editor.",
      });
      return;
    }

    persistHeroRecovery(form);
    saving.current = true;
    setSavePending(true);
    setNotice(null);

    let waitForRefresh = false;

    try {
      const response = await fetch(HERO_SAVE_ACTION, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(fields),
      });

      if (response.redirected) {
        throw new Error(
          "La sesión administrativa expiró. Inicia sesión en otra pestaña y vuelve a guardar; tus cambios siguen aquí."
        );
      }

      const result = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? (await response.json()) as SaveResponse
        : null;

      if (
        !response.ok ||
        result?.state !== "guardado" ||
        !Number.isInteger(result.revision)
      ) {
        throw new Error(errorMessage(response, result));
      }

      const nextRevision = result.revision as number;
      clearStoredHeroDrafts();
      setSavedRevision(nextRevision);
      setNotice({
        error: false,
        message: `Borrador guardado correctamente · revisión ${nextRevision}.`,
      });
      waitForRefresh = true;
      router.refresh();
    } catch (error) {
      persistHeroRecovery(form);
      setNotice({
        error: true,
        message:
          error instanceof Error && error.name !== "TypeError"
            ? error.message
            : "No se pudo conectar con el servidor. Tus cambios siguen aquí y en la copia local; vuelve a intentarlo.",
      });
    } finally {
      if (!waitForRefresh) {
        saving.current = false;
        setSavePending(false);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      aria-busy={savePending}
      onSubmitCapture={saveHero}
      onClickCapture={scheduleRecoverySnapshot}
      onChangeCapture={scheduleRecoverySnapshot}
      onInputCapture={scheduleRecoverySnapshot}
      onPointerUpCapture={scheduleRecoverySnapshot}
      onKeyUpCapture={scheduleRecoverySnapshot}
    >
      {notice && (
        <p
          className={styles.workspaceNote}
          role={notice.error ? "alert" : "status"}
        >
          {notice.message}
        </p>
      )}
      <div inert={savePending || undefined}>{children}</div>
    </div>
  );
}
