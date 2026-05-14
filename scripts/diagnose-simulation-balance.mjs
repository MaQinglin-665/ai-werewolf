import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const boardId = args.board ?? args["board-id"] ?? process.env.SIM_BOARD_ID;
const gameCount = readPositiveInt(args.games ?? process.env.SIM_GAMES, 1000);
const seedStart = readNonNegativeInt(args["seed-start"] ?? process.env.SIM_SEED_START, 0);
const maxSteps = readPositiveInt(args["max-steps"] ?? process.env.SIM_MAX_STEPS, 500);
const outPath = args.out ? path.resolve(root, String(args.out)) : undefined;
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
  const { runMockGameSimulation } = await server.ssrLoadModule("/src/game/simulationStats.ts");
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
  const report = buildAttributionReport(summary);
  const output = json ? `${JSON.stringify(report, null, 2)}\n` : formatAttributionMarkdown(report);

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

function buildAttributionReport(summary) {
  const games = summary.games;
  const goodWins = games.filter((game) => game.winner === "GOOD");
  const werewolfWins = games.filter((game) => game.winner === "WEREWOLVES");
  const tiedGames = games.filter((game) => game.tiedVotes > 0);
  const untiedGames = games.filter((game) => game.tiedVotes === 0);
  const cohorts = {
    all: summarizeCohort(games),
    goodWins: summarizeCohort(goodWins),
    werewolfWins: summarizeCohort(werewolfWins),
    tiedGames: summarizeCohort(tiedGames),
    untiedGames: summarizeCohort(untiedGames),
  };
  const lossTags = buildLossTags(werewolfWins);
  const firstExileMatrix = buildFirstExileMatrix(games);
  const priorityFindings = buildPriorityFindings(cohorts, lossTags, summary);

  return {
    generatedAt: new Date().toISOString(),
    options: {
      boardId: summary.boardId ?? "default",
      gameCount: summary.gameCount,
      seedStart: summary.seedStart,
      maxSteps: summary.maxSteps,
    },
    headline: {
      completedGames: summary.completedGames,
      goodWins: summary.winners.GOOD,
      werewolfWins: summary.winners.WEREWOLVES,
      goodWinRate: summary.winRates.GOOD,
      werewolfWinRate: summary.winRates.WEREWOLVES,
      fallbackCount: summary.fallbackCount,
      fallbackGames: summary.fallbackGames,
    },
    cohorts,
    lossTags,
    firstExileMatrix,
    swingSeeds: buildSwingSeeds(werewolfWins),
    priorityFindings,
    nextExperimentHints: [
      "优先验证好人首日是否过早集中到神职或低证据目标；这应通过公开证据门槛改善，而不是削弱狼人。",
      "如果败局的好人投狼准确率明显低于胜局，下一步加强好人 action prompt 对发言链、站边变化、票型压力的引用。",
      "如果败局神职误伤高，女巫毒和猎人枪只做强证据门槛的单独 A/B，保持 LLM 发言自由度。",
      "如果平票局狼人胜率更高，单独观察平票后夜晚刀人与次日归票，而不是改平票规则。",
    ],
  };
}

function summarizeCohort(games) {
  const firstExiles = games.filter((game) => game.firstExileCamp).length;
  const witchPoisonUses = sum(games, (game) => game.witchPoisonUses);
  const hunterShots = sum(games, (game) => game.hunterShots);
  const seerChecks = sum(games, (game) => game.seerChecks);
  const exiles = sum(games, (game) => game.exiles);
  const goodVotes = sum(games, (game) => game.goodVotes);
  const wolfVotes = sum(games, (game) => game.wolfVotes);
  const voteRounds = sum(games, (game) => game.voteRounds);
  const topVoteShareTotal = sum(games, (game) => game.averageTopVoteShare * game.voteRounds);

  return {
    games: games.length,
    goodWins: games.filter((game) => game.winner === "GOOD").length,
    werewolfWins: games.filter((game) => game.winner === "WEREWOLVES").length,
    averageDays: average(games, (game) => game.days),
    voteRounds,
    tiedVoteGames: games.filter((game) => game.tiedVotes > 0).length,
    tiedVotes: sum(games, (game) => game.tiedVotes),
    averageTopVoteShare: ratio(topVoteShareTotal, voteRounds),
    goodVoteAccuracy: ratio(sum(games, (game) => game.goodVotesOnWolves), goodVotes),
    wolfTeammateVoteRate: ratio(sum(games, (game) => game.wolfVotesOnTeammates), wolfVotes),
    mislynchRate: ratio(sum(games, (game) => game.goodExiles), exiles),
    wolfExileRate: ratio(sum(games, (game) => game.wolfExiles), exiles),
    firstExiles,
    firstExileWolfRate: ratio(games.filter((game) => game.firstExileCamp === "WEREWOLVES").length, firstExiles),
    firstExileGoodRate: ratio(games.filter((game) => game.firstExileCamp === "GOOD").length, firstExiles),
    firstExileGoodPowerRate: ratio(games.filter((game) => game.firstExileWasGoodPower).length, firstExiles),
    noWolfExileRate: ratio(games.filter((game) => game.wolfExiles === 0).length, games.length),
    multiMislynchRate: ratio(games.filter((game) => game.goodExiles >= 2).length, games.length),
    witchPoisonWolfHitRate: ratio(sum(games, (game) => game.witchPoisonHitsWolves), witchPoisonUses),
    witchPoisonGoodHitRate: ratio(sum(games, (game) => game.witchPoisonHitsGood), witchPoisonUses),
    hunterShotWolfHitRate: ratio(sum(games, (game) => game.hunterHitsWolves), hunterShots),
    hunterShotGoodHitRate: ratio(sum(games, (game) => game.hunterHitsGood), hunterShots),
    averageSeerChecks: ratio(seerChecks, games.length),
    averageSeerSurvivalDays: average(games, (game) => game.seerSurvivalDays),
    seerEarlyDeathRate: ratio(games.filter((game) => game.seerDied && game.seerSurvivalDays <= 2).length, games.length),
    seerExileRate: ratio(games.filter((game) => game.seerDeathReason === "EXILED").length, games.length),
    trueSeerClaimRate: ratio(games.filter((game) => game.trueSeerClaimed).length, games.length),
  };
}

function buildLossTags(werewolfWins) {
  const tags = [
    {
      id: "first_exile_good_power",
      label: "首放逐好人神职",
      test: (game) => game.firstExileWasGoodPower,
    },
    {
      id: "first_exile_good",
      label: "首放逐好人",
      test: (game) => game.firstExileCamp === "GOOD",
    },
    {
      id: "no_wolf_exile",
      label: "全局没有放逐狼人",
      test: (game) => game.wolfExiles === 0,
    },
    {
      id: "multi_mislynch",
      label: "至少两次误放逐",
      test: (game) => game.goodExiles >= 2,
    },
    {
      id: "low_good_vote_accuracy",
      label: "好人投狼率低于 49%",
      test: (game) => ratio(game.goodVotesOnWolves, game.goodVotes) < 0.49,
    },
    {
      id: "seer_early_death",
      label: "预言家 2 天内死亡",
      test: (game) => game.seerDied && game.seerSurvivalDays <= 2,
    },
    {
      id: "true_seer_no_claim",
      label: "真预言家未公开起跳",
      test: (game) => !game.trueSeerClaimed,
    },
    {
      id: "power_misfire",
      label: "女巫毒/猎人枪误伤好人",
      test: (game) => game.witchPoisonHitsGood > 0 || game.hunterHitsGood > 0,
    },
    {
      id: "tied_vote",
      label: "出现平票进入夜晚",
      test: (game) => game.tiedVotes > 0,
    },
  ];

  return tags
    .map((tag) => {
      const matchingGames = werewolfWins.filter(tag.test);
      return {
        id: tag.id,
        label: tag.label,
        games: matchingGames.length,
        rate: ratio(matchingGames.length, werewolfWins.length),
        seeds: matchingGames.slice(0, 12).map((game) => game.seed),
      };
    })
    .sort((a, b) => b.rate - a.rate || b.games - a.games || a.label.localeCompare(b.label));
}

function buildFirstExileMatrix(games) {
  const byKey = new Map();
  for (const game of games) {
    const key = game.firstExileRole ? `${game.firstExileCamp}:${game.firstExileRole}` : "NONE";
    const row = byKey.get(key) ?? {
      key,
      firstExileCamp: game.firstExileCamp ?? "NONE",
      firstExileRole: game.firstExileRole ?? "NONE",
      games: 0,
      goodWins: 0,
      werewolfWins: 0,
    };
    row.games += 1;
    if (game.winner === "GOOD") row.goodWins += 1;
    if (game.winner === "WEREWOLVES") row.werewolfWins += 1;
    byKey.set(key, row);
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      goodWinRate: ratio(row.goodWins, row.games),
      werewolfWinRate: ratio(row.werewolfWins, row.games),
    }))
    .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key));
}

function buildPriorityFindings(cohorts, lossTags, summary) {
  const findings = [];
  const wolf = cohorts.werewolfWins;
  const good = cohorts.goodWins;
  const tagById = new Map(lossTags.map((tag) => [tag.id, tag]));

  pushFinding(
    findings,
    "投票准确率差异",
    good.goodVoteAccuracy - wolf.goodVoteAccuracy,
    `好人胜局投狼率 ${formatPercent(good.goodVoteAccuracy)}，狼人胜局 ${formatPercent(wolf.goodVoteAccuracy)}。`,
  );
  pushFinding(
    findings,
    "首放逐神职风险",
    wolf.firstExileGoodPowerRate - good.firstExileGoodPowerRate,
    `狼人胜局首放逐神职率 ${formatPercent(wolf.firstExileGoodPowerRate)}，好人胜局 ${formatPercent(good.firstExileGoodPowerRate)}。`,
  );
  pushFinding(
    findings,
    "预言家生存差异",
    good.averageSeerSurvivalDays - wolf.averageSeerSurvivalDays,
    `好人胜局预言家平均存活 ${formatNumber(good.averageSeerSurvivalDays)} 天，狼人胜局 ${formatNumber(wolf.averageSeerSurvivalDays)} 天。`,
  );
  pushFinding(
    findings,
    "强动作误伤",
    tagById.get("power_misfire")?.rate ?? 0,
    `狼人胜局中 ${formatPercent(tagById.get("power_misfire")?.rate ?? 0)} 出现女巫毒或猎人枪误伤好人。`,
  );
  pushFinding(
    findings,
    "平票影响",
    cohorts.tiedGames.werewolfWins / Math.max(1, cohorts.tiedGames.games) - summary.winRates.WEREWOLVES,
    `平票局狼人胜率 ${formatPercent(ratio(cohorts.tiedGames.werewolfWins, cohorts.tiedGames.games))}，总体狼人胜率 ${formatPercent(summary.winRates.WEREWOLVES)}。`,
  );

  return findings.sort((a, b) => b.score - a.score).slice(0, 5);
}

function pushFinding(findings, label, score, detail) {
  findings.push({
    label,
    score: Math.abs(score),
    direction: score >= 0 ? "higher" : "lower",
    detail,
  });
}

function buildSwingSeeds(werewolfWins) {
  return werewolfWins
    .map((game) => ({
      seed: game.seed,
      tags: [
        game.firstExileWasGoodPower ? "first good power exile" : undefined,
        game.firstExileCamp === "GOOD" ? "first good exile" : undefined,
        game.wolfExiles === 0 ? "no wolf exile" : undefined,
        game.goodExiles >= 2 ? "multi mislynch" : undefined,
        ratio(game.goodVotesOnWolves, game.goodVotes) < 0.49 ? "low good vote accuracy" : undefined,
        game.seerDied && game.seerSurvivalDays <= 2 ? "seer early death" : undefined,
        game.witchPoisonHitsGood > 0 || game.hunterHitsGood > 0 ? "power misfire" : undefined,
        game.tiedVotes > 0 ? "tied vote" : undefined,
      ].filter(Boolean),
      days: game.days,
      goodVoteAccuracy: ratio(game.goodVotesOnWolves, game.goodVotes),
      firstExile: game.firstExileRole ? `${game.firstExileCamp}/${game.firstExileRole}` : "none",
      seerSurvivalDays: game.seerSurvivalDays,
    }))
    .filter((game) => game.tags.length > 0)
    .sort((a, b) => b.tags.length - a.tags.length || a.seed - b.seed)
    .slice(0, 12);
}

function formatAttributionMarkdown(report) {
  const { cohorts } = report;
  const lines = [
    "# AI 胜率归因报告",
    "",
    `生成时间：${report.generatedAt}`,
    "",
    "## 配置",
    "",
    `- board: ${report.options.boardId}`,
    `- games: ${report.options.gameCount}`,
    `- seeds: ${report.options.seedStart}-${report.options.seedStart + report.options.gameCount - 1}`,
    `- maxSteps: ${report.options.maxSteps}`,
    "",
    "## 总览",
    "",
    `- completed: ${report.headline.completedGames}/${report.options.gameCount}`,
    `- GOOD: ${report.headline.goodWins} (${formatPercent(report.headline.goodWinRate)})`,
    `- WEREWOLVES: ${report.headline.werewolfWins} (${formatPercent(report.headline.werewolfWinRate)})`,
    `- fallback: ${report.headline.fallbackCount} decisions in ${report.headline.fallbackGames} games`,
    "",
    "## 胜负对照",
    "",
    "| 指标 | 好人胜局 | 狼人胜局 | 全部 |",
    "| --- | ---: | ---: | ---: |",
    metricRow("好人投狼率", cohorts.goodWins.goodVoteAccuracy, cohorts.werewolfWins.goodVoteAccuracy, cohorts.all.goodVoteAccuracy, formatPercent),
    metricRow("误放逐率", cohorts.goodWins.mislynchRate, cohorts.werewolfWins.mislynchRate, cohorts.all.mislynchRate, formatPercent),
    metricRow("首放逐狼人率", cohorts.goodWins.firstExileWolfRate, cohorts.werewolfWins.firstExileWolfRate, cohorts.all.firstExileWolfRate, formatPercent),
    metricRow("首放逐神职率", cohorts.goodWins.firstExileGoodPowerRate, cohorts.werewolfWins.firstExileGoodPowerRate, cohorts.all.firstExileGoodPowerRate, formatPercent),
    metricRow("预言家平均存活天数", cohorts.goodWins.averageSeerSurvivalDays, cohorts.werewolfWins.averageSeerSurvivalDays, cohorts.all.averageSeerSurvivalDays, formatNumber),
    metricRow("女巫毒中狼率", cohorts.goodWins.witchPoisonWolfHitRate, cohorts.werewolfWins.witchPoisonWolfHitRate, cohorts.all.witchPoisonWolfHitRate, formatPercent),
    metricRow("猎人枪中狼率", cohorts.goodWins.hunterShotWolfHitRate, cohorts.werewolfWins.hunterShotWolfHitRate, cohorts.all.hunterShotWolfHitRate, formatPercent),
    metricRow("平票局占比", ratio(cohorts.goodWins.tiedVoteGames, cohorts.goodWins.games), ratio(cohorts.werewolfWins.tiedVoteGames, cohorts.werewolfWins.games), ratio(cohorts.all.tiedVoteGames, cohorts.all.games), formatPercent),
    "",
    "## 狼人胜局标签",
    "",
    "| 归因标签 | 局数 | 占狼人胜局 | 示例 seed |",
    "| --- | ---: | ---: | --- |",
    ...report.lossTags.map((tag) => `| ${tag.label} | ${tag.games} | ${formatPercent(tag.rate)} | ${tag.seeds.join(", ") || "-"} |`),
    "",
    "## 首放逐影响",
    "",
    "| 首放逐 | 局数 | 好人胜率 | 狼人胜率 |",
    "| --- | ---: | ---: | ---: |",
    ...report.firstExileMatrix
      .slice(0, 10)
      .map((row) => `| ${row.firstExileCamp}/${row.firstExileRole} | ${row.games} | ${formatPercent(row.goodWinRate)} | ${formatPercent(row.werewolfWinRate)} |`),
    "",
    "## 平票影响",
    "",
    `- 平票局：${cohorts.tiedGames.games} 局，狼人胜率 ${formatPercent(ratio(cohorts.tiedGames.werewolfWins, cohorts.tiedGames.games))}。`,
    `- 无平票局：${cohorts.untiedGames.games} 局，狼人胜率 ${formatPercent(ratio(cohorts.untiedGames.werewolfWins, cohorts.untiedGames.games))}。`,
    "",
    "## 高风险样本",
    "",
    "| Seed | 标签 | 好人投狼率 | 首放逐 | 预言家存活 |",
    "| ---: | --- | ---: | --- | ---: |",
    ...report.swingSeeds.map(
      (game) =>
        `| ${game.seed} | ${game.tags.join(", ")} | ${formatPercent(game.goodVoteAccuracy)} | ${game.firstExile} | ${formatNumber(game.seerSurvivalDays)} |`,
    ),
    "",
    "## 优先观察",
    "",
    ...report.priorityFindings.map((finding) => `- ${finding.label}: ${finding.detail}`),
    "",
    "## 下一步实验建议",
    "",
    ...report.nextExperimentHints.map((hint) => `- ${hint}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function metricRow(label, goodWinValue, werewolfWinValue, allValue, formatter) {
  return `| ${label} | ${formatter(goodWinValue)} | ${formatter(werewolfWinValue)} | ${formatter(allValue)} |`;
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

function sum(items, valueFn) {
  return items.reduce((total, item) => total + valueFn(item), 0);
}

function average(items, valueFn) {
  return ratio(sum(items, valueFn), items.length);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
