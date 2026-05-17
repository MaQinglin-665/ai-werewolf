import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args["base-url"] ?? process.env.ROOM_SMOKE_BASE_URL ?? "http://127.0.0.1:3003").replace(/\/$/, "");
const includeVote = Boolean(args.vote) || process.env.ALPHA_SMOKE_INCLUDE_VOTE === "1";
const requireOnline = Boolean(args.online) || process.env.ROOM_SMOKE_REQUIRE_ONLINE === "1";
const maxSteps = args["max-steps"] ?? process.env.ROOM_ACTION_SMOKE_MAX_STEPS;

try {
  const initialHealth = await readHealth();
  assert(initialHealth.ok === true, "Room health endpoint did not report ok=true.");
  assert(initialHealth.storage?.enabled === true, "Room persistence is not enabled.");
  assert(initialHealth.realtime?.mode === "sse-in-process", `Unexpected realtime mode: ${initialHealth.realtime?.mode}`);
  assert(
    initialHealth.deployment?.target === "single-node" || initialHealth.deployment?.target === "single-node-online",
    `Unexpected deployment target: ${initialHealth.deployment?.target}`,
  );
  assert(initialHealth.deployment?.multiInstanceSafe === false, "Alpha smoke expects explicit single-node constraints.");
  if (requireOnline) {
    assert(initialHealth.deployment?.target === "single-node-online", "Online smoke requires AI_WEREWOLF_ROOM_DEPLOYMENT=single-node-online.");
    assert(initialHealth.deployment?.onlineReady === true, "Online smoke requires deployment.onlineReady=true.");
    assert(
      typeof initialHealth.deployment?.publicOrigin === "string" && initialHealth.deployment.publicOrigin.startsWith("https://"),
      "Online smoke requires an HTTPS public origin.",
    );
  }

  const checks = [
    runSmokeScript("room-sse", "room-sse-smoke.mjs"),
    runSmokeScript("room-action:first", "room-action-smoke.mjs"),
  ];

  if (includeVote) {
    checks.push(runSmokeScript("room-action:vote", "room-action-smoke.mjs", ["--coverage=vote"]));
  }

  const finalHealth = await readHealth();
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        baseUrl,
        health: {
          rooms: finalHealth.rooms,
          storage: finalHealth.storage,
          realtime: finalHealth.realtime,
          deployment: finalHealth.deployment,
        },
        checks,
        skipped: includeVote ? [] : ["room-action:vote"],
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function readHealth() {
  const response = await fetch(`${baseUrl}/api/rooms/health`);
  const data = await response.json().catch(() => null);
  assert(response.ok, `/api/rooms/health failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

function runSmokeScript(label, scriptName, scriptArgs = []) {
  const env = {
    ...process.env,
    ROOM_SMOKE_BASE_URL: baseUrl,
    ...(maxSteps === undefined ? {} : { ROOM_ACTION_SMOKE_MAX_STEPS: String(maxSteps) }),
  };
  const result = spawnSync(process.execPath, [join(scriptDir, scriptName), ...scriptArgs], {
    cwd: rootDir,
    encoding: "utf8",
    env,
  });

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

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    if (arg === "--vote") {
      parsed.vote = true;
      continue;
    }
    if (arg === "--online") {
      parsed.online = true;
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
