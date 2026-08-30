import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const nextCli = require.resolve(
  "next/dist/bin/next"
);
const argumentsForNext = process.argv.slice(2);

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
