import process from "node:process";

const ESCAPE = "\u001b";

function stripTerminalEscapeSequences(
  chunk: string,
  state: { pending: string }
) {
  state.pending += chunk;
  let output = "";

  while (state.pending.length > 0) {
    if (!state.pending.startsWith(ESCAPE)) {
      output += state.pending[0];
      state.pending = state.pending.slice(1);
      continue;
    }

    if (state.pending === ESCAPE) {
      break;
    }

    if (state.pending.startsWith(`${ESCAPE}[`)) {
      let end = -1;

      for (
        let index = 2;
        index < state.pending.length;
        index += 1
      ) {
        const code = state.pending.charCodeAt(index);

        if (code >= 0x40 && code <= 0x7e) {
          end = index;
          break;
        }
      }

      if (end === -1) {
        if (state.pending.length > 32) {
          state.pending = state.pending.slice(1);
          continue;
        }

        break;
      }

      state.pending = state.pending.slice(end + 1);
      continue;
    }

    state.pending = state.pending.slice(1);
  }

  return output;
}

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
      let settled = false;
      const escapeState = { pending: "" };

      function finish() {
        process.stdin.off("data", onData);
        process.stdin.off("error", onError);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
      }

      function resolveOnce(value: string) {
        if (settled) return;
        settled = true;
        finish();
        resolve(value);
      }

      function rejectOnce(error: Error) {
        if (settled) return;
        settled = true;
        finish();
        reject(error);
      }

      function onError() {
        rejectOnce(
          new Error(
            "No se pudo leer la contraseña desde la terminal."
          )
        );
      }

      function onData(chunk: string | Buffer) {
        const sanitized =
          stripTerminalEscapeSequences(
            chunk.toString(),
            escapeState
          );

        for (const character of sanitized) {
          if (character === "\u0003") {
            rejectOnce(
              new Error("Operación cancelada.")
            );
            return;
          }

          if (
            character === "\r" ||
            character === "\n"
          ) {
            resolveOnce(secret);
            return;
          }

          if (
            character === "\u007f" ||
            character === "\b"
          ) {
            secret = Array.from(secret)
              .slice(0, -1)
              .join("");
            continue;
          }

          if (character === "\u0015") {
            secret = "";
            continue;
          }

          const codePoint =
            character.codePointAt(0) ?? 0;

          if (
            codePoint >= 0x20 &&
            codePoint !== 0x7f
          ) {
            secret += character;
          }
        }
      }

      process.stdin.on("error", onError);
      process.stdin.on("data", onData);
    }
  );
}

export async function readAdminPassword(
  label: string
) {
  return readHidden(label);
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
