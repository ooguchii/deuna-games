import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const nextCli = require.resolve(
  "next/dist/bin/next"
);
const argumentsForNext = process.argv.slice(2);

function mediaRuntimeEnvironment() {
  if (
    argumentsForNext[0] !== "dev" ||
    process.platform === "win32"
  ) {
    return {};
  }

  const wrapper = path.resolve(
    "ops/worker/yt-dlp-node-wrapper.sh"
  );

  if (!existsSync(wrapper)) return {};

  const configuredPath =
    process.env.DEUNA_YTDLP_PATH?.trim() ?? "";
  const configuredBinary =
    process.env.DEUNA_YTDLP_BINARY?.trim() ?? "";

  return {
    DEUNA_YTDLP_PATH: wrapper,
    ...(configuredBinary
      ? { DEUNA_YTDLP_BINARY: configuredBinary }
      : configuredPath && configuredPath !== wrapper
        ? { DEUNA_YTDLP_BINARY: configuredPath }
        : {}),
  };
}

if (argumentsForNext.length === 0) {
  console.error(
    "Falta indicar el comando de Next.js."
  );
  process.exitCode = 1;
} else {
  const child = spawn(
    process.execPath,
    [nextCli, ...argumentsForNext],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ...mediaRuntimeEnvironment(),
        NEXT_TELEMETRY_DISABLED: "1",
      },
    }
  );

  child.once("error", () => {
    console.error(
      "No se pudo iniciar Next.js."
    );
    process.exitCode = 1;
  });

  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
