import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const args = parseArgs(process.argv.slice(2));
const rawBaseUrl = String(args["base-url"] ?? process.env.ROOM_SMOKE_BASE_URL ?? "").trim();
const requireSse = Boolean(args["require-sse"]) || process.env.ROOM_TUNNEL_REQUIRE_SSE === "1";

try {
  assert(rawBaseUrl, "Set ROOM_SMOKE_BASE_URL to your temporary HTTPS tunnel origin.");
  const tunnelOrigin = normalizeOrigin(rawBaseUrl);
  assert(tunnelOrigin.startsWith("https://"), "Tunnel smoke requires an HTTPS URL.");
  assert(!isLocalOrigin(tunnelOrigin), "Tunnel smoke must target a public tunnel URL, not localhost or a LAN address.");

  const initialHealth = await readHealth(tunnelOrigin);
  const deployment = initialHealth.deployment ?? {};
  const warnings = [];

  if (deployment.target === "single-node-online") {
    assert(deployment.onlineReady === true, "single-node-online is configured but deployment.onlineReady is not true.");
    assert(
      normalizeOrigin(deployment.publicOrigin) === tunnelOrigin,
      `AI_WEREWOLF_PUBLIC_ORIGIN does not match the tunnel origin. Expected ${tunnelOrigin}, got ${deployment.publicOrigin ?? "<empty>"}.`,
    );
  } else {
    warnings.push(
      "Running tunnel smoke in local single-node mode. Invite links still work when copied from the tunnel page, but smoke:online requires AI_WEREWOLF_ROOM_DEPLOYMENT=single-node-online and AI_WEREWOLF_PUBLIC_ORIGIN set to this tunnel origin.",
    );
  }

  const checks = [runRequiredSmokeScript("room-action:first", "room-action-smoke.mjs")];
  const sseCheck = runOptionalSmokeScript("room-sse", "room-sse-smoke.mjs", [], {
    ROOM_SSE_SMOKE_EVENT_TIMEOUT_MS: process.env.ROOM_SSE_SMOKE_EVENT_TIMEOUT_MS ?? "15000",
  });
  if (sseCheck.ok) {
    checks.push(sseCheck);
  } else if (requireSse) {
    throw new Error(`room-sse failed through the tunnel and ROOM_TUNNEL_REQUIRE_SSE=1: ${sseCheck.error}`);
  } else {
    checks.push({ label: "room-sse", ok: false, optional: true });
    warnings.push(
      `SSE did not deliver events through this temporary tunnel within the smoke timeout: ${sseCheck.error}. The room UI still has polling fallback, but real-time updates may be slower.`,
    );
  }

  const finalHealth = await readHealth(tunnelOrigin);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        tunnelOrigin,
        deployment: finalHealth.deployment,
        checks,
        warnings,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function readHealth(origin) {
  const response = await fetch(`${origin}/api/rooms/health`);
  const data = await response.json().catch(() => null);
  assert(response.ok, `/api/rooms/health failed: ${response.status} ${JSON.stringify(data)}`);
  assert(data?.ok === true, "Room health endpoint did not report ok=true.");
  return data;
}

function runRequiredSmokeScript(label, scriptName, scriptArgs = [], envExtra = {}) {
  const result = runSmokeScript(scriptName, scriptArgs, envExtra);

  if (result.stdout) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith("\n")) process.stdout.write("\n");
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith("\n")) process.stderr.write("\n");
  }
  assert(result.status === 0, `${label} failed with exit code ${result.status}.`);

  return {
    label,
    ok: true,
  };
}

function runOptionalSmokeScript(label, scriptName, scriptArgs = [], envExtra = {}) {
  const result = runSmokeScript(scriptName, scriptArgs, envExtra);
  if (result.status === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
      if (!result.stdout.endsWith("\n")) process.stdout.write("\n");
    }
    return { label, ok: true };
  }
  return {
    label,
    ok: false,
    error: `${result.stderr || result.stdout || `exit code ${result.status}`}`.trim(),
  };
}

function runSmokeScript(scriptName, scriptArgs, envExtra) {
  return spawnSync(process.execPath, [join(scriptDir, scriptName), ...scriptArgs], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ROOM_SMOKE_BASE_URL: normalizeOrigin(rawBaseUrl),
      ...envExtra,
    },
  });
}

function normalizeOrigin(value) {
  try {
    const raw = /^https?:\/\//i.test(String(value)) ? String(value) : `https://${value}`;
    return new URL(raw).origin;
  } catch {
    throw new Error(`Invalid tunnel URL: ${value}`);
  }
}

function isLocalOrigin(origin) {
  const hostname = new URL(origin).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [first, second] = parts;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    if (arg === "--require-sse") {
      parsed["require-sse"] = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      parsed[match[1]] = match[2];
    }
  }
  return parsed;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
