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
const validation = read("src/lib/accounts/rewards-validation.ts");
const panel = read("src/app/cuenta/AccountRewardsPanel.tsx");

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

if (issues.length > 0) {
  console.error("\nEconomía DeUna Rewards: ERROR\n");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  "Economía DeUna Rewards: OK (cooldown, racha, ciclo diario, objetivo semanal, hitos, idempotencia y autoridad del servidor verificados)."
);
