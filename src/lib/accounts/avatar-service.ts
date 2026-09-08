import "server-only";

import {
  accountQuery,
} from "./database";

type AccountAvatarRow = {
  digest: string;
  image_webp: Buffer;
  width: number;
  height: number;
  updated_at: Date;
};

type AccountAvatarMetadataRow = {
  updated_at: Date;
};

export type AccountAvatar = {
  digest: string;
  imageWebp: Buffer;
  width: number;
  height: number;
  updatedAt: Date;
};

export type AccountAvatarMetadata = {
  updatedAt: Date;
};

export async function getAccountAvatarMetadata(
  userId: string
): Promise<AccountAvatarMetadata | null> {
  const result = await accountQuery<AccountAvatarMetadataRow>(
    `SELECT updated_at
     FROM deuna_accounts.avatars
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];

  return row
    ? { updatedAt: row.updated_at }
    : null;
}

export async function getAccountAvatar(
  userId: string
): Promise<AccountAvatar | null> {
  const result = await accountQuery<AccountAvatarRow>(
    `SELECT
       digest,
       image_webp,
       width,
       height,
       updated_at
     FROM deuna_accounts.avatars
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    digest: row.digest,
    imageWebp: row.image_webp,
    width: row.width,
    height: row.height,
    updatedAt: row.updated_at,
  };
}

export async function saveAccountAvatar(
  userId: string,
  input: {
    digest: string;
    imageWebp: Buffer;
    width: number;
    height: number;
  }
) {
  await accountQuery(
    `INSERT INTO deuna_accounts.avatars
       (
         user_id,
         digest,
         image_webp,
         width,
         height,
         updated_at
       )
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       digest = EXCLUDED.digest,
       image_webp = EXCLUDED.image_webp,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       updated_at = now()`,
    [
      userId,
      input.digest,
      input.imageWebp,
      input.width,
      input.height,
    ]
  );
}

export async function deleteAccountAvatar(
  userId: string
) {
  await accountQuery(
    `DELETE FROM deuna_accounts.avatars
     WHERE user_id = $1`,
    [userId]
  );
}
