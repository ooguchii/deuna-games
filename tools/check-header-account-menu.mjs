import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const header = read("src/components/layout/HeaderClient.tsx");
const headerServer = read("src/components/layout/Header.tsx");
const destinations = read("src/lib/accounts/dashboard-view.ts");
const accountCss = read("src/components/layout/HeaderAccountMenu.module.css");

const errors = [];
const requireMatch = (condition, message) => {
  if (!condition) errors.push(message);
};

requireMatch(
  /accountIdentity=/.test(headerServer) && /session\.username/.test(headerServer) && /session\.displayName/.test(headerServer),
  "Header server debe entregar identidad de sesión sin una consulta adicional de perfil."
);
requireMatch(
  /accountIdentity \? \(/.test(header),
  "HeaderClient debe separar explícitamente la experiencia autenticada de la invitada."
);
requireMatch(
  /href="\/cuenta\?modo=entrar"/.test(header) && /Iniciar sesión/.test(header),
  "El Header invitado debe mostrar una acción explícita para iniciar sesión."
);
requireMatch(
  !/accountIdentity \?[^]*:\s*\([^]*href="\/cuenta\?vista=alerts"/.test(header),
  "El estado invitado no debe representar una campana de cuenta como si hubiera sesión."
);
requireMatch(
  /type HeaderPopover = "notifications" \| "account" \| null/.test(header) && /activePopover/.test(header),
  "Avisos y menú de cuenta deben compartir un único estado excluyente de popover."
);
requireMatch(
  /aria-controls="header-account-menu"/.test(header) && /role="dialog"[^]*aria-label="Accesos de Mi DeUna"/.test(header),
  "El menú de Mi DeUna debe exponer contrato accesible de trigger y diálogo."
);
requireMatch(
  /window\.matchMedia\("\(max-width: 600px\)"\)/.test(header) && /openMobileMenu\("account"\)/.test(header),
  "En mobile el avatar debe reutilizar el panel nativo en vez de abrir un popover estrecho."
);
requireMatch(
  /logoutFromHeader/.test(header) && /\/api\/account\/logout/.test(header) && /method: "POST"/.test(header),
  "Cerrar sesión desde el Header debe reutilizar el endpoint POST de cuenta."
);
requireMatch(
  /accountDashboardDestinations/.test(header) && /accountDashboardViewHref/.test(header),
  "Los accesos del Header deben salir del contrato canónico de vistas de Mi DeUna."
);
for (const id of ["overview", "rewards", "games", "pc", "alerts", "discover", "profile", "settings"]) {
  requireMatch(
    new RegExp(`id: "${id}"`).test(destinations),
    `Falta el destino canónico ${id} en dashboard-view.ts.`
  );
}
requireMatch(
  /min-block-size:\s*52px/.test(accountCss) && /min-height:\s*44px/.test(accountCss),
  "Los accesos nuevos deben conservar targets táctiles >=44px."
);
requireMatch(
  /prefers-reduced-motion:\s*reduce/.test(accountCss),
  "La nueva UI del Header debe respetar reduced motion."
);

if (errors.length > 0) {
  console.error("\nMenú de cuenta del Header: ERROR\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  "Menú de cuenta del Header: OK (invitado explícito, popovers excluyentes, accesos canónicos, logout POST, mobile y targets táctiles)."
);
