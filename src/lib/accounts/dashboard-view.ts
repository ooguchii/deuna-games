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

export type AccountDashboardDestination = {
  id: AccountDashboardView;
  label: string;
  description: string;
};

export const accountDashboardDestinations = [
  {
    id: "overview",
    label: "Mi DeUna",
    description: "Resumen de tu cuenta",
  },
  {
    id: "rewards",
    label: "Recompensas",
    description: "Progreso, XP y créditos",
  },
  {
    id: "games",
    label: "Mis juegos",
    description: "Biblioteca y seguimiento",
  },
  {
    id: "pc",
    label: "Mi PC",
    description: "Hardware y rendimiento",
  },
  {
    id: "alerts",
    label: "Avisos",
    description: "Novedades de juegos seguidos",
  },
  {
    id: "discover",
    label: "Descubrimientos",
    description: "Sugerencias para ti",
  },
  {
    id: "profile",
    label: "Perfil privado",
    description: "Nombre, correo y bio",
  },
  {
    id: "settings",
    label: "Configuración",
    description: "Privacidad y cuenta",
  },
] as const satisfies readonly AccountDashboardDestination[];

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

export function accountDashboardViewHref(
  view: AccountDashboardView
) {
  return view === "overview"
    ? "/cuenta"
    : `/cuenta?vista=${view}`;
}
