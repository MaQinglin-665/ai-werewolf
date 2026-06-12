import fs from "node:fs/promises";

export function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    result[rawKey] = rawValue.length > 0 ? rawValue.join("=") : true;
  }
  return result;
}

export function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function readNonNegativeInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function readExistingCases(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const cases = Array.isArray(parsed) ? parsed : parsed.cases;
  if (!Array.isArray(cases)) {
    throw new Error(`Expected ${filePath} to contain an array or a { cases: [...] } object.`);
  }
  return cases.map((item, index) => normalizeEvalCase(item, index));
}

export function buildEvalCaseFromAiLog(log, index = 0, metadata = {}) {
  const prompt = log.prompt ?? {};
  const outputText = commandText(log.output);
  const task = isSpeechCommand(log.output) ? "speech" : "action";
  const reasoningCues = prompt.publicSummary?.tableMemory?.reasoningCues ?? [];
  const speechInfluence = prompt.publicSummary?.tableMemory?.speechInfluence ?? [];
  const recentSpeeches = prompt.publicSummary?.recentSpeeches ?? [];
  const voteLeaders = prompt.publicSummary?.voteSnapshot?.leaders ?? [];
  const referencedPublicCueCount =
    reasoningCues.filter((cue) => cueMatchesOutput(cue, outputText)).length +
    speechInfluence.filter((item) => speechInfluenceMatchesOutput(item, outputText)).length +
    recentSpeeches.filter((speech) => recentSpeechMatchesOutput(speech, outputText)).length +
    voteLeaders.filter((leader) => voteLeaderMatchesOutput(leader, outputText)).length;
  const speechTargetSeatId = log.speechPlan?.target?.seatId ?? log.speechPlan?.interaction?.target?.seatId ?? log.speechPlan?.tableTask?.target?.seatId;
  const previousOwnSpeechText = findPreviousOwnSpeechText(prompt);

  return {
    id: `${metadata.seed ?? "sample"}:${log.gameId ?? "game"}:${log.day ?? prompt.day ?? 0}:${log.phase ?? "unknown"}:${log.seatNumber ?? 0}:${index}`,
    task,
    phase: log.phase ?? prompt.phase ?? "UNKNOWN",
    playerRole: prompt.myRole,
    outputText,
    previousSpeechText: previousOwnSpeechText ?? prompt.privateKnowledge?.aiMemory?.lastSpeechStance,
    selectedTargetSeatId: task === "action" ? readCommandTargetSeatId(log.output) : undefined,
    lastSpeechTargetSeatId: prompt.privateKnowledge?.aiMemory?.lastSpeechTargetSeatId,
    focusSeatId: speechTargetSeatId ?? prompt.publicSummary?.focus?.seatId,
    askTargetSeatId: isFollowupQuestionPlan(log.speechPlan) ? speechTargetSeatId : undefined,
    aliveSeatIds: (prompt.aliveSeats ?? []).map((seat) => seat.seatId).filter(Number.isFinite),
    availablePublicCueCount: reasoningCues.length + speechInfluence.length + recentSpeeches.length + voteLeaders.length,
    referencedPublicCueCount,
    metadata: {
      ...metadata,
      day: log.day ?? prompt.day,
      seatNumber: log.seatNumber,
      persona: prompt.persona?.name ?? "Human",
      provider: log.provider,
      commandType: log.output?.type,
      publicFactBasis: log.publicFactBasis?.slice?.(0, 6) ?? [],
      aliveSeats: summarizeSeats(prompt.aliveSeats ?? []),
      publicClaimBoard: summarizePublicClaimBoard(prompt.publicSummary?.claimBoard ?? []),
    },
  };
}

function summarizeSeats(seats) {
  if (!Array.isArray(seats)) return [];
  return seats.map((seat) => ({
    seatId: readSeatId(seat),
    name: seat?.name,
  }));
}

function summarizePublicClaimBoard(claimBoard) {
  if (!Array.isArray(claimBoard)) return [];
  return claimBoard.map((claim) => ({
    claimantSeatId: readSeatId(claim?.claimant),
    claimantName: claim?.claimant?.name,
    claimedRole: claim?.claimedRole,
    checks: Array.isArray(claim?.checks)
      ? claim.checks.map((check) => ({
          targetSeatId: readSeatId(check?.target),
          targetName: check?.target?.name,
          result: check?.result,
        }))
      : [],
  }));
}

function readSeatId(seat) {
  const parsed = Number(seat?.seatId);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findPreviousOwnSpeechText(prompt) {
  const mySeatId = Number(prompt.mySeatId);
  if (!Number.isFinite(mySeatId)) return undefined;
  const recentSpeeches = prompt.publicSummary?.recentSpeeches ?? [];
  return [...recentSpeeches].reverse().find((speech) => speech?.speaker?.seatId === mySeatId)?.message;
}

export function formatOrdinaryEvalMarkdown(report) {
  const lines = [
    "# Ordinary Werewolf AI Evaluation",
    "",
    `generatedAt: ${report.generatedAt}`,
    "",
    "## Options",
    "",
    `- source: ${report.options.source}`,
    `- board: ${report.options.boardId}`,
    `- games: ${report.options.games}`,
    `- seedStart: ${report.options.seedStart}`,
    `- maxSteps: ${report.options.maxSteps}`,
    `- input: ${report.options.inputPath ?? "none"}`,
    "",
    "## Summary",
    "",
    `- totalCases: ${report.summary.totalCases}`,
    `- averageScore: ${report.summary.averageScore}`,
    `- issueCount: ${report.summary.issueCount}`,
    `- highRiskCaseIds: ${report.summary.highRiskCaseIds.length > 0 ? report.summary.highRiskCaseIds.join(", ") : "none"}`,
    `- byIssueCode: ${formatCountMap(report.summary.byIssueCode)}`,
    "",
    "## Sample Metrics",
    "",
    ...formatSampleMetrics(report.summary.sampleMetrics),
    "",
    "## Cases",
    "",
    "| ID | Phase | Task | Role | Score | Issues | Output |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
  ];

  for (const result of report.results) {
    lines.push(
      `| ${escapeMd(result.id)} | ${escapeMd(result.phase)} | ${result.task} | ${escapeMd(String(result.case?.playerRole ?? ""))} | ${result.score} | ${escapeMd(
        result.issueCodes.join(", ") || "ok",
      )} | ${escapeMd(result.outputTextSnippet)} |`,
    );
  }

  lines.push("", "## Issue Details", "");
  const issueResults = report.results.filter((result) => result.issues.length > 0);
  if (issueResults.length === 0) {
    lines.push("- No local scoring issues detected.", "");
  } else {
    for (const result of issueResults.slice(0, 30)) {
      const persona = result.case?.metadata?.persona ? ` · ${result.case.metadata.persona}` : "";
      lines.push(`### ${result.id}${persona}`);
      for (const issue of result.issues) {
        lines.push(`- [${issue.severity}] ${issue.code}: ${issue.detail}${issue.evidence ? ` Evidence: ${issue.evidence}` : ""}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildPromptfooCases(cases) {
  return cases.map((item) => ({
    vars: {
      id: item.id,
      task: item.task,
      phase: item.phase,
      playerRole: item.playerRole ?? "",
      outputText: item.outputText,
      previousSpeechText: item.previousSpeechText ?? "",
      selectedTargetSeatId: item.selectedTargetSeatId ?? "",
      lastSpeechTargetSeatId: item.lastSpeechTargetSeatId ?? "",
      focusSeatId: item.focusSeatId ?? "",
      askTargetSeatId: item.askTargetSeatId ?? "",
      availablePublicCueCount: item.availablePublicCueCount ?? 0,
      referencedPublicCueCount: item.referencedPublicCueCount ?? 0,
    },
  }));
}

function normalizeEvalCase(item, index) {
  if (!item || typeof item !== "object") throw new Error(`Invalid eval case at index ${index}.`);
  if (!item.outputText) throw new Error(`Eval case ${item.id ?? index} is missing outputText.`);
  return {
    id: String(item.id ?? `existing:${index}`),
    task: item.task === "action" ? "action" : "speech",
    phase: String(item.phase ?? "UNKNOWN"),
    playerRole: item.playerRole,
    outputText: String(item.outputText),
    previousSpeechText: item.previousSpeechText,
    previousSpeechTexts: Array.isArray(item.previousSpeechTexts) ? item.previousSpeechTexts.map(String) : undefined,
    selectedTargetSeatId: readOptionalNumber(item.selectedTargetSeatId),
    lastSpeechTargetSeatId: readOptionalNumber(item.lastSpeechTargetSeatId),
    focusSeatId: readOptionalNumber(item.focusSeatId),
    askTargetSeatId: readOptionalNumber(item.askTargetSeatId),
    aliveSeatIds: Array.isArray(item.aliveSeatIds) ? item.aliveSeatIds.map(Number).filter(Number.isFinite) : undefined,
    availablePublicCueCount: readOptionalNumber(item.availablePublicCueCount),
    referencedPublicCueCount: readOptionalNumber(item.referencedPublicCueCount),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : undefined,
  };
}

function readOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function commandText(command) {
  if (!command) return "";
  if (typeof command === "string") {
    return command.replace(/^(?:speak|sheriffSpeech|lastWords)\s*:\s*/i, "").trim();
  }
  if ("message" in command && command.message) return command.message;
  const targetText = readCommandTargetSeatId(command) ? `${readCommandTargetSeatId(command)}号` : "";
  return [command.type, targetText, command.reason].filter(Boolean).join(" ");
}

function isSpeechCommand(command) {
  if (typeof command === "string") return /^(?:speak|sheriffSpeech|lastWords)\s*:/i.test(command);
  return command?.type === "speak" || command?.type === "sheriffSpeech" || command?.type === "lastWords";
}

function readCommandTargetSeatId(command) {
  if (typeof command === "string") {
    const match = command.match(/\bvote\s*:?\s*(\d{1,2})\s*号/i) ?? command.match(/\btarget\s*:?\s*(\d{1,2})\s*号/i);
    const parsed = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return command && "targetSeatId" in command && Number.isFinite(command.targetSeatId) ? command.targetSeatId : undefined;
}

function isFollowupQuestionPlan(plan) {
  return plan?.allowedInteraction === "ask_future" || plan?.speechMove === "ask_unspoken_target";
}

function cueMatchesOutput(cue, outputText) {
  const normalizedOutput = normalizeCueText(outputText);
  const needles = [
    cue?.summary,
    ...(Array.isArray(cue?.evidence) ? cue.evidence : []),
    cue?.actor ? seatText(cue.actor) : undefined,
    cue?.target ? seatText(cue.target) : undefined,
    cue?.actor?.name,
    cue?.target?.name,
  ].filter(Boolean);
  if (needles.some((needle) => includesMeaningfulNeedle(normalizedOutput, needle))) return true;
  if (cue?.actor && seatMentioned(outputText, cue.actor)) return true;
  if (cue?.target && seatMentioned(outputText, cue.target)) return true;
  return false;
}

function speechInfluenceMatchesOutput(item, outputText) {
  if (typeof item === "string") return publicTextMatchesOutput(item, outputText);
  const seats = [item?.actor, item?.target, item?.speaker, item?.seat, item?.source].filter(Boolean);
  if (seats.some((seat) => seatMentioned(outputText, seat))) return true;
  return [
    item?.summary,
    item?.reason,
    item?.line,
    item?.description,
    item?.stance,
    ...(Array.isArray(item?.evidence) ? item.evidence : []),
  ].some((value) => publicTextMatchesOutput(value, outputText));
}

function recentSpeechMatchesOutput(speech, outputText) {
  if (speech?.speaker && seatMentioned(outputText, speech.speaker)) return true;
  return publicTextMatchesOutput(speech?.message, outputText);
}

function voteLeaderMatchesOutput(leader, outputText) {
  if (Number.isFinite(leader)) return mentionsSeatId(outputText, leader);
  return seatMentioned(outputText, leader) || seatMentioned(outputText, leader?.seat) || seatMentioned(outputText, leader?.player);
}

function publicTextMatchesOutput(value, outputText) {
  if (!value) return false;
  const normalizedOutput = normalizeCueText(outputText);
  return extractPublicCueNeedles(value).some((needle) => includesMeaningfulNeedle(normalizedOutput, needle));
}

function includesMeaningfulNeedle(normalizedOutput, needle) {
  const normalizedNeedle = normalizeCueText(needle);
  return normalizedNeedle.length >= 4 && normalizedOutput.includes(normalizedNeedle);
}

function extractPublicCueNeedles(value) {
  const chunks = String(value ?? "")
    .split(/[。！？!?；;，,、:：\s]+/g)
    .map((chunk) => chunk.replace(/^(?:我|你|他|她|它|但|但是|不过|然后|所以|因为|这个|这句|那句)+/g, "").trim())
    .filter((chunk) => {
      const normalized = normalizeCueText(chunk);
      return normalized.length >= 4 && normalized.length <= 24;
    });
  return [...new Set(chunks)];
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

function seatText(seat) {
  return `${seat.seatId}号${seat.name ? ` ${seat.name}` : ""}`;
}

function formatCountMap(value) {
  const entries = Object.entries(value ?? {});
  return entries.length > 0 ? entries.map(([key, count]) => `${key} ${count}`).join(", ") : "none";
}

function formatSampleMetrics(sampleMetrics) {
  if (!Array.isArray(sampleMetrics) || sampleMetrics.length === 0) {
    return ["- No sample-level cohesion warnings."];
  }
  return sampleMetrics.map((metric) => {
    const valueText = metric.value === undefined ? "" : ` Value: ${metric.value}.`;
    const evidence = Array.isArray(metric.evidence) && metric.evidence.length > 0 ? ` Evidence: ${metric.evidence.join("; ")}` : "";
    return `- [${metric.severity}] ${metric.code}: ${metric.detail}${valueText}${evidence}`;
  });
}

function escapeMd(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}
