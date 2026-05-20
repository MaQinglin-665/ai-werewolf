import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { shouldWarnWolfTeamVote } from "./audit-ai-experience-utils.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const boardIdsArg = args.boards ?? args.board ?? process.env.AUDIT_BOARD_ID;
const gameCount = readPositiveInt(args.games ?? process.env.AUDIT_GAMES, 1000);
const seedStart = readNonNegativeInt(args["seed-start"] ?? process.env.AUDIT_SEED_START, 0);
const maxSteps = readPositiveInt(args["max-steps"] ?? process.env.AUDIT_MAX_STEPS, 500);
const sampleSize = readPositiveInt(args.sample ?? process.env.AUDIT_SAMPLE_SIZE, 40);
const humanSeatId = readPositiveInt(args["human-seat"] ?? process.env.AUDIT_HUMAN_SEAT, 1);
const json = Boolean(args.json);
const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;

const server = await createServer({
  root,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});

try {
  const [
    { advanceWithMockAi },
    { createGame },
    { listBoardPresets },
    { summarizeSimulatedGame, summarizeSimulation },
  ] = await Promise.all([
    server.ssrLoadModule("/src/ai/mockAgent.ts"),
    server.ssrLoadModule("/src/game/engine.ts"),
    server.ssrLoadModule("/src/game/boards.ts"),
    server.ssrLoadModule("/src/game/simulationStats.ts"),
  ]);

  const boards = listBoardPresets();
  const boardNameMap = new Map(boards.map((board) => [board.id, board.name]));
  const boardIds = resolveBoardIds(boardIdsArg, boards.map((board) => board.id));
  const report = await runAudit({
    advanceWithMockAi,
    createGame,
    summarizeSimulatedGame,
    summarizeSimulation,
    boardIds,
    boardNameMap,
    gameCount,
    seedStart,
    maxSteps,
    sampleSize,
    humanSeatId,
  });

  const output = json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, output, "utf8");
  }
  process.stdout.write(output);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}

async function runAudit(options) {
  const boards = [];
  const issueIndex = new Map();
  let blockingGames = 0;
  let warningGames = 0;
  let attemptedGames = 0;
  let failedGames = 0;

  for (const boardId of options.boardIds) {
    const boardReport = await runBoardAudit(boardId, options);
    boards.push(boardReport);
    blockingGames += boardReport.blockingGames;
    warningGames += boardReport.warningGames;
    attemptedGames += boardReport.attemptedGames;
    failedGames += boardReport.failedGames;
    mergeIssueIndex(issueIndex, boardReport.issueTotals);
  }

  const allGames = boards.flatMap((board) => board.gameSummaries);
  const simulation = options.summarizeSimulation(allGames, {
    boardId: undefined,
    gameCount: allGames.length,
    seedStart: options.seedStart,
    maxSteps: options.maxSteps,
  });

  return {
    generatedAt: new Date().toISOString(),
    options: {
      boardIds: options.boardIds,
      gameCount: options.gameCount,
      seedStart: options.seedStart,
      maxSteps: options.maxSteps,
      sampleSize: options.sampleSize,
      humanSeatId: options.humanSeatId,
    },
    summary: {
      boards: boards.length,
      games: allGames.length,
      attemptedGames,
      failedGames,
      blockingGames,
      warningGames,
      fallbackCount: simulation.fallbackCount,
      issueCounts: summarizeIssueCounts(issueIndex),
    },
    boards: boards.map(stripInternalBoardFields),
  };
}

async function runBoardAudit(boardId, options) {
  const sampleIndexes = pickSampleIndexes(options.gameCount, options.sampleSize);
  const sampledGames = [];
  const gameSummaries = [];
  const issueTotals = new Map();
  let blockingGames = 0;
  let warningGames = 0;
  let failedGames = 0;

  for (let index = 0; index < options.gameCount; index += 1) {
    const seed = options.seedStart + index;
    try {
      const { state, aiLogs } = await options.advanceWithMockAi(
        options.createGame({ boardId, seed, humanSeatId: options.humanSeatId }),
        { ignoreHuman: true, maxSteps: options.maxSteps },
      );
      const summary = options.summarizeSimulatedGame(seed, state, aiLogs);
      const issues = detectIssues(state, aiLogs);

      gameSummaries.push(summary);
      if (issues.some((item) => item.severity === "blocking")) blockingGames += 1;
      if (issues.some((item) => item.severity === "warning")) warningGames += 1;
      mergeIssueIndex(issueTotals, issuesToTotals(issues));

      if (sampleIndexes.has(index) || issues.some((item) => item.severity === "blocking")) {
        sampledGames.push({
          seed,
          completed: summary.completed,
          winner: summary.winner,
          days: summary.days,
          fallbackCount: summary.fallbackCount,
          issues: compactIssues(issues),
          transcript: buildTranscript(state, aiLogs),
        });
      }
    } catch (error) {
      failedGames += 1;
      const issue = {
        code: "simulation_error",
        severity: "blocking",
        title: "simulation error",
        detail: error instanceof Error ? error.message : String(error),
        day: 0,
        phase: "SETUP",
        seat: `seed ${seed}`,
        evidence: error instanceof Error ? (error.stack ?? error.message) : String(error),
      };
      mergeIssueIndex(issueTotals, issuesToTotals([issue]));
      blockingGames += 1;
      if (sampleIndexes.has(index)) {
        sampledGames.push({
          seed,
          completed: false,
          winner: undefined,
          days: 0,
          fallbackCount: 0,
          issues: compactIssues([issue]),
          transcript: { publicEvents: [], aiDecisions: [] },
          error: issue.detail,
        });
      }
    }
  }

  const summary = options.summarizeSimulation(gameSummaries, {
    boardId,
    gameCount: options.gameCount,
    seedStart: options.seedStart,
    maxSteps: options.maxSteps,
  });

  return {
    boardId,
    boardName: options.boardNameMap.get(boardId) ?? boardId,
    summary: stripSimulationGameList(summary),
    attemptedGames: options.gameCount,
    failedGames,
    blockingGames,
    warningGames,
    issueTotals: summarizeIssueCounts(issueTotals),
    topIssues: summarizeIssueCounts(issueTotals).slice(0, 12),
    sampledGames,
    gameSummaries,
  };
}

function detectIssues(state, aiLogs) {
  const issues = [];
  const spokenByDay = new Map();
  const seerSeat = state.seats.find((seat) => seat.role === "SEER");
  const seerGoldTargets = buildSeerGoldTargets(state, seerSeat?.seatId);
  const seerDeathDay = findSeatDeathDay(state, seerSeat?.seatId);
  const exiledByDay = buildExiledByDay(state);

  for (const log of aiLogs) {
    const seat = state.seats.find((item) => item.seatId === log.seatNumber);
    const text = commandText(log.output);
    const reason = readDecisionReason(log);
    const spokenSeats = spokenByDay.get(log.day) ?? new Set();
    const context = {
      code: "",
      severity: "",
      title: "",
      day: log.day,
      phase: log.phase,
      seat: seat ? formatSeat(seat) : `${log.seatNumber}号`,
      evidence: clip(text, 180),
    };

    if (log.isFallback || log.error || (log.validationErrors?.length ?? 0) > 0) {
      issues.push({
        ...context,
        code: "fallback_or_error",
        severity: "blocking",
        title: "fallback / error",
        detail: `决策回退或校验失败：${readFailureText(log)}`,
      });
    }

    if (isSpeechCommand(log.output)) {
      if (containsReportTone(text)) {
        issues.push({
          ...context,
          code: "report_tone",
          severity: "warning",
          title: "report tone",
          detail: "发言包含明显报告腔或分析标签。",
        });
      }

      if (containsPrivateClaimLeak(text, log.speechPlan)) {
        issues.push({
          ...context,
          code: "private_claim_leak",
          severity: "blocking",
          title: "private claim leak",
          detail: "发言泄露了不该公开的身份/验人信息。",
        });
      }

      if (containsDeathCauseOverclaim(text, state, log.day)) {
        issues.push({
          ...context,
          code: "death_cause_overclaim",
          severity: "warning",
          title: "death cause overclaim",
          detail: "发言把公开死讯中的死亡形态说成了确定死因。",
        });
      }

      if (containsUnspokenPlayerJudgment(text, spokenSeats, state)) {
        issues.push({
          ...context,
          code: "unspoken_player_judgment",
          severity: "warning",
          title: "unspoken player judgment",
          detail: "发言在后置位未发言前就对其做了负面定性。",
        });
      }

      if (containsDeadSeerGoldPressure(text, seerGoldTargets, seerDeathDay, log.day)) {
        issues.push({
          ...context,
          code: "dead_seer_gold_pressure",
          severity: "warning",
          title: "dead seer gold pressure",
          detail: "夜死预言家的金水在白天被再次推成重点关注位。",
        });
      }

      if (seat) spokenSeats.add(seat.seatId);
      spokenByDay.set(log.day, spokenSeats);
    }

    if (log.output.type === "vote") {
      if (!reason) {
        issues.push({
          ...context,
          code: "missing_vote_reason",
          severity: "warning",
          title: "missing vote reason",
          detail: "投票没有给出可读的公开理由。",
        });
      }

      if (log.votePlan?.abstain && log.output.targetSeatId) {
        issues.push({
          ...context,
          code: "abstain_mismatch",
          severity: "blocking",
          title: "abstain mismatch",
          detail: "投票计划要求弃票，但实际仍给出了目标。",
        });
      }

      if (isProtectedSeerGoldTarget(seerGoldTargets, log.output.targetSeatId, log.day)) {
        issues.push({
          ...context,
          code: "seer_gold_vote_target",
          severity: "warning",
          title: "seer gold vote target",
          detail: "夜死预言家的金水仍然进入了投票关注范围。",
        });
      }

      if (isExiledSeerGoldTarget(seerGoldTargets, log.output.targetSeatId, seerDeathDay, log.day, exiledByDay)) {
        issues.push({
          ...context,
          code: "seer_gold_exiled",
          severity: "blocking",
          title: "seer gold exiled",
          detail: "夜死预言家的金水在次日被放逐出局。",
        });
      }

      if (seat && isWolfTarget(seat.role, state.rules.wolfRoles) && log.output.targetSeatId) {
        const target = state.seats.find((item) => item.seatId === log.output.targetSeatId);
        if (target && isWolfTarget(target.role, state.rules.wolfRoles) && shouldWarnWolfTeamVote(log)) {
          issues.push({
            ...context,
            code: "wolf_team_vote",
            severity: "warning",
            title: "wolf team vote",
            detail: "狼人投给了队友，需确认是否属于有意做距离。",
          });
        }
      }
    }

    if (log.output.type === "witchAction" || log.output.type === "hunterShoot" || log.output.type === "wolfKingShoot" || log.output.type === "knightDuel") {
      if (!reason) {
        issues.push({
          ...context,
          code: "missing_action_reason",
          severity: "warning",
          title: "missing action reason",
          detail: "强动作没有给出可读理由。",
        });
      }
      if (log.output.targetSeatId) {
        const target = state.seats.find((item) => item.seatId === log.output.targetSeatId);
        const actorSeat = seat ?? state.seats.find((item) => item.seatId === log.seatNumber);
        if (target && actorSeat && isGoodPowerMisfire(actorSeat, log.output.type, target, state.rules.wolfRoles)) {
          issues.push({
            ...context,
            code: "power_misfire_good",
            severity: "warning",
            title: "power misfire",
            detail: "强动作打到了好人位。",
          });
        }
      }
    }
  }

  return dedupeIssues(issues);
}

function buildTranscript(state, aiLogs) {
  return {
    publicEvents: state.events
      .filter((event) => event.visibility === "public")
      .map((event) => ({
        seq: event.seq,
        day: event.day,
        phase: event.phase,
        type: event.type,
        message: event.message,
      })),
    aiDecisions: aiLogs.map((log) => ({
      day: log.day,
      phase: log.phase,
      seat: log.seatNumber,
      persona: log.prompt.persona?.name ?? "Human",
      role: log.prompt.myRole,
      provider: log.provider,
      task: isSpeechCommand(log.output) ? "speech" : "action",
      output: commandText(log.output),
      reason: readDecisionReason(log),
      fallback: log.isFallback,
      validationErrors: log.validationErrors ?? [],
      speechPlan: log.speechPlan
        ? {
            kind: log.speechPlan.kind,
            stance: log.speechPlan.stance,
            target: log.speechPlan.target ? formatTarget(log.speechPlan.target) : undefined,
            claimIntent: log.speechPlan.claimIntent
              ? {
                  claimedRole: log.speechPlan.claimIntent.claimedRole,
                  strength: log.speechPlan.claimIntent.strength,
                  isCounterclaim: log.speechPlan.claimIntent.isCounterclaim ?? false,
                  check: log.speechPlan.claimIntent.check
                    ? {
                        targetSeatId: log.speechPlan.claimIntent.check.targetSeatId,
                        result: log.speechPlan.claimIntent.check.result,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      votePlan: log.votePlan
        ? {
            target: formatTarget(log.votePlan.target),
            abstain: log.votePlan.abstain ?? false,
            reason: log.votePlan.reason,
            confidence: log.votePlan.confidence,
            alternatives: log.votePlan.alternatives.map(formatTarget),
            wolfVoteTactic: log.votePlan.wolfVoteTactic,
          }
        : undefined,
    })),
  };
}

function containsPrivateClaimLeak(text, speechPlan) {
  if (speechPlan?.claimIntent?.claimedRole === "SEER") return false;
  return /(我(?:是|跳).{0,10}(预言家|女巫|猎人|守卫|骑士|白痴)|昨晚验|昨夜验|首夜验|我昨晚验|我昨夜验|我是预言家|我跳预言家)/.test(text);
}

function containsDeathCauseOverclaim(text, state, day) {
  const publicDeath = state.events.find((event) => event.type === "DAY_STARTED" && event.day === day);
  if (!publicDeath) return false;
  if (!/(平安夜|死亡|倒牌)/.test(publicDeath.message)) return false;
  return /(女巫没开药|狼队空刀|狼刀|毒|自刀|守刀|刀口)/.test(text) && /(是|就是|一定|肯定|说明|因为|导致)/.test(text);
}

function containsUnspokenPlayerJudgment(text, spokenSeats, state) {
  if (!/(未发言|还没发言|没回应|信息少|划水|空话|没给)/.test(text)) return false;
  const mentionedSeatIds = extractSeatIds(text);
  return mentionedSeatIds.some((seatId) => {
    if ((spokenSeats ?? new Set()).has(seatId)) return false;
    const seat = state.seats.find((item) => item.seatId === seatId);
    return seat ? seat.alive : false;
  });
}

function containsReportTone(text) {
  return /(拆因果|第一点|盘问议程|票口条件|可改票条件|推理框架|验证问题|逻辑链条|校验口径)/.test(text);
}

function containsDeadSeerGoldPressure(text, seerGoldTargets, seerDeathDay, day) {
  if (!seerDeathDay || day < seerDeathDay) return false;
  if (seerGoldTargets.length === 0) return false;
  const source = String(text ?? "");
  return seerGoldTargets.some((target) => containsPressureAgainstSeat(source, target.targetSeatId));
}

function containsPressureAgainstSeat(text, seatId) {
  const seatPattern = `${seatId}\\s*(?:号|號|seat|座|位)?`;
  const seatRegex = new RegExp(seatPattern, "i");
  const seatFirstPressure = new RegExp(
    `${seatPattern}[^。！？；，、]{0,28}(查杀|狼面|狼坑|悍跳|反打|不认|怀疑|焦点|抗推|归票|收票|出票|出人|出局|票口|票压|先压|硬踩|讲实|讲完整|补清楚|放进观察|挂疑问)`,
    "i",
  );
  const pressureFirstSeat = new RegExp(
    `(归票|收票|出票|出人|票口|票压|票型往|把票(?:型)?往|投给|压到|压向|先压|硬踩|不认|怀疑|焦点|观察位|放进观察|挂疑问)[^。！？；，、]{0,22}${seatPattern}`,
    "i",
  );

  for (const segment of splitSpeechSegments(text)) {
    if (!seatRegex.test(segment)) continue;
    if (isProtectiveGoldReference(segment)) continue;
    if (seatFirstPressure.test(segment) || pressureFirstSeat.test(segment)) {
      return true;
    }
  }
  return false;
}

function isProtectiveGoldReference(text) {
  return /(金水|好人|先放|放一轮|不进|别进|不要进|不作为.*出人|不围绕|不直接打死|不把.*打死|不把票压|先不把票压|别乱出|别硬踩|无理由硬踩|保护|稳住|可信)/.test(text);
}

function splitSpeechSegments(text) {
  return String(text ?? "")
    .split(/[。！？；，、]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isProtectedSeerGoldTarget(seerGoldTargets, targetSeatId, day) {
  if (!targetSeatId) return false;
  return seerGoldTargets.some((item) => item.targetSeatId === targetSeatId && day >= item.claimDay);
}

function isExiledSeerGoldTarget(seerGoldTargets, targetSeatId, seerDeathDay, day, exiledByDay) {
  if (!seerDeathDay || day < seerDeathDay || !targetSeatId) return false;
  if (exiledByDay.get(day) !== targetSeatId) return false;
  return seerGoldTargets.some((item) => item.targetSeatId === targetSeatId);
}

function buildExiledByDay(state) {
  const exiledByDay = new Map();
  for (const event of state.events) {
    if (event.type !== "PLAYER_EXILED") continue;
    const seatId = readNumber(event, "seatId");
    if (seatId) exiledByDay.set(event.day, seatId);
  }
  return exiledByDay;
}

function isGoodPowerMisfire(actorSeat, actionType, target, wolfRoles) {
  if (actionType === "witchAction") return actorSeat.role === "WITCH" && !isWolfTarget(target.role, wolfRoles);
  if (actionType === "hunterShoot") return actorSeat.role === "HUNTER" && !isWolfTarget(target.role, wolfRoles);
  if (actionType === "knightDuel") return actorSeat.role === "KNIGHT" && !isWolfTarget(target.role, wolfRoles);
  return false;
}

function isWolfTarget(role, wolfRoles) {
  return Array.isArray(wolfRoles) && wolfRoles.includes(role);
}

function buildSeerGoldTargets(state, seerSeatId) {
  if (!seerSeatId) return [];
  return state.roleClaims
    .filter((claim) => claim.claimantSeatId === seerSeatId && claim.claimedRole === "SEER")
    .flatMap((claim) =>
      claim.checks
        .filter((check) => check.result === "GOOD")
        .map((check) => ({
          targetSeatId: check.targetSeatId,
          claimDay: claim.day,
        })),
    );
}

function findSeatDeathDay(state, seatId) {
  if (!seatId) return undefined;
  const event = state.events.find((item) => item.type === "DAY_STARTED" && readDeadSeatIds(item).includes(seatId));
  return event?.day;
}

function readDeadSeatIds(event) {
  return Array.isArray(event.payload.deadSeatIds) ? event.payload.deadSeatIds.filter((seatId) => typeof seatId === "number") : [];
}

function readNumber(event, key) {
  const value = event?.payload?.[key];
  return typeof value === "number" ? value : undefined;
}

function isSpeechCommand(command) {
  return command.type === "speak" || command.type === "sheriffSpeech" || command.type === "lastWords";
}

function commandText(command) {
  if ("message" in command && command.message) return command.message;
  const targetText = "targetSeatId" in command && command.targetSeatId ? `${command.targetSeatId}号` : "";
  return [command.type, targetText, command.reason].filter(Boolean).join(" ");
}

function readDecisionReason(log) {
  return log.output.reason ?? log.votePlan?.reason ?? log.speechPlan?.stance ?? log.error ?? "";
}

function readFailureText(log) {
  if (log.error) return log.error;
  if (log.validationErrors?.length) return log.validationErrors.join("；");
  return "unknown";
}

function extractSeatIds(text) {
  const seatIds = [];
  for (const match of String(text ?? "").matchAll(/(\d+)\s*(?:号|號|seat|座|位)?/gi)) {
    const seatId = Number(match[1]);
    if (Number.isInteger(seatId) && seatId > 0 && !seatIds.includes(seatId)) seatIds.push(seatId);
  }
  return seatIds;
}

function formatSeat(seat) {
  return `${seat.seatId}号${seat.name ? ` ${seat.name}` : ""}`;
}

function formatTarget(target) {
  return `${target.seatId}号${target.name ? ` ${target.name}` : ""}`;
}

function clip(text, limit) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function summarizeIssueCounts(issueIndex) {
  return Array.from(issueIndex.values())
    .map((item) => ({
      code: item.code,
      title: item.title,
      severity: item.severity,
      count: item.count,
      examples: item.examples.slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function issuesToTotals(issues) {
  const totals = new Map();
  for (const issue of issues) {
    const current = totals.get(issue.code) ?? {
      code: issue.code,
      title: issue.title,
      severity: issue.severity,
      count: 0,
      examples: [],
    };
    current.count += 1;
    if (current.examples.length < 3) {
      current.examples.push({
        day: issue.day,
        phase: issue.phase,
        seat: issue.seat,
        detail: issue.detail,
        evidence: issue.evidence,
      });
    }
    totals.set(issue.code, current);
  }
  return totals;
}

function mergeIssueIndex(target, source) {
  for (const item of source.values()) {
    const current = target.get(item.code) ?? {
      code: item.code,
      title: item.title,
      severity: item.severity,
      count: 0,
      examples: [],
    };
    current.count += item.count;
    current.examples.push(...item.examples);
    target.set(item.code, current);
  }
}

function compactIssues(issues) {
  return issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    title: issue.title,
    day: issue.day,
    phase: issue.phase,
    seat: issue.seat,
    detail: issue.detail,
    evidence: issue.evidence,
  }));
}

function dedupeIssues(issues) {
  const seen = new Set();
  const deduped = [];
  for (const issue of issues) {
    const key = [issue.code, issue.day, issue.phase, issue.seat, issue.detail, issue.evidence ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }
  return deduped;
}

function stripInternalBoardFields(board) {
  const publicBoard = { ...board };
  delete publicBoard.gameSummaries;
  return publicBoard;
}

function stripSimulationGameList(summary) {
  const publicSummary = { ...summary };
  delete publicSummary.games;
  return publicSummary;
}

function pickSampleIndexes(gameCount, sampleSize) {
  if (gameCount <= 0) return new Set();
  const samples = Math.min(gameCount, sampleSize);
  const indexes = new Set();
  if (samples === 1) {
    indexes.add(0);
    return indexes;
  }
  for (let index = 0; index < samples; index += 1) {
    indexes.add(Math.round((index * (gameCount - 1)) / (samples - 1)));
  }
  return indexes;
}

function resolveBoardIds(boardIdsArg, availableBoardIds) {
  if (!boardIdsArg || String(boardIdsArg).trim().toLowerCase() === "all") return [...availableBoardIds];
  const requested = String(boardIdsArg)
    .split(",")
    .map((boardId) => boardId.trim())
    .filter(Boolean);
  const unknown = requested.filter((boardId) => !availableBoardIds.includes(boardId));
  if (unknown.length > 0) {
    throw new Error(`Unknown board id(s): ${unknown.join(", ")}. Available: ${availableBoardIds.join(", ")}`);
  }
  return requested;
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

function formatReport(report) {
  const lines = [
    "# AI 体验审计报告",
    "",
    `生成时间：${report.generatedAt}`,
    "",
    "## 总览",
    "",
    `- boards: ${report.summary.boards}`,
    `- games: ${report.summary.games}`,
    `- attempted: ${report.summary.attemptedGames}`,
    `- failed: ${report.summary.failedGames}`,
    `- blocking games: ${report.summary.blockingGames}`,
    `- warning games: ${report.summary.warningGames}`,
    `- fallback: ${report.summary.fallbackCount}`,
    "",
    "## 问题总表",
    "",
    "| Code | Severity | Count |",
    "| --- | --- | ---: |",
    ...report.summary.issueCounts.map((item) => `| ${item.code} | ${item.severity} | ${item.count} |`),
    "",
  ];

  for (const board of report.boards) {
    lines.push(
      `## ${board.boardId}`,
      "",
      `- name: ${board.boardName}`,
      `- games: ${board.summary.gameCount}`,
      `- fallback: ${board.summary.fallbackCount}`,
      `- blocking games: ${board.blockingGames}`,
      `- warning games: ${board.warningGames}`,
      "",
      "### Top issues",
      "",
      "| Code | Severity | Count |",
      "| --- | --- | ---: |",
      ...board.topIssues.slice(0, 8).map((item) => `| ${item.code} | ${item.severity} | ${item.count} |`),
      "",
      "### Sample transcripts",
      "",
    );

    for (const game of board.sampledGames.slice(0, 3)) {
      lines.push(
        `#### Seed ${game.seed}`,
        "",
        `- completed: ${game.completed}`,
        `- winner: ${game.winner ?? "unknown"}`,
        `- days: ${game.days}`,
        `- fallback: ${game.fallbackCount}`,
        `- issues: ${game.issues.length}`,
        "",
        "Public events:",
        ...game.transcript.publicEvents.slice(0, 8).map((event) => `- [D${event.day} ${event.phase}] ${event.type}: ${event.message}`),
        "",
        "AI decisions:",
        ...game.transcript.aiDecisions.slice(0, 8).map((decision) => `- [D${decision.day} ${decision.phase}] ${decision.seat} ${decision.task}: ${clip(decision.output, 120)}`),
        "",
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
