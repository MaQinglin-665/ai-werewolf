import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  buildEvalCaseFromAiLog,
  buildPromptfooCases,
  formatOrdinaryEvalMarkdown,
  parseArgs,
  readExistingCases,
  readNonNegativeInt,
  readNumber,
  readPositiveInt,
} from "./eval-ordinary-ai-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const source = String(args.source ?? (args.input ? "existing" : "mock"));
const games = readPositiveInt(args.games, 2);
const seedStart = readNonNegativeInt(args["seed-start"] ?? args.seed, 91);
const boardId = String(args.board ?? "9p-seer-witch-hunter");
const maxSteps = readPositiveInt(args["max-steps"], 160);
const maxCases = readPositiveInt(args["max-cases"], 80);
const humanSeatId = readPositiveInt(args["human-seat"] ?? args.human, 9);
const inputPath = args.input ? path.resolve(root, String(args.input)) : undefined;
const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;
const promptfooCasesOutPath = args["promptfoo-cases-out"]
  ? path.resolve(root, String(args["promptfoo-cases-out"]))
  : path.resolve(root, "tmp/ordinary-ai-promptfoo-cases.json");
const json = Boolean(args.json);
const judge = String(args.judge ?? "local");
const failBelow = readNumber(args["fail-below"], 0);
const failOnHighRisk = Boolean(args["fail-on-high-risk"]);

if (!["mock", "existing"].includes(source)) {
  throw new Error(`source=${source} is not implemented. Use --source=mock or --source=existing.`);
}

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { "@": path.join(root, "src") } },
});

try {
  const [{ advanceWithMockAi }, { createGame }, { analyzeOrdinaryAiEvalCase, summarizeOrdinaryAiEvalCases }] = await Promise.all([
    server.ssrLoadModule("/src/ai/mockAgent.ts"),
    server.ssrLoadModule("/src/game/engine.ts"),
    server.ssrLoadModule("/src/ai/llmEvaluation.ts"),
  ]);

  const cases =
    source === "existing"
      ? await readExistingCases(inputPath ?? path.resolve(root, "tmp/ordinary-ai-eval-cases.json"))
      : await buildMockCases({
          advanceWithMockAi,
          boardId,
          createGame,
          games,
          humanSeatId,
          maxCases,
          maxSteps,
          seedStart,
        });
  const boundedCases = cases.slice(0, maxCases);
  const results = boundedCases.map((item) => {
    const result = analyzeOrdinaryAiEvalCase(item);
    return { ...result, case: item };
  });
  const summary = summarizeOrdinaryAiEvalCases(results);
  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      source,
      boardId,
      games,
      seedStart,
      maxSteps,
      maxCases,
      inputPath: inputPath ? path.relative(root, inputPath) : undefined,
      judge,
      failBelow,
      failOnHighRisk,
    },
    summary,
    cases: boundedCases,
    results,
  };

  if (judge === "promptfoo") {
    await fs.mkdir(path.dirname(promptfooCasesOutPath), { recursive: true });
    await fs.writeFile(promptfooCasesOutPath, `${JSON.stringify(buildPromptfooCases(boundedCases), null, 2)}\n`, "utf8");
    report.options.promptfooCasesOut = path.relative(root, promptfooCasesOutPath);
  } else if (judge !== "local") {
    throw new Error(`Unsupported judge=${judge}. Use local or promptfoo.`);
  }

  const output = json ? `${JSON.stringify(report, null, 2)}\n` : formatOrdinaryEvalMarkdown(report);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, output, "utf8");
  }
  process.stdout.write(output);

  if ((failBelow > 0 && summary.averageScore < failBelow) || (failOnHighRisk && summary.highRiskCaseIds.length > 0)) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}

async function buildMockCases(options) {
  const cases = [];
  for (let index = 0; index < options.games && cases.length < options.maxCases; index += 1) {
    const seed = options.seedStart + index;
    const state = options.createGame({
      seed,
      boardId: options.boardId,
      humanSeatId: options.humanSeatId,
    });
    const result = await options.advanceWithMockAi(state, {
      ignoreHuman: true,
      maxSteps: options.maxSteps,
    });
    cases.push(
      ...result.aiLogs.map((log, logIndex) =>
        buildEvalCaseFromAiLog(log, logIndex, {
          source: "mock",
          seed,
          finalPhase: result.state.phase,
          winner: result.state.result?.winner,
        }),
      ),
    );
  }
  return cases.slice(0, options.maxCases);
}
