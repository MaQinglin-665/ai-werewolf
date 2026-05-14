import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const taskFilter = args.task ?? "both";
const jsonOutput = Boolean(args.json);
const personaFilter = readListArg(args.persona ?? args.personas);

if (args.retries !== undefined) {
  process.env.AI_LLM_MAX_RETRIES = String(args.retries);
}

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
  const [
    { createGame },
    { buildAgentView },
    { buildAiTableRead, createSpeechPlan, createVotePlan },
    { createMockCommand },
    { routedModelSpeechProvider },
    { routedModelActionProvider },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/engine.ts"),
    server.ssrLoadModule("/src/game/projection.ts"),
    server.ssrLoadModule("/src/ai/tableRead.ts"),
    server.ssrLoadModule("/src/ai/mockAgent.ts"),
    server.ssrLoadModule("/src/ai/speechProviders.ts"),
    server.ssrLoadModule("/src/ai/actionProviders.ts"),
  ]);

  const baseState = createGame({ seed: readInt(args.seed, 91), humanSeatId: readInt(args.human, 9) });
  const aiSeats = baseState.seats.filter(
    (seat) => seat.isAi && (personaFilter.length === 0 || personaFilter.includes(seat.name.toLowerCase())),
  );
  const results = [];

  for (const seat of aiSeats) {
    if (taskFilter === "both" || taskFilter === "speech") {
      results.push(await checkSpeech(seat, baseState, { buildAgentView, createSpeechPlan, routedModelSpeechProvider }));
    }

    if (taskFilter === "both" || taskFilter === "action") {
      results.push(
        await checkAction(seat, baseState, {
          buildAgentView,
          buildAiTableRead,
          createVotePlan,
          createMockCommand,
          routedModelActionProvider,
        }),
      );
    }
  }

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ summary: summarize(results), results }, null, 2)}\n`);
  } else {
    process.stdout.write(formatReport(results));
  }

  process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}

async function checkSpeech(seat, baseState, modules) {
  const state = structuredClone(baseState);
  state.phase = "DAY_SPEECH";
  state.day = 1;
  state.speechQueue = [seat.seatId];
  state.speechIndex = 0;

  const view = modules.buildAgentView(state, seat.seatId);
  const plan = modules.createSpeechPlan(view);
  const startedAt = performance.now();
  const result = await modules.routedModelSpeechProvider.generateSpeech(view, plan);

  return summarizeProviderResult({
    seat,
    task: "speech",
    provider: result.provider,
    isFallback: result.isFallback,
    error: result.error,
    validationErrors: result.validationErrors,
    rawOutput: result.rawOutput,
    outputBrief: result.speech ? `${result.speech.length} chars` : "",
    durationMs: performance.now() - startedAt,
  });
}

async function checkAction(seat, baseState, modules) {
  const state = structuredClone(baseState);
  state.phase = "DAY_VOTE";
  state.day = 1;
  state.votes = [];

  const view = modules.buildAgentView(state, seat.seatId);
  const tableRead = modules.buildAiTableRead(view);
  const votePlan = modules.createVotePlan(view, tableRead);
  const fallbackCommand = modules.createMockCommand(view, tableRead, votePlan);
  const startedAt = performance.now();
  const result = await modules.routedModelActionProvider.generateCommand(view, {
    tableRead,
    votePlan,
    fallbackCommand,
  });

  return summarizeProviderResult({
    seat,
    task: "action",
    provider: result.provider,
    isFallback: result.isFallback,
    error: result.error,
    validationErrors: result.validationErrors,
    rawOutput: result.rawOutput,
    outputBrief: commandBrief(result.command),
    durationMs: performance.now() - startedAt,
  });
}

function summarizeProviderResult(input) {
  const attempts = readAttempts(input.rawOutput);
  const firstIssue = attempts.find((attempt) => attempt.issue);
  const lastAttempt = attempts.at(-1);
  const issue = input.error ?? lastAttempt?.issue ?? firstIssue?.issue;
  const validationErrors = input.validationErrors ?? lastAttempt?.validationErrors ?? firstIssue?.validationErrors;
  const status = input.isFallback ? "FAIL" : firstIssue ? "RETRY_OK" : "OK";

  return {
    seatId: input.seat.seatId,
    persona: input.seat.name,
    task: input.task,
    status,
    provider: input.provider,
    attempts: Math.max(attempts.length, 1),
    durationMs: Math.round(input.durationMs),
    output: input.outputBrief,
    issue,
    validationErrors,
  };
}

function readAttempts(rawOutput) {
  if (Array.isArray(rawOutput)) {
    return rawOutput.map((attempt) => ({
      attempt: attempt?.attempt,
      provider: attempt?.provider,
      issue: attempt?.issue,
      validationErrors: attempt?.validationErrors,
    }));
  }

  return rawOutput ? [{ attempt: 1 }] : [];
}

function commandBrief(command) {
  if (!command) return "";
  if ("targetSeatId" in command && command.targetSeatId) return `${command.type} -> ${command.targetSeatId}`;
  if (command.type === "witchAction") return command.targetSeatId ? `${command.type}:${command.mode} -> ${command.targetSeatId}` : `${command.type}:${command.mode}`;
  return command.type;
}

function summarize(results) {
  return results.reduce(
    (acc, result) => {
      acc.total += 1;
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    },
    { total: 0, OK: 0, RETRY_OK: 0, FAIL: 0 },
  );
}

function formatReport(results) {
  const summary = summarize(results);
  const lines = [
    "LLM output health check",
    `total: ${summary.total}, OK: ${summary.OK}, RETRY_OK: ${summary.RETRY_OK}, FAIL: ${summary.FAIL}`,
    "",
    "Persona   Task    Status    Attempts  Time    Provider",
    "--------  ------  --------  --------  ------  --------",
  ];

  for (const result of results) {
    lines.push(
      `${pad(result.persona, 8)}  ${pad(result.task, 6)}  ${pad(result.status, 8)}  ${pad(String(result.attempts), 8)}  ${pad(
        `${result.durationMs}ms`,
        6,
      )}  ${result.provider}`,
    );
    if (result.issue) lines.push(`  issue: ${result.issue}`);
    if (result.validationErrors?.length) lines.push(`  validation: ${result.validationErrors.join("; ")}`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function pad(value, length) {
  const text = String(value);
  return text.length >= length ? text : `${text}${" ".repeat(length - text.length)}`;
}

function parseArgs(values) {
  return values.reduce((acc, value) => {
    if (!value.startsWith("--")) return acc;
    const [rawKey, rawValue] = value.slice(2).split("=");
    acc[rawKey] = rawValue ?? "true";
    return acc;
  }, {});
}

function readListArg(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}
