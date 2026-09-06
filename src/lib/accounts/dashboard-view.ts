export const accountDashboardViews = [
  "overview",
  "rewards",
  "games",
  "pc",
  "alerts",
  "discover",
  "profile",
  "settings",
] as const;

export type AccountDashboardView =
  (typeof accountDashboardViews)[number];

export function resolveAccountDashboardView(
  value: string | string[] | undefined
): AccountDashboardView {
  const candidate = Array.isArray(value) ? value[0] : value;

  return accountDashboardViews.includes(
    candidate as AccountDashboardView
  )
    ? (candidate as AccountDashboardView)
    : "overview";
}
