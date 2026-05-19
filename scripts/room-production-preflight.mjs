if (readFlag("help") || readFlag("h")) {
  process.stdout.write(`Usage:
  ROOM_SMOKE_BASE_URL=https://werewolf.example.com npm run preflight:production
  npm run preflight:production -- --base-url=https://werewolf.example.com

Checks /api/rooms/health for the production minimum loop:
  - fixed HTTPS public origin
  - PostgreSQL room state
  - PostgreSQL main single-player snapshots
  - PostgreSQL realtime fanout
  - PostgreSQL player presence
  - PostgreSQL shared rate limit
`);
  process.exit(0);
}

const baseUrl = readBaseUrl();
const baseOrigin = new URL(baseUrl).origin;
const localBaseUrl = isLocalhost(new URL(baseUrl).hostname);
const expectedPublicOrigin = readExpectedPublicOrigin();

try {
  const result = await runProductionPreflight();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function runProductionPreflight() {
  const health = await getJson("/api/rooms/health");
  const checks = [
    check("health.ok", health.ok === true, "Health endpoint did not return ok=true."),
    check(
      "deployment.target",
      health.deployment?.target === "single-node-online",
      'AI_WEREWOLF_ROOM_DEPLOYMENT must be "single-node-online".',
    ),
    check(
      "deployment.onlineReady",
      localBaseUrl || health.deployment?.onlineReady === true,
      "Online readiness is false. Check HTTPS origin, persistence, and SSE readiness.",
    ),
    check(
      "deployment.productionMinimumReady",
      localBaseUrl || health.deployment?.productionMinimumReady === true,
      "Production minimum readiness is false. Check PostgreSQL adapters and rate limits.",
    ),
    check(
      "deployment.publicOrigin",
      typeof health.deployment?.publicOrigin === "string" &&
        (health.deployment.publicOrigin.startsWith("https://") || (localBaseUrl && health.deployment.publicOrigin === baseOrigin)),
      "Public origin must be configured as an HTTPS origin, except for localhost smoke.",
    ),
    check(
      "deployment.publicOriginMatchesBaseUrl",
      health.deployment?.publicOrigin === (expectedPublicOrigin ?? baseOrigin),
      `Public origin should match ${expectedPublicOrigin ?? `the checked base URL ${baseOrigin}`}.`,
    ),
    check("storage.adapter", health.storage?.adapter === "postgres-room-store", "Room store adapter must be postgres-room-store."),
    check("storage.mode", health.storage?.mode === "postgres", "Room storage mode must be postgres."),
    check("storage.atomicWrites", health.storage?.atomicWrites === true, "Room storage must report atomic writes."),
    check(
      "mainGameStorage.mode",
      health.mainGameStorage?.mode === "postgres",
      "Main single-player game storage must use Postgres so mobile background/instance restart recovery does not lose the active game.",
    ),
    check(
      "mainGameStorage.durableAcrossInstanceRestart",
      health.mainGameStorage?.durableAcrossInstanceRestart === true,
      "Main single-player game storage must be durable across instance restarts.",
    ),
    check(
      "realtime.mode",
      health.realtime?.mode === "postgres-notify",
      "Realtime adapter must be postgres-notify.",
    ),
    check(
      "realtime.crossProcessFanout",
      health.realtime?.crossProcessFanout === true,
      "Realtime fanout must be cross-process.",
    ),
    check("presence.adapter", health.presence?.adapter === "postgres", "Presence adapter must be postgres."),
    check("presence.shared", health.presence?.shared === true, "Presence must be shared."),
    check("rateLimit.enabled", health.rateLimit?.enabled === true, "Room rate limiting must be enabled."),
    check("rateLimit.adapter", health.rateLimit?.adapter === "postgres", "Rate limit adapter must be postgres."),
    check("rateLimit.shared", health.rateLimit?.shared === true, "Rate limit must be shared."),
    ...requiredDeploymentRequirementChecks(health.deployment?.requirements),
  ];

  const failed = checks.filter((item) => !item.ok);
  return {
    ok: failed.length === 0,
    baseUrl,
    checkedAt: new Date().toISOString(),
    passed: checks.filter((item) => item.ok).map((item) => item.name),
    failed,
    health: {
      deployment: {
        target: health.deployment?.target,
        onlineReady: health.deployment?.onlineReady,
        productionMinimumReady: health.deployment?.productionMinimumReady,
        publicOrigin: health.deployment?.publicOrigin,
      },
      presence: health.presence,
      rateLimit: {
        adapter: health.rateLimit?.adapter,
        enabled: health.rateLimit?.enabled,
        shared: health.rateLimit?.shared,
      },
      realtime: {
        crossProcessFanout: health.realtime?.crossProcessFanout,
        mode: health.realtime?.mode,
      },
      storage: {
        adapter: health.storage?.adapter,
        mode: health.storage?.mode,
        writeMode: health.storage?.writeMode,
      },
      mainGameStorage: health.mainGameStorage,
    },
  };
}

function requiredDeploymentRequirementChecks(requirements) {
  const requiredNames = [
    "atomicRoomWrites",
    "basicRateLimit",
    "httpsPublicOrigin",
    "mainGameDurableStore",
    "persistentRoomStore",
    "postgresRoomState",
    "sharedPresence",
    "sharedRateLimit",
    "sharedRealtime",
    "singleNodeProcess",
    "sseRealtime",
  ];
  return requiredNames.map((name) => {
    const ok = name === "httpsPublicOrigin" && localBaseUrl ? true : requirements?.[name] === true;
    return check(`deployment.requirements.${name}`, ok, `Deployment requirement ${name} must be true.`);
  });
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `${path} failed: ${response.status} ${JSON.stringify(data)}`);
  assert(data && typeof data === "object", `${path} did not return a JSON object.`);
  return data;
}

function check(name, ok, message) {
  return ok ? { name, ok: true } : { name, ok: false, message };
}

function readBaseUrl() {
  const raw = readOption("base-url") ?? process.env.ROOM_SMOKE_BASE_URL ?? process.env.AI_WEREWOLF_PUBLIC_ORIGIN;
  assert(raw, "Set ROOM_SMOKE_BASE_URL or pass --base-url=https://your-domain.example.");
  const url = new URL(raw);
  assert(url.protocol === "https:" || isLocalhost(url.hostname), "Production preflight requires HTTPS unless checking localhost.");
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function readExpectedPublicOrigin() {
  const raw = readOption("expected-public-origin") ?? process.env.ROOM_SMOKE_EXPECTED_PUBLIC_ORIGIN;
  if (!raw) return undefined;
  const url = new URL(raw);
  assert(url.protocol === "https:" || isLocalhost(url.hostname), "Expected public origin must be HTTPS unless checking localhost.");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}

function readFlag(name) {
  return process.argv.slice(2).some((arg) => arg === `--${name}`);
}

function readOption(name) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
