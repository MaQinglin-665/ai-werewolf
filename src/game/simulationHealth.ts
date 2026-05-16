import type { Camp } from "./types";
import type { SimulationGameStats, SimulationSummary } from "./simulationStats";

export type SimulationHealthFinding = {
  severity: "ok" | "watch" | "risk";
  label: string;
  detail: string;
  seeds: number[];
};

export type SimulationHealthReport = {
  generatedAt: string;
  options: {
    boardId: string;
    gameCount: number;
    seedStart: number;
    maxSteps: number;
  };
  outcome: {
    completedGames: number;
    goodWins: number;
    werewolfWins: number;
    goodWinRate: number;
    werewolfWinRate: number;
    fallbackCount: number;
  };
  goodLossTiming: Array<{ day: number; games: number; rateOfGoodLosses: number }>;
  seer: {
    claimRate: number;
    claimByDay2Rate: number;
    goldPublicRate: number;
    goldWaterVoteAccuracy: number;
    averageSurvivalDays: number;
  };
  powerRoles: {
    witchPoisonWolfHitRate: number;
    hunterShotWolfHitRate: number;
    guardBlockRate: number;
    guardPowerBlocks: number;
  };
  voting: {
    goodVoteAccuracy: number;
    publicLogicVoteRate: number;
    fragmentedVoteRoundRate: number;
    randomishVoteGames: number;
    randomishVoteWerewolfWinRate: number;
  };
  findings: SimulationHealthFinding[];
  swingSeeds: Array<{ seed: number; winner?: Camp; days: number; tags: string[] }>;
};

export function buildSimulationHealthReport(summary: SimulationSummary): SimulationHealthReport {
  const goodLosses = summary.games.filter((game) => game.winner === "WEREWOLVES");
  const randomishVoteGames = summary.games.filter(isRandomishVoteGame);
  const randomishWerewolfWins = randomishVoteGames.filter((game) => game.winner === "WEREWOLVES").length;

  const report: SimulationHealthReport = {
    generatedAt: new Date().toISOString(),
    options: {
      boardId: summary.boardId ?? "default",
      gameCount: summary.gameCount,
      seedStart: summary.seedStart,
      maxSteps: summary.maxSteps,
    },
    outcome: {
      completedGames: summary.completedGames,
      goodWins: summary.winners.GOOD,
      werewolfWins: summary.winners.WEREWOLVES,
      goodWinRate: summary.winRates.GOOD,
      werewolfWinRate: summary.winRates.WEREWOLVES,
      fallbackCount: summary.fallbackCount,
    },
    goodLossTiming: buildDayBuckets(goodLosses),
    seer: {
      claimRate: ratio(summary.trueSeerClaimGames, summary.gameCount),
      claimByDay2Rate: ratio(summary.seerClaimedByDay2Games, summary.gameCount),
      goldPublicRate: summary.seerGoldPublicRate,
      goldWaterVoteAccuracy: summary.goldWaterVoteAccuracy,
      averageSurvivalDays: summary.averageSeerSurvivalDays,
    },
    powerRoles: {
      witchPoisonWolfHitRate: summary.witchPoisonWolfHitRate,
      hunterShotWolfHitRate: summary.hunterShotWolfHitRate,
      guardBlockRate: summary.guardBlockRate,
      guardPowerBlocks: summary.guardBlocksPower,
    },
    voting: {
      goodVoteAccuracy: summary.goodVoteAccuracy,
      publicLogicVoteRate: summary.publicLogicVoteRate,
      fragmentedVoteRoundRate: ratio(summary.fragmentedVoteRounds, summary.voteRounds),
      randomishVoteGames: randomishVoteGames.length,
      randomishVoteWerewolfWinRate: ratio(randomishWerewolfWins, randomishVoteGames.length),
    },
    findings: [],
    swingSeeds: buildSwingSeeds(summary.games),
  };

  report.findings = buildFindings(summary, report, randomishVoteGames);
  return report;
}

export function formatSimulationHealthReport(report: SimulationHealthReport): string {
  const lines = [
    "12p simulation health report",
    `generated: ${report.generatedAt}`,
    `board: ${report.options.boardId}`,
    `games: ${report.options.gameCount} (seeds ${report.options.seedStart}-${report.options.seedStart + report.options.gameCount - 1})`,
    `max steps: ${report.options.maxSteps}`,
    "",
    "Outcome",
    `- completed: ${report.outcome.completedGames}/${report.options.gameCount}`,
    `- wins: GOOD ${report.outcome.goodWins} (${formatPercent(report.outcome.goodWinRate)}), WEREWOLVES ${report.outcome.werewolfWins} (${formatPercent(report.outcome.werewolfWinRate)})`,
    `- fallback decisions: ${report.outcome.fallbackCount}`,
    "",
    "Good loss timing",
    ...formatDayBuckets(report.goodLossTiming),
    "",
    "Decision health",
    `- seer claim rate: ${formatPercent(report.seer.claimRate)}, by day 2: ${formatPercent(report.seer.claimByDay2Rate)}, avg survival: ${formatNumber(report.seer.averageSurvivalDays)} days`,
    `- seer gold water: public ${formatPercent(report.seer.goldPublicRate)}, gold-water vote accuracy ${formatPercent(report.seer.goldWaterVoteAccuracy)}`,
    `- witch poison wolf hit rate: ${formatPercent(report.powerRoles.witchPoisonWolfHitRate)}`,
    `- hunter shot wolf hit rate: ${formatPercent(report.powerRoles.hunterShotWolfHitRate)}`,
    `- guard block rate: ${formatPercent(report.powerRoles.guardBlockRate)}, power blocks: ${report.powerRoles.guardPowerBlocks}`,
    `- good vote accuracy: ${formatPercent(report.voting.goodVoteAccuracy)}`,
    `- public-logic vote reason rate: ${formatPercent(report.voting.publicLogicVoteRate)}`,
    `- fragmented vote round rate: ${formatPercent(report.voting.fragmentedVoteRoundRate)}`,
    `- randomish vote games: ${report.voting.randomishVoteGames}, werewolf win rate there: ${formatPercent(report.voting.randomishVoteWerewolfWinRate)}`,
    "",
    "Findings",
    ...formatFindings(report.findings),
    "",
    "Swing seeds",
    ...formatSwingSeeds(report.swingSeeds),
  ];

  return `${lines.join("\n")}\n`;
}

function buildFindings(
  summary: SimulationSummary,
  report: SimulationHealthReport,
  randomishVoteGames: SimulationGameStats[],
): SimulationHealthFinding[] {
  const findings: SimulationHealthFinding[] = [];

  pushFinding(findings, {
    severity: summary.winRates.GOOD < 0.35 ? "risk" : summary.winRates.GOOD < 0.42 ? "watch" : "ok",
    label: "win-rate band",
    detail: `GOOD win rate is ${formatPercent(summary.winRates.GOOD)}.`,
    seeds: summary.games.filter((game) => game.winner === "WEREWOLVES").slice(0, 8).map((game) => game.seed),
  });

  pushFinding(findings, {
    severity: report.voting.goodVoteAccuracy < 0.45 ? "risk" : report.voting.goodVoteAccuracy < 0.52 ? "watch" : "ok",
    label: "good vote accuracy",
    detail: `Good players voted wolves on ${formatPercent(report.voting.goodVoteAccuracy)} of target votes.`,
    seeds: lowestSeeds(summary.games, (game) => ratio(game.goodVotesOnWolves, game.goodVotes)),
  });

  pushFinding(findings, {
    severity: report.seer.claimByDay2Rate < 0.5 ? "risk" : report.seer.claimByDay2Rate < 0.7 ? "watch" : "ok",
    label: "seer timing",
    detail: `True seer claimed by day 2 in ${formatPercent(report.seer.claimByDay2Rate)} of games.`,
    seeds: summary.games
      .filter((game) => !game.seerClaimedByDay2)
      .slice(0, 8)
      .map((game) => game.seed),
  });

  pushFinding(findings, {
    severity: summary.seerGoodChecks > 0 && report.seer.goldPublicRate < 0.4 ? "risk" : report.seer.goldPublicRate < 0.65 ? "watch" : "ok",
    label: "gold-water use",
    detail: `True seer made ${summary.seerGoodChecks} good checks and publicly exposed ${summary.seerGoldClaims}.`,
    seeds: summary.games
      .filter((game) => game.seerGoodChecks > 0 && game.seerGoldClaims === 0)
      .slice(0, 8)
      .map((game) => game.seed),
  });

  pushFinding(findings, {
    severity: summary.witchPoisonUses > 0 && report.powerRoles.witchPoisonWolfHitRate < 0.45 ? "risk" : "ok",
    label: "witch poison",
    detail: `Poison hit wolves ${summary.witchPoisonHitsWolves}/${summary.witchPoisonUses} times.`,
    seeds: summary.games
      .filter((game) => game.witchPoisonHitsGood > 0)
      .slice(0, 8)
      .map((game) => game.seed),
  });

  pushFinding(findings, {
    severity: summary.hunterShots > 0 && report.powerRoles.hunterShotWolfHitRate < 0.45 ? "risk" : "ok",
    label: "hunter shot",
    detail: `Hunter shots hit wolves ${summary.hunterHitsWolves}/${summary.hunterShots} times.`,
    seeds: summary.games
      .filter((game) => game.hunterHitsGood > 0)
      .slice(0, 8)
      .map((game) => game.seed),
  });

  const randomishGap = report.voting.randomishVoteWerewolfWinRate - summary.winRates.WEREWOLVES;
  pushFinding(findings, {
    severity: randomishVoteGames.length >= 3 && randomishGap > 0.12 ? "risk" : randomishVoteGames.length >= 3 && randomishGap > 0.05 ? "watch" : "ok",
    label: "randomish vote wins",
    detail: `Randomish/tied vote games have WEREWOLVES win rate ${formatPercent(report.voting.randomishVoteWerewolfWinRate)} versus baseline ${formatPercent(summary.winRates.WEREWOLVES)}.`,
    seeds: randomishVoteGames.slice(0, 8).map((game) => game.seed),
  });

  pushFinding(findings, {
    severity: report.voting.publicLogicVoteRate < 0.5 ? "risk" : report.voting.publicLogicVoteRate < 0.7 ? "watch" : "ok",
    label: "public vote reasons",
    detail: `Vote reasons referenced public logic ${summary.publicLogicVotes}/${summary.reasonedVotes} times.`,
    seeds: summary.games
      .filter((game) => game.reasonedVotes > 0 && ratio(game.publicLogicVotes, game.reasonedVotes) < 0.5)
      .slice(0, 8)
      .map((game) => game.seed),
  });

  return findings.sort((a, b) => severityScore(b.severity) - severityScore(a.severity) || a.label.localeCompare(b.label));
}

function buildDayBuckets(games: SimulationGameStats[]): SimulationHealthReport["goodLossTiming"] {
  const byDay = new Map<number, number>();
  for (const game of games) {
    byDay.set(game.days, (byDay.get(game.days) ?? 0) + 1);
  }

  return [...byDay.entries()]
    .map(([day, count]) => ({
      day,
      games: count,
      rateOfGoodLosses: ratio(count, games.length),
    }))
    .sort((a, b) => a.day - b.day);
}

function buildSwingSeeds(games: SimulationGameStats[]): SimulationHealthReport["swingSeeds"] {
  return games
    .map((game) => ({
      seed: game.seed,
      winner: game.winner,
      days: game.days,
      tags: buildSeedTags(game),
    }))
    .filter((game) => game.tags.length > 0)
    .sort((a, b) => b.tags.length - a.tags.length || a.seed - b.seed)
    .slice(0, 12);
}

function buildSeedTags(game: SimulationGameStats): string[] {
  return [
    game.winner === "WEREWOLVES" ? "wolf win" : undefined,
    game.firstExileWasGoodPower ? "first exile good power" : undefined,
    game.wolfExiles === 0 ? "no wolf exile" : undefined,
    ratio(game.goodVotesOnWolves, game.goodVotes) < 0.45 ? "low good vote accuracy" : undefined,
    !game.seerClaimedByDay2 ? "seer late/no claim by D2" : undefined,
    game.seerGoodChecks > 0 && game.seerGoldClaims === 0 ? "gold water hidden/unpublished" : undefined,
    game.witchPoisonHitsGood > 0 ? "witch poisoned good" : undefined,
    game.hunterHitsGood > 0 ? "hunter shot good" : undefined,
    isRandomishVoteGame(game) ? "randomish/tied vote" : undefined,
  ].filter((tag): tag is string => Boolean(tag));
}

function isRandomishVoteGame(game: SimulationGameStats): boolean {
  return game.tiedVotes > 0 || game.fragmentedVoteRounds > 0 || game.averageTopVoteShare <= 0.38;
}

function pushFinding(findings: SimulationHealthFinding[], finding: SimulationHealthFinding): void {
  findings.push(finding);
}

function lowestSeeds(games: SimulationGameStats[], score: (game: SimulationGameStats) => number): number[] {
  return [...games]
    .sort((left, right) => score(left) - score(right) || left.seed - right.seed)
    .slice(0, 8)
    .map((game) => game.seed);
}

function formatDayBuckets(buckets: SimulationHealthReport["goodLossTiming"]): string[] {
  if (buckets.length === 0) return ["- no good losses"];
  return buckets.map((bucket) => `- day ${bucket.day}: ${bucket.games} games (${formatPercent(bucket.rateOfGoodLosses)} of good losses)`);
}

function formatFindings(findings: SimulationHealthFinding[]): string[] {
  if (findings.length === 0) return ["- no findings"];
  return findings.map((finding) => {
    const seedText = finding.seeds.length > 0 ? ` seeds: ${finding.seeds.join(", ")}` : "";
    return `- ${finding.severity.toUpperCase()} ${finding.label}: ${finding.detail}${seedText}`;
  });
}

function formatSwingSeeds(seeds: SimulationHealthReport["swingSeeds"]): string[] {
  if (seeds.length === 0) return ["- none"];
  return seeds.map((seed) => `- ${seed.seed}: ${seed.winner ?? "unfinished"}, day ${seed.days}, ${seed.tags.join(", ")}`);
}

function severityScore(severity: SimulationHealthFinding["severity"]): number {
  if (severity === "risk") return 2;
  if (severity === "watch") return 1;
  return 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
