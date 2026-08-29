import "server-only";

import {
  adminQuery,
} from "./database";
import {
  verifyAdminSession,
} from "./session";

type CountRow = {
  active_sessions: string;
};

type EventRow = {
  id: string;
  event_type: string;
  occurred_at: Date;
};

export async function getAdminSecurityOverview() {
  const session = await verifyAdminSession();

  const [countResult, eventResult] =
    await Promise.all([
      adminQuery<CountRow>(
        `SELECT count(*)::text AS active_sessions
         FROM deuna_admin.admin_sessions
         WHERE user_id = $1
           AND revoked_at IS NULL
           AND expires_at > now()`,
        [session.userId]
      ),
      adminQuery<EventRow>(
        `SELECT
           id::text,
           event_type,
           occurred_at
         FROM deuna_admin.admin_events
         WHERE user_id = $1
         ORDER BY occurred_at DESC
         LIMIT 12`,
        [session.userId]
      ),
    ]);

  return {
    activeSessions: Number(
      countResult.rows[0]?.active_sessions ?? 0
    ),
    events: eventResult.rows.map((event) => ({
      id: event.id,
      type: event.event_type,
      occurredAt: event.occurred_at,
    })),
  };
}
