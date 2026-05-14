import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const boardId = args.board ?? args["board-id"] ?? process.env.SIM_BOARD_ID;
const gameCount = readPositiveInt(args.games ?? process.env.SIM_GAMES, 1000);
const seedStart = readNonNegativeInt(args["seed-start"] ?? process.env.SIM_SEED_START, 0);
const maxSteps = readPositiveInt(args["max-steps"] ?? process.env.SIM_MAX_STEPS, 500);
const json = Boolean(args.json);
const progressEvery = Math.max(1, Math.floor(gameCount / 10));

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "error",
  server: {
    middlewareMode: true,
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});

try {
  const { formatSimulationReport, runMockGameSimulation } = await server.ssrLoadModule("/src/game/simulationStats.ts");
  const summary = await runMockGameSimulation({
    boardId,
    gameCount,
    seedStart,
    maxSteps,
    progress(completed, total) {
      if (!process.stderr.isTTY) return;
      if (json || (completed !== total && completed % progressEvery !== 0)) return;
      process.stderr.write(`simulated ${completed}/${total}\n`);
    },
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatSimulationReport(summary)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}

function parseArgs(values) {
  return values.reduce((acc, value) => {
    if (!value.startsWith("--")) return acc;
    const [rawKey, rawValue] = value.slice(2).split("=");
    acc[rawKey] = rawValue ?? "true";
    return acc;
  }, {});
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
