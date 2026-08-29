import {
  randomUUID,
} from "node:crypto";
import process from "node:process";
import {
  createInterface,
} from "node:readline/promises";

import { Pool } from "pg";

import {
  getAdminDatabaseConfig,
} from "../../src/lib/admin/database-config.ts";
import {
  hashAdminPassword,
  validateAdminPassword,
} from "../../src/lib/admin/password.ts";
import {
  adminUsernameSchema,
  normalizeAdminUsername,
} from "../../src/lib/admin/validation.ts";

async function readUsername() {
  const configured =
    process.env.DEUNA_ADMIN_OWNER_USERNAME?.trim();

  if (configured) return configured;

  if (!process.stdin.isTTY) {
    throw new Error(
      "Se necesita una terminal interactiva para crear al propietario."
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (
      await prompt.question(
        "Nombre de acceso del propietario: "
      )
    ).trim();
  } finally {
    prompt.close();
  }
}

async function readHidden(
  label: string
) {
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

async function readPassword() {
  const configured =
    process.env.DEUNA_ADMIN_OWNER_PASSWORD;

  if (configured) {
    delete process.env.DEUNA_ADMIN_OWNER_PASSWORD;
    return configured;
  }

  const first = await readHidden(
    "Contraseña extensa del propietario: "
  );
  const second = await readHidden(
    "Repite la contraseña: "
  );

  if (first !== second) {
    throw new Error(
      "Las contraseñas no coinciden."
    );
  }

  return first;
}

async function main() {
  const username = await readUsername();
  const parsedUsername =
    adminUsernameSchema.safeParse(username);

  if (!parsedUsername.success) {
    throw new Error(
      "El nombre debe tener entre 3 y 40 caracteres y usar sólo letras, números, punto, guion o guion bajo."
    );
  }

  let password = await readPassword();
  const passwordIssues =
    validateAdminPassword(password);

  if (passwordIssues.length > 0) {
    throw new Error(passwordIssues.join(" "));
  }

  const passwordHash =
    await hashAdminPassword(password);
  password = "";

  const pool = new Pool(
    getAdminDatabaseConfig("migration")
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id
       FROM deuna_admin.admin_users
       WHERE active = true
       LIMIT 1
       FOR UPDATE`
    );

    if (existing.rowCount) {
      throw new Error(
        "Ya existe una cuenta propietaria activa."
      );
    }

    const id = randomUUID();

    await client.query(
      `INSERT INTO deuna_admin.admin_users
         (id, username, username_key, password_hash, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [
        id,
        parsedUsername.data,
        normalizeAdminUsername(
          parsedUsername.data
        ),
        passwordHash,
      ]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_events
         (user_id, event_type)
       VALUES ($1, 'owner_created')`,
      [id]
    );

    await client.query(
      `INSERT INTO deuna_admin.admin_audit_log
         (user_id, action, entity_type, entity_id)
       VALUES ($1, 'owner_created', 'admin_user', $1::text)`,
      [id]
    );

    await client.query("COMMIT");
    console.log(
      "Cuenta propietaria creada. La contraseña no fue mostrada ni registrada."
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo crear la cuenta propietaria.";

  console.error(message);
  process.exitCode = 1;
});
