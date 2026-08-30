import process from "node:process";

async function readHidden(label: string) {
  if (
    !process.stdin.isTTY ||
    typeof process.stdin.setRawMode !== "function"
  ) {
    throw new Error(
      "La contraseña sólo se puede leer desde una terminal interactiva segura."
    );
  }

  process.stdout.write(label);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>(
    (resolve, reject) => {
      let secret = "";

      function finish() {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
      }

      function onData(chunk: string | Buffer) {
        for (const character of chunk.toString()) {
          if (character === "\u0003") {
            finish();
            reject(
              new Error("Operación cancelada.")
            );
            return;
          }

          if (
            character === "\r" ||
            character === "\n"
          ) {
            finish();
            resolve(secret);
            return;
          }

          if (
            character === "\u007f" ||
            character === "\b"
          ) {
            secret = secret.slice(0, -1);
            continue;
          }

          if (character >= " ") {
            secret += character;
          }
        }
      }

      process.stdin.on("data", onData);
    }
  );
}

export async function readConfirmedAdminPassword(
  firstLabel: string,
  secondLabel: string
) {
  const first = await readHidden(firstLabel);
  const second = await readHidden(secondLabel);

  if (first !== second) {
    throw new Error(
      "Las contraseñas no coinciden."
    );
  }

  return first;
}
