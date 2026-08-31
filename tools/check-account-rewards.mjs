import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const issues = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) issues.push(message);
}

function forbidPattern(content, pattern, message) {
  if (pattern.test(content)) issues.push(message);
}

const service = read("src/lib/accounts/rewards-service.ts");
const migration = read("database/migrations/011_account_rewards.sql");
const route = read("src/app/api/account/rewards/claim/route.ts");
const gamesRoute = read("src/app/api/account/games/route.ts");
const hardwareRoute = read("src/app/api/account/hardware/route.ts");
const validation = read("src/lib/accounts/rewards-validation.ts");
const panel = read("src/app/cuenta/AccountRewardsPanel.tsx");
const privacyPage = read("src/app/privacidad/page.tsx");
const footer = read("src/components/layout/Footer.tsx");

requirePattern(
  service,
  /const CLAIM_COOLDOWN_MS = 20 \* 60 \* 60 \* 1000;/,
  "Rewards debe conservar un mínimo de 20 horas entre reclamos."
);
requirePattern(
  service,
  /const STREAK_GRACE_MS = 60 \* 60 \* 60 \* 1000;/,
  "Rewards debe conservar 60 horas de gracia para la racha."
);
requirePattern(
  service,
  /SELECT user_id[\s\S]*FROM deuna_accounts\.reward_profiles[\s\S]*FOR UPDATE/s,
  "El reclamo debe serializarse bloqueando el perfil de Rewards."
);
requirePattern(
  service,
  /elapsed !== null && elapsed < CLAIM_COOLDOWN_MS/,
  "El servicio debe negar reclamos antes del cooldown."
);
requirePattern(
  service,
  /elapsed !== null && elapsed <= STREAK_GRACE_MS[\s\S]*profile\.streak_days \+ 1[\s\S]*: 1/s,
  "La racha debe continuar sólo dentro de la ventana de gracia y reiniciarse fuera de ella."
);

const dailyBlock = service.match(/const dailyRewards = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const daily = [...dailyBlock.matchAll(/\{ day: (\d+), xp: (\d+), credits: (\d+) \}/g)]
  .map((match) => ({
    day: Number(match[1]),
    xp: Number(match[2]),
    credits: Number(match[3]),
  }));
const expectedDaily = [
  { day: 1, xp: 10, credits: 5 },
  { day: 2, xp: 10, credits: 5 },
  { day: 3, xp: 12, credits: 7 },
  { day: 4, xp: 12, credits: 7 },
  { day: 5, xp: 15, credits: 10 },
  { day: 6, xp: 15, credits: 10 },
  { day: 7, xp: 35, credits: 25 },
];

if (JSON.stringify(daily) !== JSON.stringify(expectedDaily)) {
  issues.push("La tabla diaria de Rewards cambió sin actualizar el contrato económico esperado.");
}

const milestoneBlock = service.match(/const milestoneDefinitions = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const expectedMilestones = new Map([
  ["first_game", [20, 10]],
  ["library_5", [60, 30]],
  ["favorites_3", [40, 20]],
  ["follow_2", [40, 20]],
  ["pc_configured", [50, 25]],
]);
const seenMilestones = new Map();

for (const match of milestoneBlock.matchAll(/key: "([a-z0-9_]+)"[\s\S]*?xp: (\d+),\s*credits: (\d+),/g)) {
  seenMilestones.set(match[1], [Number(match[2]), Number(match[3])]);
}

if (
  seenMilestones.size !== expectedMilestones.size ||
  [...expectedMilestones].some(([key, values]) =>
    JSON.stringify(seenMilestones.get(key)) !== JSON.stringify(values)
  )
) {
  issues.push("Los hitos o sus recompensas cambiaron sin actualizar el contrato económico esperado.");
}

requirePattern(
  service,
  /VALUES \(\$1, \$2, 'weekly_bonus', \$3, 25, 15, \$4\)/,
  "El bonus semanal debe permanecer en +25 XP y +15 créditos."
);
requirePattern(
  service,
  /if \(\(weekClaims\.rows\[0\]\?\.count \?\? 0\) >= 3\)/,
  "El objetivo semanal debe exigir al menos tres reclamos."
);
requirePattern(
  service,
  /ON CONFLICT \(user_id, event_type, event_key\) DO NOTHING/g,
  "Los premios repetibles por clave deben ser idempotentes."
);

requirePattern(
  migration,
  /UNIQUE \(user_id, event_type, event_key\)/,
  "El ledger debe reforzar la idempotencia también en PostgreSQL."
);
requirePattern(
  migration,
  /event_type IN \('daily_claim', 'weekly_bonus', 'milestone'\)/,
  "PostgreSQL debe aceptar únicamente los tipos de evento Rewards implementados."
);
requirePattern(
  migration,
  /credits_delta >= 0 AND credits_delta <= 1000000/,
  "Mientras no exista canje, el ledger no debe admitir descuentos de créditos."
);
requirePattern(
  migration,
  /CONSTRAINT reward_events_economy_check CHECK \([\s\S]*event_type = 'daily_claim'[\s\S]*event_type = 'weekly_bonus'[\s\S]*event_type = 'milestone'/s,
  "PostgreSQL debe reforzar también la forma de la economía de Rewards."
);
for (const milestone of expectedMilestones.keys()) {
  requirePattern(
    migration,
    new RegExp(`\\('${milestone}',`),
    `El contrato PostgreSQL debe reconocer el hito ${milestone}.`
  );
}

requirePattern(
  validation,
  /intent: z\.literal\("claim"\)/,
  "El endpoint de Rewards sólo debe aceptar la intención fija claim."
);
requirePattern(
  route,
  /const fields = \["intent"\] as const;/,
  "El reclamo no debe aceptar XP, créditos, racha ni cantidades desde el cliente."
);
forbidPattern(
  route,
  /form\.get\("(?:xp|credits|streak|amount|reward)"\)/,
  "El cliente no puede indicar valores económicos al reclamar Rewards."
);

for (const [label, source] of [
  ["Mis juegos", gamesRoute],
  ["Mi PC", hardwareRoute],
]) {
  requirePattern(
    source,
    /syncRewardMilestones\(session\.userId\)\.catch\(\(\) => \{\}\)/,
    `${label} debe tratar Rewards como consecuencia idempotente y no convertir un guardado correcto en falso error.`
  );
}

requirePattern(
  panel,
  /No premiamos tiempo de pantalla, clics ni navegación\./,
  "La interfaz debe explicar que Rewards no remunera seguimiento de navegación."
);
requirePattern(
  panel,
  /Nivel \{rewards\.level\.level\}/,
  "Rewards debe mostrar progreso de nivel."
);
requirePattern(
  panel,
  /rewards\.creditsBalance/,
  "Rewards debe mostrar el saldo real de Créditos DeUna."
);
requirePattern(
  panel,
  /Los créditos no son dinero/,
  "Rewards debe aclarar que los créditos no son dinero."
);
requirePattern(
  panel,
  /no vencen por inactividad mientras la cuenta exista/i,
  "Rewards debe explicar que el saldo actual no caduca por inactividad."
);
requirePattern(
  panel,
  /el canje todavía no está habilitado/,
  "Rewards no debe insinuar un canje que todavía no existe."
);
requirePattern(
  panel,
  /Sin premios aleatorios/,
  "Rewards debe declarar que la economía actual es determinista."
);
requirePattern(
  panel,
  /La semana reinicia cada lunes a las 00:00 UTC\./,
  "La interfaz debe hacer visible el límite temporal real del objetivo semanal."
);
requirePattern(
  panel,
  /function formatClaimAvailability[\s\S]*timeZone: "UTC"[\s\S]*return `\$\{formatted\} UTC`/s,
  "La disponibilidad de Rewards debe formatearse con una zona estable para evitar diferencias de hidratación."
);
requirePattern(
  panel,
  /function formatDate[\s\S]*timeZone: "UTC"/s,
  "Las fechas del ledger deben usar una zona estable en servidor y navegador."
);
requirePattern(
  panel,
  /href="\/privacidad"/,
  "Rewards debe enlazar su explicación pública de privacidad."
);

requirePattern(
  privacyPage,
  /index: false[\s\S]*follow: false/s,
  "El aviso técnico de privacidad debe permanecer no indexado hasta completar los datos legales previos al lanzamiento."
);
requirePattern(
  privacyPage,
  /identificación jurídica del responsable[\s\S]*canal de contacto[\s\S]*plazo concreto de[\s\S]*retención de copias de seguridad/s,
  "El aviso debe identificar claramente la información legal todavía pendiente."
);
requirePattern(
  privacyPage,
  /no persiste IP,[\s\S]*ubicación,[\s\S]*user-agent,[\s\S]*historial de[\s\S]*navegación/s,
  "El aviso de privacidad debe describir la minimización de Mi DeUna."
);
requirePattern(
  privacyPage,
  /Los Créditos DeUna son un[\s\S]*saldo interno sin valor monetario ni conversión a efectivo/s,
  "El aviso de privacidad debe explicar la naturaleza no monetaria de los créditos."
);
requirePattern(
  footer,
  /<Link href="\/privacidad">Privacidad<\/Link>/,
  "El aviso de privacidad debe ser accesible desde el footer público."
);

if (issues.length > 0) {
  console.error("\nEconomía DeUna Rewards: ERROR\n");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  "Economía DeUna Rewards: OK (cooldown, racha, ciclo diario, objetivo semanal, hitos, PostgreSQL, resiliencia, transparencia, fechas estables, idempotencia y autoridad del servidor verificados)."
);
