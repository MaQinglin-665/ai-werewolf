const POSTGRES_SCHEMES = new Set(["postgres:", "postgresql:"]);

const checks = [];
const warnings = [];

const origin = readEnv("AI_WEREWOLF_PUBLIC_ORIGIN") ?? readEnv("RENDER_EXTERNAL_URL");
const roomDatabaseUrl = readEnv("AI_WEREWOLF_ROOM_DATABASE_URL");
const mainGameDatabaseUrl = readEnv("AI_WEREWOLF_MAIN_GAME_DATABASE_URL") ?? roomDatabaseUrl;
const presenceDatabaseUrl = readEnv("AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL") ?? roomDatabaseUrl;
const rateLimitDatabaseUrl = readEnv("AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL") ?? roomDatabaseUrl;

check(
  "publicOrigin",
  isHttpsOrigin(origin),
  "Set AI_WEREWOLF_PUBLIC_ORIGIN or use a platform that provides RENDER_EXTERNAL_URL. The value must be a fixed HTTPS origin without a path.",
);
check(
  "AI_WEREWOLF_ROOM_DEPLOYMENT",
  readEnv("AI_WEREWOLF_ROOM_DEPLOYMENT") === "single-node-online",
  'Set AI_WEREWOLF_ROOM_DEPLOYMENT="single-node-online".',
);
check(
  "AI_WEREWOLF_ROOM_STORE_ADAPTER",
  readEnv("AI_WEREWOLF_ROOM_STORE_ADAPTER") === "postgres",
  'Set AI_WEREWOLF_ROOM_STORE_ADAPTER="postgres".',
);
check(
  "AI_WEREWOLF_MAIN_GAME_STORE_ADAPTER",
  readEnv("AI_WEREWOLF_MAIN_GAME_STORE_ADAPTER") === "postgres",
  'Set AI_WEREWOLF_MAIN_GAME_STORE_ADAPTER="postgres" so single-player games survive instance restarts.',
);
check(
  "AI_WEREWOLF_ROOM_REALTIME_ADAPTER",
  readEnv("AI_WEREWOLF_ROOM_REALTIME_ADAPTER") === "postgres",
  'Set AI_WEREWOLF_ROOM_REALTIME_ADAPTER="postgres".',
);
check(
  "AI_WEREWOLF_ROOM_PRESENCE_ADAPTER",
  readEnv("AI_WEREWOLF_ROOM_PRESENCE_ADAPTER") === "postgres",
  'Set AI_WEREWOLF_ROOM_PRESENCE_ADAPTER="postgres".',
);
check(
  "AI_WEREWOLF_ROOM_RATE_LIMIT",
  readEnv("AI_WEREWOLF_ROOM_RATE_LIMIT") !== "0",
  'Set AI_WEREWOLF_ROOM_RATE_LIMIT="1" or leave it enabled.',
);
check(
  "AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER",
  readEnv("AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER") === "postgres",
  'Set AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER="postgres".',
);
checkPostgresUrl("AI_WEREWOLF_ROOM_DATABASE_URL", roomDatabaseUrl);
checkPostgresUrl("AI_WEREWOLF_MAIN_GAME_DATABASE_URL", mainGameDatabaseUrl);
checkPostgresUrl("AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL", presenceDatabaseUrl);
checkPostgresUrl("AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL", rateLimitDatabaseUrl);
checkSqlitePrismaUrl();

if (readEnv("AI_SPEECH_PROVIDER") === "mock" || readEnv("AI_ACTION_PROVIDER") === "mock" || readEnv("AI_LLM_PROVIDER") === "mock") {
  warnings.push({
    name: "ai.mockMode",
    message: "AI provider env still contains mock mode. This is fine for public infrastructure smoke, but not for a real-model public playtest.",
  });
}

const failed = checks.filter((item) => !item.ok);
const result = {
  ok: failed.length === 0,
  checkedAt: new Date().toISOString(),
  passed: checks.filter((item) => item.ok).map((item) => item.name),
  failed,
  warnings,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.exitCode = 1;
}

function checkPostgresUrl(name, raw) {
  const url = parseUrl(raw);
  check(name, Boolean(url && POSTGRES_SCHEMES.has(url.protocol)), `Set ${name} to a postgresql:// connection string.`);
  if (url && POSTGRES_SCHEMES.has(url.protocol) && url.searchParams.get("sslmode") !== "require") {
    warnings.push({
      name,
      message: `${name} does not include sslmode=require. Most hosted PostgreSQL providers require TLS.`,
    });
  }
}

function checkSqlitePrismaUrl() {
  const raw = readEnv("DATABASE_URL");
  if (!raw) {
    warnings.push({
      name: "DATABASE_URL",
      message: "DATABASE_URL is empty. The current Prisma datasource is sqlite, so set a file: URL if single-player game history is needed.",
    });
    return;
  }

  const url = parseUrl(raw);
  check(
    "DATABASE_URL.sqliteProvider",
    !url || !POSTGRES_SCHEMES.has(url.protocol),
    "Do not point DATABASE_URL at PostgreSQL yet. The current Prisma datasource provider is sqlite; use AI_WEREWOLF_ROOM_DATABASE_URL for room PostgreSQL.",
  );
}

function isHttpsOrigin(raw) {
  const url = parseUrl(raw);
  return Boolean(url && url.protocol === "https:" && url.origin === raw && url.pathname === "/");
}

function parseUrl(raw) {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function check(name, ok, message) {
  checks.push(ok ? { name, ok: true } : { name, ok: false, message });
}
