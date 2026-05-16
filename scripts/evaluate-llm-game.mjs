import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const gameCount = readPositiveInt(args.games, 1);
const seedStart = readNonNegativeInt(args.seed ?? args["seed-start"], 91);
const humanSeatId = readPositiveInt(args.human, 9);
const maxSteps = readPositiveInt(args["max-steps"], 120);
const maxLlmCalls = readPositiveInt(args["max-llm-calls"], 8);
const autoHuman = readAutoHuman(args["auto-human"]);
const realPhases = readRealPhases(args["real-phases"]);
const boardId = args.board ?? args["board-id"];
const jsonOutput = Boolean(args.json);
const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;
const allowMock = Boolean(args["allow-mock"]);
const failOnError = Boolean(args["fail-on-error"]);

if (args.provider) process.env.AI_LLM_PROVIDER = String(args.provider);
if (args.retries !== undefined) process.env.AI_LLM_MAX_RETRIES = String(args.retries);

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "error",
  server: {
    hmr: false,
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
    { applyCommand, applySystemStep, createGame, getTurnRequirement },
    { buildAgentView },
    { buildAiTableRead, createSpeechPlan, createVotePlan },
    { createConfiguredAiOptions, createMockCommand, mockActionProvider },
    { mockSpeechProvider },
    { refreshAiSeatMemory, rememberAiDecision, storeAiSeatMemory },
  ] = await Promise.all([
    server.ssrLoadModule("/src/game/engine.ts"),
    server.ssrLoadModule("/src/game/projection.ts"),
    server.ssrLoadModule("/src/ai/tableRead.ts"),
    server.ssrLoadModule("/src/ai/mockAgent.ts"),
    server.ssrLoadModule("/src/ai/speechProviders.ts"),
    server.ssrLoadModule("/src/ai/seatMemory.ts"),
  ]);

  const realProviders = createConfiguredAiOptions();
  assertRealProviders(realProviders, allowMock);
  const modules = {
    applyCommand,
    applySystemStep,
    buildAgentView,
    buildAiTableRead,
    createMockCommand,
    createSpeechPlan,
    createVotePlan,
    getTurnRequirement,
    refreshAiSeatMemory,
    rememberAiDecision,
    storeAiSeatMemory,
  };
  const mockProviders = {
    speechProvider: mockSpeechProvider,
    actionProvider: mockActionProvider,
  };

  const games = [];
  for (let index = 0; index < gameCount; index += 1) {
    const seed = seedStart + index;
    const initialState = createGame({ seed, humanSeatId, ...(boardId ? { boardId } : {}) });
    games.push(
      await evaluateGame(initialState, modules, {
        autoHuman,
        maxLlmCalls,
        maxSteps,
        mockProviders,
        realPhases,
        realProviders,
        seed,
      }),
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      autoHuman,
      boardId: boardId ?? "default",
      gameCount,
      humanSeatId,
      maxLlmCalls,
      maxSteps,
      realPhases: realPhases ? [...realPhases] : ["ALL_AI_PHASES"],
      seedStart,
    },
    summary: summarizeGames(games),
    games,
  };

  const output = jsonOutput ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, output, "utf8");
  }
  process.stdout.write(output);
  process.exitCode = failOnError && (report.summary.fallbackCount > 0 || report.summary.errorCount > 0) ? 1 : 0;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}

async function evaluateGame(initialState, modules, options) {
  let state = initialState;
  const calls = [];
  let stopReason = "max_steps";
  let systemSteps = 0;
  let mockHumanTurns = 0;

  for (let step = 0; step < options.maxSteps; step += 1) {
    const requirement = modules.getTurnRequirement(state);
    if (requirement.type === "none") {
      stopReason = "game_finished";
      break;
    }

    if (calls.length >= options.maxLlmCalls) {
      stopReason = "max_llm_calls";
      break;
    }

    if (requirement.type === "system") {
      state = modules.applySystemStep(state);
      systemSteps += 1;
      continue;
    }

    if (requirement.type === "human" && options.autoHuman === "stop") {
      stopReason = "human_action";
      break;
    }

    const useRealProvider = shouldUseRealProvider(requirement, options);
    const providers = useRealProvider ? options.realProviders : options.mockProviders;
    const startedAt = performance.now();
    const decision = await evaluateDecision(state, requirement, modules, providers);
    const durationMs = Math.round(performance.now() - startedAt);
    state = decision.state;

    if (useRealProvider) {
      calls.push(summarizeCall(decision.aiLog, durationMs));
    } else {
      mockHumanTurns += 1;
    }
  }

  return {
    seed: options.seed,
    gameId: state.id,
    stopReason,
    result: state.result,
    day: state.day,
    phase: state.phase,
    calls,
    callCount: calls.length,
    systemSteps,
    mockHumanTurns,
  };
}

async function evaluateDecision(initialState, requirement, modules, providers) {
  let view = modules.buildAgentView(initialState, requirement.actorSeatId);
  let tableRead = modules.buildAiTableRead(view);
  const refreshedMemory = modules.refreshAiSeatMemory(view, tableRead);
  view = { ...view, privateKnowledge: { ...view.privateKnowledge, aiMemory: refreshedMemory } };
  tableRead = modules.buildAiTableRead(view);
  const speechPlan = initialState.phase === "DAY_SPEECH" ? modules.createSpeechPlan(view, tableRead) : undefined;
  const votePlan = initialState.phase === "DAY_VOTE" ? modules.createVotePlan(view, tableRead) : undefined;
  const speechResult = speechPlan ? await providers.speechProvider.generateSpeech(view, speechPlan) : undefined;
  const actionResult = speechPlan
    ? undefined
    : await providers.actionProvider.generateCommand(view, {
        tableRead,
        votePlan,
        fallbackCommand: modules.createMockCommand(view, tableRead, votePlan),
      });
  const output = speechPlan
    ? { type: "speak", actorSeatId: requirement.actorSeatId, message: speechResult?.speech ?? "", reason: speechPlan.stance }
    : actionResult.command;
  const memoryAfterDecision = modules.rememberAiDecision(refreshedMemory, output, speechPlan, votePlan);
  const state = modules.storeAiSeatMemory(modules.applyCommand(initialState, output), memoryAfterDecision);

  return {
    state,
    aiLog: {
      gameId: state.id,
      seatNumber: requirement.actorSeatId,
      phase: requirement.phase,
      provider: speechResult?.provider ?? actionResult?.provider ?? "unknown",
      prompt: view,
      output,
      votePlan,
      speechPlan,
      publicFactBasis: buildPublicFactBasis(view),
      rawOutput: speechResult?.rawOutput ?? actionResult?.rawOutput,
      isFallback: speechResult?.isFallback ?? actionResult?.isFallback ?? false,
      error: speechResult?.error ?? actionResult?.error,
      validationErrors: speechResult?.validationErrors ?? actionResult?.validationErrors,
    },
  };
}

function summarizeCall(log, durationMs) {
  const reasoningCues = log.prompt.publicSummary.tableMemory.reasoningCues ?? [];
  const speechInfluence = log.prompt.publicSummary.tableMemory.speechInfluence ?? [];
  const outputText = commandText(log.output);
  const referencedCues = reasoningCues.filter((cue) => cueMatchesOutput(cue, outputText));
  const attempts = Array.isArray(log.rawOutput) ? log.rawOutput : [];
  const validationErrors = log.validationErrors ?? [];
  const failureType = classifyFailure(log, attempts, validationErrors);

  return {
    id: `${log.gameId}:${log.phase}:${log.seatNumber}:${durationMs}`,
    day: log.prompt.day,
    phase: log.phase,
    task: log.output.type === "speak" ? "speech" : "action",
    seatNumber: log.seatNumber,
    persona: log.prompt.persona?.name ?? "Human",
    role: log.prompt.myRole,
    provider: log.provider,
    durationMs,
    isFallback: log.isFallback,
    failureType,
    validationErrors,
    error: log.error,
    attempts: Math.max(1, attempts.length),
    publicFactBasisCount: log.publicFactBasis?.length ?? 0,
    reasoningCueCount: reasoningCues.length,
    speechInfluenceCount: speechInfluence.length,
    referencedReasoningCueCount: referencedCues.length,
    referencedReasoningCueIds: referencedCues.map((cue) => cue.cueId),
    inputSummary: {
      recentSpeeches: log.prompt.publicSummary.recentSpeeches.slice(-3).map((speech) => ({
        day: speech.day,
        speaker: speech.speaker ? seatText(speech.speaker) : "unknown",
        message: clip(speech.message, 96),
      })),
      voteLeaders: log.prompt.publicSummary.voteSnapshot.leaders.map(seatText),
      reasoningCues: reasoningCues.slice(0, 5).map((cue) => ({
        id: cue.cueId,
        kind: cue.kind,
        weight: cue.weight,
        summary: cue.summary,
      })),
    },
    output: briefCommand(log.output),
    outputText: clip(outputText, 300),
  };
}

function buildPublicFactBasis(view) {
  const cues = view.publicSummary.tableMemory.reasoningCues ?? [];
  const signals = view.publicSummary.tableMemory.publicSignals ?? [];
  const recentSpeeches = view.publicSummary.recentSpeeches
    .slice(-4)
    .map((speech) => `${speech.speaker ? seatText(speech.speaker) : "unknown"}发言：${clip(speech.message, 72)}`);
  return [
    `第${view.day}天 ${view.phase}`,
    ...recentSpeeches,
    ...cues.slice(0, 5).map((cue) => `公开推理线索：${cue.summary}`),
    ...signals.slice(-4).map((signal) => `公开局势信号：${signal}`),
  ];
}

function summarizeGames(games) {
  const calls = games.flatMap((game) => game.calls);
  const totalDurationMs = calls.reduce((sum, call) => sum + call.durationMs, 0);
  const byProvider = countBy(calls, (call) => call.provider);
  const byPersona = countBy(calls, (call) => call.persona);
  const byFailureType = countBy(calls, (call) => call.failureType);
  return {
    gameCount: games.length,
    completedGames: games.filter((game) => game.result).length,
    totalCalls: calls.length,
    speechCalls: calls.filter((call) => call.task === "speech").length,
    actionCalls: calls.filter((call) => call.task === "action").length,
    fallbackCount: calls.filter((call) => call.isFallback).length,
    errorCount: calls.filter((call) => call.error).length,
    validationFailureCount: calls.filter((call) => call.validationErrors.length > 0).length,
    referencedReasoningCueCalls: calls.filter((call) => call.referencedReasoningCueCount > 0).length,
    averageDurationMs: calls.length > 0 ? Math.round(totalDurationMs / calls.length) : 0,
    byProvider,
    byPersona,
    byFailureType,
  };
}

function formatMarkdown(report) {
  const lines = [
    "# LLM 真实对局小样本评估",
    "",
    `生成时间：${report.generatedAt}`,
    "",
    "## 配置",
    "",
    `- seedStart: ${report.options.seedStart}`,
    `- games: ${report.options.gameCount}`,
    `- board: ${report.options.boardId}`,
    `- humanSeatId: ${report.options.humanSeatId}`,
    `- autoHuman: ${report.options.autoHuman}`,
    `- realPhases: ${report.options.realPhases.join(", ")}`,
    `- maxLlmCalls: ${report.options.maxLlmCalls}`,
    `- maxSteps: ${report.options.maxSteps}`,
    "",
    "## 汇总",
    "",
    `- totalCalls: ${report.summary.totalCalls}`,
    `- speech/action: ${report.summary.speechCalls}/${report.summary.actionCalls}`,
    `- fallback: ${report.summary.fallbackCount}`,
    `- validation failures: ${report.summary.validationFailureCount}`,
    `- referenced reasoning cues: ${report.summary.referencedReasoningCueCalls}`,
    `- average duration: ${report.summary.averageDurationMs}ms`,
    `- providers: ${formatCountMap(report.summary.byProvider)}`,
    `- failure types: ${formatCountMap(report.summary.byFailureType)}`,
    "",
    "## 调用明细",
    "",
    "| Game | Day | Phase | Seat | Persona | Task | Provider | Time | Cues | Status | Output |",
    "| --- | ---: | --- | ---: | --- | --- | --- | ---: | ---: | --- | --- |",
  ];

  for (const game of report.games) {
    for (const call of game.calls) {
      lines.push(
        `| ${game.seed} | ${call.day} | ${call.phase} | ${call.seatNumber} | ${escapeMd(call.persona)} | ${call.task} | ${escapeMd(
          call.provider,
        )} | ${call.durationMs} | ${call.referencedReasoningCueCount}/${call.reasoningCueCount} | ${call.failureType} | ${escapeMd(
          call.output,
        )} |`,
      );
    }
  }

  lines.push("", "## 公开推理线索样例", "");
  for (const game of report.games) {
    for (const call of game.calls.slice(0, 6)) {
      lines.push(`### Seed ${game.seed} · ${call.persona} · ${call.phase}`);
      if (call.inputSummary.reasoningCues.length === 0) {
        lines.push("- 暂无 reasoningCues。");
      } else {
        for (const cue of call.inputSummary.reasoningCues) {
          lines.push(`- ${cue.weight} / ${cue.kind}: ${cue.summary}`);
        }
      }
      lines.push(`- 输出：${call.outputText}`, "");
    }
  }

  lines.push(
    "## 观察记录",
    "",
    "- 发言是否承接前置位：待人工标注。",
    "- 投票是否参考公开票型/对跳/站边变化：先看 Cues 命中列，再抽样读输出。",
    "- 是否越界泄露私密信息：结合 validation failures、fallback 和输出抽样检查。",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function classifyFailure(log, attempts, validationErrors) {
  if (log.error) return "provider_error";
  if (validationErrors.length > 0) return "validation_error";
  if (log.isFallback) return "fallback";
  if (attempts.some((attempt) => attempt?.issue || attempt?.validationErrors?.length)) return "retry_ok";
  return "ok";
}

function cueMatchesOutput(cue, outputText) {
  const normalizedOutput = normalizeCueText(outputText);
  const literalNeedles = [
    cue.summary,
    ...(Array.isArray(cue.evidence) ? cue.evidence : []),
    cue.actor ? seatText(cue.actor) : undefined,
    cue.target ? seatText(cue.target) : undefined,
    cue.actor?.name,
    cue.target?.name,
  ].filter(Boolean);
  if (literalNeedles.some((needle) => includesMeaningfulNeedle(normalizedOutput, needle))) return true;

  const actorMentioned = cue.actor ? seatMentioned(outputText, cue.actor) : false;
  const targetMentioned = cue.target ? seatMentioned(outputText, cue.target) : false;
  const cueText = `${cue.summary ?? ""} ${(Array.isArray(cue.evidence) ? cue.evidence : []).join(" ")}`;
  const cueSeatIds = extractSeatIds(cueText);
  const cueSeatMentioned = cueSeatIds.some((seatId) => mentionsSeatId(outputText, seatId));

  switch (cue.kind) {
    case "counterclaim":
      return /对跳|悍跳|预言家|身份线|查杀|counterclaim|claim/i.test(outputText);
    case "speech_influence":
      return /压力|施压|追问|多人|后续|接住|跟进|焦点|归票|票型|集中/i.test(outputText) && (targetMentioned || cueSeatMentioned);
    case "vote":
      return /票型|归票|投票|票口|集中|散票|跟票/i.test(outputText) && (targetMentioned || cueSeatMentioned);
    case "stance_shift":
      return /站边|变|转向|改口|前后|态度/i.test(outputText) && (actorMentioned || targetMentioned || cueSeatMentioned);
    case "seer_legacy":
    case "claim":
      return /查杀|金水|预言家|查验|验人|身份线/i.test(outputText) && (actorMentioned || targetMentioned || cueSeatMentioned);
    default:
      return false;
  }
}

function includesMeaningfulNeedle(normalizedOutput, needle) {
  const normalizedNeedle = normalizeCueText(needle);
  if (normalizedNeedle.length < 4) return false;
  return normalizedOutput.includes(normalizedNeedle);
}

function normalizeCueText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[|"'`“”‘’{}[\](),，.。:：;；!?！？、-]/g, "");
}

function seatMentioned(outputText, seat) {
  return Boolean(seat && (mentionsSeatId(outputText, seat.seatId) || (seat.name && String(outputText).includes(seat.name))));
}

function mentionsSeatId(outputText, seatId) {
  return new RegExp(`(^|[^0-9])${seatId}\\s*(号|號|seat|座|位)?`, "i").test(String(outputText));
}

function extractSeatIds(text) {
  const ids = [];
  const pattern = /(\d+)\s*(?:号|號|seat|座|位)?/gi;
  for (const match of String(text ?? "").matchAll(pattern)) {
    const seatId = Number(match[1]);
    if (Number.isInteger(seatId) && seatId > 0 && !ids.includes(seatId)) ids.push(seatId);
  }
  return ids;
}

function commandText(command) {
  if ("message" in command && command.message) return command.message;
  const targetText = "targetSeatId" in command && command.targetSeatId ? `${command.targetSeatId}号` : "";
  return [command.type, targetText, command.reason, "message" in command ? command.message : undefined].filter(Boolean).join(" ");
}

function briefCommand(command) {
  if ("message" in command && command.message) return `${command.type}: ${clip(command.message, 90)}`;
  if ("targetSeatId" in command && command.targetSeatId) return `${command.type} -> ${command.targetSeatId}`;
  if (command.type === "witchAction") return command.targetSeatId ? `${command.type}:${command.mode} -> ${command.targetSeatId}` : `${command.type}:${command.mode}`;
  if (command.type === "sheriffNominate") return `${command.type}:${command.run ? "run" : "skip"}`;
  if (command.type === "sheriffWithdraw") return `${command.type}:${command.withdraw ? "withdraw" : "stay"}`;
  return command.type;
}

function assertRealProviders(providers, allowMock) {
  const providerIds = [providers.speechProvider.providerId, providers.actionProvider.providerId];
  const hasMock = providerIds.some((id) => id.includes("mock"));
  if (hasMock && !allowMock) {
    throw new Error(
      `LLM providers are not configured (${providerIds.join(", ")}). Set AI_LLM_PROVIDER=models with API keys, or pass --allow-mock for a dry run.`,
    );
  }
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCountMap(value) {
  const entries = Object.entries(value);
  return entries.length > 0 ? entries.map(([key, count]) => `${key} ${count}`).join(", ") : "none";
}

function seatText(seat) {
  return `${seat.seatId}号${seat.name ? ` ${seat.name}` : ""}`;
}

function clip(text, limit) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function escapeMd(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
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

function readAutoHuman(value) {
  const clean = String(value ?? "mock").toLowerCase();
  return clean === "stop" || clean === "llm" || clean === "mock" ? clean : "mock";
}

function readRealPhases(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toLowerCase() === "all") return undefined;
  const phases = raw
    .split(",")
    .map((phase) => phase.trim().toUpperCase())
    .filter(Boolean);
  return phases.length > 0 ? new Set(phases) : undefined;
}

function shouldUseRealProvider(requirement, options) {
  const eligible = requirement.type === "ai" || options.autoHuman === "llm";
  if (!eligible) return false;
  if (!options.realPhases) return true;
  return options.realPhases.has(requirement.phase);
}
