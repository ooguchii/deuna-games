import "server-only";

import type {
  PoolClient,
  QueryResultRow,
} from "pg";

import {
  getAdminPool,
} from "@/lib/admin/database";

export async function accountQuery<
  Row extends QueryResultRow,
>(
  text: string,
  values: readonly unknown[] = []
) {
  return getAdminPool().query<Row>(text, [...values]);
}

export async function withAccountTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
) {
  const client = await getAdminPool().connect();

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
