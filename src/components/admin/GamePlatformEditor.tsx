"use client";

import { useMemo, useState } from "react";

import type { GamePlatform } from "@/types/game";

import styles from "./GamePlatformEditor.module.css";

const platformOptions: GamePlatform[] = [
  "PC",
  "PlayStation",
  "Xbox",
  "Nintendo Switch",
];

type GamePlatformEditorProps = {
  initialPlatforms: GamePlatform[];
};

export default function GamePlatformEditor({
  initialPlatforms,
}: GamePlatformEditorProps) {
  const [platforms, setPlatforms] = useState<GamePlatform[]>(
    () =>
      platformOptions.filter((platform) =>
        initialPlatforms.includes(platform)
      )
  );

  const serialized = useMemo(
    () => JSON.stringify(platforms),
    [platforms]
  );

  function togglePlatform(platform: GamePlatform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : platformOptions.filter(
            (item) =>
              item === platform || current.includes(item)
          )
    );
  }

  return (
    <fieldset className={styles.root}>
      <legend>Plataformas</legend>
      <input
        type="hidden"
        name="platformsJson"
        value={serialized}
      />

      <div className={styles.grid}>
        {platformOptions.map((platform) => {
          const active = platforms.includes(platform);

          return (
            <button
              key={platform}
              type="button"
              className={active ? styles.active : ""}
              aria-pressed={active}
              onClick={() => togglePlatform(platform)}
            >
              <span className={styles.indicator} aria-hidden="true" />
              {platform}
            </button>
          );
        })}
      </div>

      <p>
        Si no seleccionás ninguna, la ficha pública seguirá usando PC como valor de compatibilidad por defecto.
      </p>
    </fieldset>
  );
}
