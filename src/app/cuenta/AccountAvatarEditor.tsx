"use client";

import Image from "next/image";
import {
  Camera,
  LoaderCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

import {
  ACCOUNT_AVATAR_CHANGED_EVENT,
} from "@/lib/accounts/avatar-events";

import styles from "./AccountAvatarEditor.module.css";

const OUTPUT_SIZE = 512;
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_AVATAR_BYTES = 512 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

async function prepareAvatar(file: File) {
  if (
    file.size <= 0 ||
    file.size > MAX_SOURCE_BYTES ||
    !acceptedTypes.has(file.type.toLowerCase())
  ) {
    throw new Error("formato");
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    const sourceSize = Math.min(bitmap.width, bitmap.height);

    if (sourceSize <= 0) {
      throw new Error("imagen");
    }

    const sourceX = Math.floor((bitmap.width - sourceSize) / 2);
    const sourceY = Math.floor((bitmap.height - sourceSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d", {
      alpha: false,
    });

    if (!context) {
      throw new Error("canvas");
    }

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    for (const quality of [0.86, 0.76, 0.66]) {
      const blob = await canvasToWebp(canvas, quality);

      if (
        blob &&
        blob.size > 0 &&
        blob.size <= MAX_AVATAR_BYTES
      ) {
        return blob;
      }
    }

    throw new Error("peso");
  } finally {
    bitmap.close();
  }
}

export default function AccountAvatarEditor({
  username,
}: {
  username: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(0);
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const avatarSrc = `/api/account/avatar?r=${revision}`;

  function notifyAvatarChanged() {
    setRevision((current) => current + 1);
    window.dispatchEvent(
      new CustomEvent(ACCOUNT_AVATAR_CHANGED_EVENT)
    );
  }

  async function handleSelection(file: File | undefined) {
    if (!file || pending) return;

    setPending(true);
    setMessage(null);

    try {
      const avatar = await prepareAvatar(file);
      const form = new FormData();
      form.set("image", avatar, "avatar.webp");

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "servicio");
      }

      setHasAvatar(true);
      setMessage("Foto de perfil actualizada.");
      notifyAvatarChanged();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "servicio";
      setMessage(
        reason === "formato"
          ? "Elige una imagen JPG, PNG o WebP de hasta 16 MB."
          : reason === "peso"
            ? "No se pudo reducir la imagen al tamaño seguro. Prueba con otra foto."
            : "No se pudo actualizar la foto de perfil."
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setPending(false);
    }
  }

  async function removeAvatar() {
    if (pending) return;

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          intent: "delete",
        }).toString(),
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error("servicio");
      }

      setHasAvatar(false);
      setMessage("Foto de perfil eliminada.");
      notifyAvatarChanged();
    } catch {
      setMessage("No se pudo eliminar la foto de perfil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.editor}
      aria-labelledby="account-avatar-title"
    >
      <div className={styles.preview}>
        <UserRound size={34} aria-hidden="true" />
        {hasAvatar !== false && (
          <Image
            key={avatarSrc}
            src={avatarSrc}
            alt={`Foto de perfil de ${username}`}
            width={88}
            height={88}
            unoptimized
            onLoad={() => setHasAvatar(true)}
            onError={() => setHasAvatar(false)}
          />
        )}
      </div>

      <div className={styles.copy}>
        <strong id="account-avatar-title">Foto de perfil</strong>
        <p>
          Opcional y privada. La imagen se recorta al centro, se convierte a WebP y el servidor vuelve a sanearla antes de guardarla.
        </p>

        <div className={styles.actions}>
          <input
            ref={inputRef}
            id="account-avatar-input"
            className={styles.input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={(event) =>
              void handleSelection(event.target.files?.[0])
            }
          />
          <label
            htmlFor="account-avatar-input"
            className={styles.action}
            aria-disabled={pending || undefined}
          >
            {pending ? (
              <LoaderCircle size={17} aria-hidden="true" />
            ) : (
              <Camera size={17} aria-hidden="true" />
            )}
            {hasAvatar ? "Cambiar foto" : "Elegir foto"}
          </label>

          {hasAvatar && (
            <button
              type="button"
              className={styles.remove}
              disabled={pending}
              onClick={() => void removeAvatar()}
            >
              <Trash2 size={16} aria-hidden="true" />
              Quitar foto
            </button>
          )}
        </div>

        {message && (
          <p className={styles.status} role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
