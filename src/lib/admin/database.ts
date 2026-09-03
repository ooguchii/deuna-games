import "server-only";

import {
  Pool,
  type PoolClient,
  type QueryResultRow,
} from "pg";

import {
  getAdminDatabaseConfig,
} from "./database-config";

let adminPool: Pool | null = null;

export function getAdminPool() {
  if (adminPool) return adminPool;

  adminPool = new Pool(
    getAdminDatabaseConfig("runtime")
  );

  adminPool.on("error", () => {
    console.error(
      "La conexión administrativa con PostgreSQL se interrumpió."
    );
  });

  return adminPool;
}

export async function adminQuery<
  Row extends QueryResultRow,
>(
  text: string,
  values: readonly unknown[] = []
) {
  return getAdminPool().query<Row>(
    text,
    [...values]
  );
}

export async function withAdminTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
) {
  const client =
    await getAdminPool().connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
