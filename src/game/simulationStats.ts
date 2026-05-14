import { advanceWithMockAi } from "@/ai/mockAgent";
import type { AiDecisionLog } from "@/ai/types";
import { buildTableMemory } from "./tableMemory";
import { createGame, getCamp, getSeat } from "./engine";
import type { Camp, DeathReason, GameEvent, GameState, Phase, Role } from "./types";

export type SimulationOptions = {
  boardId?: string;
  gameCount?: number;
  seedStart?: number;
  maxSteps?: number;
  humanSeatId?: number;
  progress?: (completedGames: number, totalGames: number) => void;
};

export type SimulationGameStats = {
  seed: number;
  completed: boolean;
  winner?: Camp;
  days: number;
  aiActions: number;
  fallbackCount: number;
  tiedVotes: number;
  voteRounds: number;
  averageTopVoteShare: number;
  totalVotes: number;
  goodVotes: number;
  goodVotesOnWolves: number;
  wolfVotes: number;
  wolfVotesOnTeammates: number;
  exiles: number;
  wolfExiles: number;
  goodExiles: number;
  firstExileDay?: number;
  firstExileSeatId?: number;
  firstExileRole?: Role;
  firstExileCamp?: Camp;
  firstExileWasGoodPower: boolean;
  roleClaims: number;
  truthfulClaims: number;
  seerClaims: number;
  wolfSeerClaims: number;
  counterclaimRoles: number;
  stanceCount: number;
  stanceShiftCount: number;
  speechCount: number;
  witchSaveUses: number;
  witchSaveGood: number;
  witchPoisonUses: number;
  witchPoisonHitsWolves: number;
  witchPoisonHitsGood: number;
  hunterShotWindows: number;
  hunterShots: number;
  hunterSkips: number;
  hunterHitsWolves: number;
  hunterHitsGood: number;
  seerChecks: number;
  seerWolfChecks: number;
  seerGoodChecks: number;
  seerSurvivalDays: number;
  seerDied: boolean;
  seerDeathReason?: DeathReason;
  trueSeerClaimed: boolean;
  phaseActionCounts: Partial<Record<Phase, number>>;
  humanRole: Role;
};

export type RoleBucket = {
  games: number;
  goodWins: number;
  werewolfWins: number;
};

export type SeerDeathBucket = Record<DeathReason | "ALIVE", number>;

export type SimulationSummary = {
  boardId?: string;
  gameCount: number;
  seedStart: number;
  maxSteps: number;
  completedGames: number;
  winners: Record<Camp, number>;
  winRates: Record<Camp, number>;
  averageDays: number;
  minDays: number;
  maxDays: number;
  totalAiActions: number;
  averageAiActions: number;
  fallbackCount: number;
  fallbackGames: number;
  tiedVotes: number;
  tiedVoteGames: number;
  voteRounds: number;
  averageTopVoteShare: number;
  totalVotes: number;
  goodVotes: number;
  goodVotesOnWolves: number;
  goodVoteAccuracy: number;
  wolfVotes: number;
  wolfVotesOnTeammates: number;
  wolfTeammateVoteRate: number;
  exiles: number;
  wolfExiles: number;
  goodExiles: number;
  mislynchRate: number;
  firstExiles: number;
  firstExileWolves: number;
  firstExileGood: number;
  firstExileGoodPowers: number;
  firstExileWolfRate: number;
  firstExileGoodPowerRate: number;
  roleClaims: number;
  truthfulClaims: number;
  truthfulClaimRate: number;
  seerClaims: number;
  wolfSeerClaims: number;
  counterclaimGames: number;
  wolfSeerClaimGames: number;
  stanceCount: number;
  stanceShiftGames: number;
  averageClaims: number;
  averageStances: number;
  averageSpeeches: number;
  witchSaveUses: number;
  witchSaveGood: number;
  witchPoisonUses: number;
  witchPoisonHitsWolves: number;
  witchPoisonHitsGood: number;
  witchPoisonWolfHitRate: number;
  hunterShotWindows: number;
  hunterShots: number;
  hunterSkips: number;
  hunterHitsWolves: number;
  hunterHitsGood: number;
  hunterShotWolfHitRate: number;
  seerChecks: number;
  seerWolfChecks: number;
  seerGoodChecks: number;
  seerWolfCheckRate: number;
  averageSeerChecks: number;
  averageSeerSurvivalDays: number;
  seerDeathGames: number;
  seerDeathsByReason: SeerDeathBucket;
  trueSeerClaimGames: number;
  phaseActionCounts: Partial<Record<Phase, number>>;
  humanRoleBuckets: Record<Role, RoleBucket>;
  games: SimulationGameStats[];
};

export type AcceptanceStatus = "pass" | "warn" | "fail";

export type AcceptanceCheck = {
  status: AcceptanceStatus;
  label: string;
  detail: string;
};

const ROLES: Role[] = ["WEREWOLF", "VILLAGER", "SEER", "WITCH", "HUNTER", "GUARD"];

export async function runMockGameSimulation(options: SimulationOptions = {}): Promise<SimulationSummary> {
  const gameCount = options.gameCount ?? 1000;
  const seedStart = options.seedStart ?? 0;
  const maxSteps = options.maxSteps ?? 500;
  const humanSeatId = options.humanSeatId ?? 1;
  const games: SimulationGameStats[] = [];

  for (let index = 0; index < gameCount; index += 1) {
    const seed = seedStart + index;
    try {
      const { state, aiLogs } = await advanceWithMockAi(createGame({ boardId: options.boardId, seed, humanSeatId }), {
        ignoreHuman: true,
        maxSteps,
      });
      games.push(summarizeSimulatedGame(seed, state, aiLogs));
    } catch (error) {
      throw new Error(`Simulation failed at seed ${seed}: ${error instanceof Error ? error.message : String(error)}`);
    }
    options.progress?.(index + 1, gameCount);
  }

  return summarizeSimulation(games, { boardId: options.boardId, gameCount, seedStart, maxSteps });
}

export function summarizeSimulatedGame(
  seed: number,
  state: GameState,
  aiLogs: AiDecisionLog[],
): SimulationGameStats {
  const voteStats = summarizeVotes(state);
  const exileStats = summarizeExiles(state);
  const firstExile = summarizeFirstExile(state);
  const claimStats = summarizeClaims(state);
  const powerStats = summarizePowerRoles(state);
  const tableMemory = buildTableMemory(state);
  const fallbackCount = aiLogs.filter((log) => log.isFallback).length;

  return {
    seed,
    completed: state.phase === "GAME_OVER" && Boolean(state.result),
    winner: state.result?.winner,
    days: state.day,
    aiActions: aiLogs.length,
    fallbackCount,
    tiedVotes: state.events.filter((event) => event.type === "VOTE_TIED").length,
    voteRounds: voteStats.voteRounds,
    averageTopVoteShare: voteStats.averageTopVoteShare,
    totalVotes: voteStats.totalVotes,
    goodVotes: voteStats.goodVotes,
    goodVotesOnWolves: voteStats.goodVotesOnWolves,
    wolfVotes: voteStats.wolfVotes,
    wolfVotesOnTeammates: voteStats.wolfVotesOnTeammates,
    exiles: exileStats.exiles,
    wolfExiles: exileStats.wolfExiles,
    goodExiles: exileStats.goodExiles,
    ...firstExile,
    roleClaims: state.roleClaims.length,
    truthfulClaims: claimStats.truthfulClaims,
    seerClaims: claimStats.seerClaims,
    wolfSeerClaims: claimStats.wolfSeerClaims,
    counterclaimRoles: claimStats.counterclaimRoles,
    stanceCount: state.stances.length,
    stanceShiftCount: tableMemory.stanceShifts.length,
    speechCount: state.speeches.length,
    ...powerStats,
    phaseActionCounts: countByPhase(aiLogs),
    humanRole: getSeat(state, state.humanSeatId).role,
  };
}

export function summarizeSimulation(
  games: SimulationGameStats[],
  params: { boardId?: string; gameCount: number; seedStart: number; maxSteps: number },
): SimulationSummary {
  const winners: Record<Camp, number> = { GOOD: 0, WEREWOLVES: 0 };
  const phaseActionCounts: Partial<Record<Phase, number>> = {};
  const humanRoleBuckets = createRoleBuckets();

  for (const game of games) {
    if (game.winner) winners[game.winner] += 1;
    for (const [phase, count] of Object.entries(game.phaseActionCounts) as Array<[Phase, number]>) {
      phaseActionCounts[phase] = (phaseActionCounts[phase] ?? 0) + count;
    }
    const bucket = humanRoleBuckets[game.humanRole];
    bucket.games += 1;
    if (game.winner === "GOOD") bucket.goodWins += 1;
    if (game.winner === "WEREWOLVES") bucket.werewolfWins += 1;
  }

  const completedGames = games.filter((game) => game.completed).length;
  const totalDays = sum(games, (game) => game.days);
  const totalAiActions = sum(games, (game) => game.aiActions);
  const fallbackCount = sum(games, (game) => game.fallbackCount);
  const tiedVotes = sum(games, (game) => game.tiedVotes);
  const voteRounds = sum(games, (game) => game.voteRounds);
  const totalVotes = sum(games, (game) => game.totalVotes);
  const goodVotes = sum(games, (game) => game.goodVotes);
  const goodVotesOnWolves = sum(games, (game) => game.goodVotesOnWolves);
  const wolfVotes = sum(games, (game) => game.wolfVotes);
  const wolfVotesOnTeammates = sum(games, (game) => game.wolfVotesOnTeammates);
  const exiles = sum(games, (game) => game.exiles);
  const firstExiles = games.filter((game) => game.firstExileCamp).length;
  const firstExileWolves = games.filter((game) => game.firstExileCamp === "WEREWOLVES").length;
  const firstExileGood = games.filter((game) => game.firstExileCamp === "GOOD").length;
  const firstExileGoodPowers = games.filter((game) => game.firstExileWasGoodPower).length;
  const roleClaims = sum(games, (game) => game.roleClaims);
  const truthfulClaims = sum(games, (game) => game.truthfulClaims);
  const stanceCount = sum(games, (game) => game.stanceCount);
  const witchPoisonUses = sum(games, (game) => game.witchPoisonUses);
  const hunterShots = sum(games, (game) => game.hunterShots);
  const seerChecks = sum(games, (game) => game.seerChecks);
  const topVoteShareTotal = sum(games, (game) => game.averageTopVoteShare * game.voteRounds);

  return {
    boardId: params.boardId,
    gameCount: params.gameCount,
    seedStart: params.seedStart,
    maxSteps: params.maxSteps,
    completedGames,
    winners,
    winRates: {
      GOOD: ratio(winners.GOOD, params.gameCount),
      WEREWOLVES: ratio(winners.WEREWOLVES, params.gameCount),
    },
    averageDays: ratio(totalDays, games.length),
    minDays: games.length > 0 ? Math.min(...games.map((game) => game.days)) : 0,
    maxDays: games.length > 0 ? Math.max(...games.map((game) => game.days)) : 0,
    totalAiActions,
    averageAiActions: ratio(totalAiActions, games.length),
    fallbackCount,
    fallbackGames: games.filter((game) => game.fallbackCount > 0).length,
    tiedVotes,
    tiedVoteGames: games.filter((game) => game.tiedVotes > 0).length,
    voteRounds,
    averageTopVoteShare: ratio(topVoteShareTotal, voteRounds),
    totalVotes,
    goodVotes,
    goodVotesOnWolves,
    goodVoteAccuracy: ratio(goodVotesOnWolves, goodVotes),
    wolfVotes,
    wolfVotesOnTeammates,
    wolfTeammateVoteRate: ratio(wolfVotesOnTeammates, wolfVotes),
    exiles,
    wolfExiles: sum(games, (game) => game.wolfExiles),
    goodExiles: sum(games, (game) => game.goodExiles),
    mislynchRate: ratio(sum(games, (game) => game.goodExiles), exiles),
    firstExiles,
    firstExileWolves,
    firstExileGood,
    firstExileGoodPowers,
    firstExileWolfRate: ratio(firstExileWolves, firstExiles),
    firstExileGoodPowerRate: ratio(firstExileGoodPowers, firstExiles),
    roleClaims,
    truthfulClaims,
    truthfulClaimRate: ratio(truthfulClaims, roleClaims),
    seerClaims: sum(games, (game) => game.seerClaims),
    wolfSeerClaims: sum(games, (game) => game.wolfSeerClaims),
    counterclaimGames: games.filter((game) => game.counterclaimRoles > 0).length,
    wolfSeerClaimGames: games.filter((game) => game.wolfSeerClaims > 0).length,
    stanceCount,
    stanceShiftGames: games.filter((game) => game.stanceShiftCount > 0).length,
    averageClaims: ratio(roleClaims, games.length),
    averageStances: ratio(stanceCount, games.length),
    averageSpeeches: ratio(sum(games, (game) => game.speechCount), games.length),
    witchSaveUses: sum(games, (game) => game.witchSaveUses),
    witchSaveGood: sum(games, (game) => game.witchSaveGood),
    witchPoisonUses,
    witchPoisonHitsWolves: sum(games, (game) => game.witchPoisonHitsWolves),
    witchPoisonHitsGood: sum(games, (game) => game.witchPoisonHitsGood),
    witchPoisonWolfHitRate: ratio(sum(games, (game) => game.witchPoisonHitsWolves), witchPoisonUses),
    hunterShotWindows: sum(games, (game) => game.hunterShotWindows),
    hunterShots,
    hunterSkips: sum(games, (game) => game.hunterSkips),
    hunterHitsWolves: sum(games, (game) => game.hunterHitsWolves),
    hunterHitsGood: sum(games, (game) => game.hunterHitsGood),
    hunterShotWolfHitRate: ratio(sum(games, (game) => game.hunterHitsWolves), hunterShots),
    seerChecks,
    seerWolfChecks: sum(games, (game) => game.seerWolfChecks),
    seerGoodChecks: sum(games, (game) => game.seerGoodChecks),
    seerWolfCheckRate: ratio(sum(games, (game) => game.seerWolfChecks), seerChecks),
    averageSeerChecks: ratio(seerChecks, games.length),
    averageSeerSurvivalDays: ratio(sum(games, (game) => game.seerSurvivalDays), games.length),
    seerDeathGames: games.filter((game) => game.seerDied).length,
    seerDeathsByReason: buildSeerDeathBuckets(games),
    trueSeerClaimGames: games.filter((game) => game.trueSeerClaimed).length,
    phaseActionCounts,
    humanRoleBuckets,
    games,
  };
}

export function evaluateSimulationAcceptance(summary: SimulationSummary): AcceptanceCheck[] {
  const checks: AcceptanceCheck[] = [
    {
      status: summary.completedGames === summary.gameCount ? "pass" : "fail",
      label: "completion",
      detail: `${summary.completedGames}/${summary.gameCount} games reached GAME_OVER`,
    },
    {
      status: summary.fallbackCount === 0 ? "pass" : "fail",
      label: "fallbacks",
      detail: `${summary.fallbackCount} fallback decisions across ${summary.fallbackGames} games`,
    },
    {
      status: summary.wolfTeammateVoteRate <= 0.35 ? "pass" : "warn",
      label: "wolf distance votes",
      detail: `${summary.wolfVotesOnTeammates}/${summary.wolfVotes} wolf votes targeted partners`,
    },
    {
      status: winBalanceStatus(summary),
      label: "win balance",
      detail: `GOOD ${formatPercent(summary.winRates.GOOD)}, WEREWOLVES ${formatPercent(summary.winRates.WEREWOLVES)}`,
    },
    {
      status: summary.counterclaimGames > 0 ? "pass" : "warn",
      label: "counterclaims",
      detail: `${summary.counterclaimGames} games produced public counterclaims`,
    },
  ];

  return checks;
}

export function formatSimulationReport(summary: SimulationSummary): string {
  const checks = evaluateSimulationAcceptance(summary);
  const lines = [
    "AI Werewolf simulation report",
    ...(summary.boardId ? [`board: ${summary.boardId}`] : []),
    `games: ${summary.gameCount} (seeds ${summary.seedStart}-${summary.seedStart + summary.gameCount - 1})`,
    `max steps: ${summary.maxSteps}`,
    "",
    "Outcome",
    `- completed: ${summary.completedGames}/${summary.gameCount}`,
    `- wins: GOOD ${summary.winners.GOOD} (${formatPercent(summary.winRates.GOOD)}), WEREWOLVES ${summary.winners.WEREWOLVES} (${formatPercent(summary.winRates.WEREWOLVES)})`,
    `- days: avg ${formatNumber(summary.averageDays)}, min ${summary.minDays}, max ${summary.maxDays}`,
    `- AI actions: total ${summary.totalAiActions}, avg ${formatNumber(summary.averageAiActions)}`,
    "",
    "Voting",
    `- vote rounds: ${summary.voteRounds}, tied votes: ${summary.tiedVotes} in ${summary.tiedVoteGames} games`,
    `- top vote share: ${formatPercent(summary.averageTopVoteShare)}`,
    `- good votes on wolves: ${summary.goodVotesOnWolves}/${summary.goodVotes} (${formatPercent(summary.goodVoteAccuracy)})`,
    `- wolf votes on teammates: ${summary.wolfVotesOnTeammates}/${summary.wolfVotes} (${formatPercent(summary.wolfTeammateVoteRate)})`,
    `- exiles: wolves ${summary.wolfExiles}, good ${summary.goodExiles}, mislynch rate ${formatPercent(summary.mislynchRate)}`,
    `- first exiles: wolves ${summary.firstExileWolves}, good ${summary.firstExileGood}, good powers ${summary.firstExileGoodPowers} (${formatPercent(summary.firstExileGoodPowerRate)})`,
    "",
    "Table memory",
    `- role claims: ${summary.roleClaims}, truthful ${summary.truthfulClaims} (${formatPercent(summary.truthfulClaimRate)})`,
    `- seer claims: ${summary.seerClaims}, wolf seer claims: ${summary.wolfSeerClaims} in ${summary.wolfSeerClaimGames} games`,
    `- counterclaim games: ${summary.counterclaimGames}`,
    `- stances: ${summary.stanceCount}, stance shift games: ${summary.stanceShiftGames}`,
    `- avg claims/stances/speeches per game: ${formatNumber(summary.averageClaims)} / ${formatNumber(summary.averageStances)} / ${formatNumber(summary.averageSpeeches)}`,
    "",
    "Power roles",
    `- witch saves: ${summary.witchSaveUses}, successful good saves ${summary.witchSaveGood}`,
    `- witch poison: ${summary.witchPoisonUses}, wolves ${summary.witchPoisonHitsWolves}, good ${summary.witchPoisonHitsGood}, wolf hit rate ${formatPercent(summary.witchPoisonWolfHitRate)}`,
    `- hunter windows: ${summary.hunterShotWindows}, shots ${summary.hunterShots}, skips ${summary.hunterSkips}`,
    `- hunter hits: wolves ${summary.hunterHitsWolves}, good ${summary.hunterHitsGood}, wolf hit rate ${formatPercent(summary.hunterShotWolfHitRate)}`,
    `- seer checks: ${summary.seerChecks}, wolves ${summary.seerWolfChecks}, good ${summary.seerGoodChecks}, wolf check rate ${formatPercent(summary.seerWolfCheckRate)}`,
    `- seer survival: avg ${formatNumber(summary.averageSeerSurvivalDays)} days, died in ${summary.seerDeathGames} games, claimed in ${summary.trueSeerClaimGames} games`,
    `- seer deaths: wolf kill ${summary.seerDeathsByReason.WOLF_KILL}, exile ${summary.seerDeathsByReason.EXILED}, witch poison ${summary.seerDeathsByReason.WITCH_POISON}, hunter shot ${summary.seerDeathsByReason.HUNTER_SHOT}, alive ${summary.seerDeathsByReason.ALIVE}`,
    "",
    "Human-seat role buckets",
    ...formatRoleBuckets(summary.humanRoleBuckets),
    "",
    "Phase action counts",
    ...formatPhaseCounts(summary.phaseActionCounts),
    "",
    "Acceptance",
    ...checks.map((check) => `- ${check.status.toUpperCase()} ${check.label}: ${check.detail}`),
  ];

  return lines.join("\n");
}

function summarizeVotes(state: GameState): Pick<
  SimulationGameStats,
  | "voteRounds"
  | "averageTopVoteShare"
  | "totalVotes"
  | "goodVotes"
  | "goodVotesOnWolves"
  | "wolfVotes"
  | "wolfVotesOnTeammates"
> {
  let totalVotes = 0;
  let goodVotes = 0;
  let goodVotesOnWolves = 0;
  let wolfVotes = 0;
  let wolfVotesOnTeammates = 0;
  const topVoteShares: number[] = [];

  for (const event of state.events) {
    if (event.type === "VOTE_CAST") {
      const voterSeatId = readNumber(event, "voterSeatId");
      const targetSeatId = readNumber(event, "targetSeatId");
      if (!voterSeatId || !targetSeatId) continue;

      const voter = getSeat(state, voterSeatId);
      const target = getSeat(state, targetSeatId);
      totalVotes += 1;

      if (voter.role === "WEREWOLF") {
        wolfVotes += 1;
        if (target.role === "WEREWOLF") wolfVotesOnTeammates += 1;
      } else {
        goodVotes += 1;
        if (target.role === "WEREWOLF") goodVotesOnWolves += 1;
      }
    }

    if (event.type === "VOTE_REVEALED") {
      const tally = readTally(event);
      const votesInRound = tally.reduce((total, item) => total + item.votes, 0);
      const topVotes = tally.reduce((top, item) => Math.max(top, item.votes), 0);
      if (votesInRound > 0) topVoteShares.push(topVotes / votesInRound);
    }
  }

  return {
    voteRounds: topVoteShares.length,
    averageTopVoteShare: ratio(
      topVoteShares.reduce((total, share) => total + share, 0),
      topVoteShares.length,
    ),
    totalVotes,
    goodVotes,
    goodVotesOnWolves,
    wolfVotes,
    wolfVotesOnTeammates,
  };
}

function summarizeExiles(state: GameState): Pick<SimulationGameStats, "exiles" | "wolfExiles" | "goodExiles"> {
  let exiles = 0;
  let wolfExiles = 0;
  let goodExiles = 0;

  for (const event of state.events) {
    if (event.type !== "PLAYER_EXILED") continue;
    const seatId = readNumber(event, "seatId");
    if (!seatId) continue;
    exiles += 1;
    if (getCamp(getSeat(state, seatId).role) === "WEREWOLVES") {
      wolfExiles += 1;
    } else {
      goodExiles += 1;
    }
  }

  return { exiles, wolfExiles, goodExiles };
}

function summarizeFirstExile(state: GameState): Pick<
  SimulationGameStats,
  "firstExileDay" | "firstExileSeatId" | "firstExileRole" | "firstExileCamp" | "firstExileWasGoodPower"
> {
  const event = state.events.find((item) => item.type === "PLAYER_EXILED");
  if (!event) {
    return { firstExileWasGoodPower: false };
  }
  const seatId = readNumber(event, "seatId");
  if (!seatId) {
    return { firstExileWasGoodPower: false };
  }

  const seat = getSeat(state, seatId);
  const camp = getCamp(seat.role);
  return {
    firstExileDay: event.day,
    firstExileSeatId: seatId,
    firstExileRole: seat.role,
    firstExileCamp: camp,
    firstExileWasGoodPower: camp === "GOOD" && seat.role !== "VILLAGER",
  };
}

function summarizeClaims(
  state: GameState,
): Pick<SimulationGameStats, "truthfulClaims" | "seerClaims" | "wolfSeerClaims" | "counterclaimRoles"> {
  const claimsByRole = new Map<Role, number>();
  let truthfulClaims = 0;
  let seerClaims = 0;
  let wolfSeerClaims = 0;

  for (const claim of state.roleClaims) {
    const claimant = getSeat(state, claim.claimantSeatId);
    claimsByRole.set(claim.claimedRole, (claimsByRole.get(claim.claimedRole) ?? 0) + 1);
    if (claimant.role === claim.claimedRole) truthfulClaims += 1;
    if (claim.claimedRole === "SEER") {
      seerClaims += 1;
      if (claimant.role === "WEREWOLF") wolfSeerClaims += 1;
    }
  }

  return {
    truthfulClaims,
    seerClaims,
    wolfSeerClaims,
    counterclaimRoles: Array.from(claimsByRole.values()).filter((count) => count > 1).length,
  };
}

function summarizePowerRoles(
  state: GameState,
): Pick<
  SimulationGameStats,
  | "witchSaveUses"
  | "witchSaveGood"
  | "witchPoisonUses"
  | "witchPoisonHitsWolves"
  | "witchPoisonHitsGood"
  | "hunterShotWindows"
  | "hunterShots"
  | "hunterSkips"
  | "hunterHitsWolves"
  | "hunterHitsGood"
  | "seerChecks"
  | "seerWolfChecks"
  | "seerGoodChecks"
  | "seerSurvivalDays"
  | "seerDied"
  | "seerDeathReason"
  | "trueSeerClaimed"
> {
  let witchSaveUses = 0;
  let witchSaveGood = 0;
  let witchPoisonUses = 0;
  let witchPoisonHitsWolves = 0;
  let witchPoisonHitsGood = 0;
  let hunterShots = 0;
  let hunterSkips = 0;
  let hunterHitsWolves = 0;
  let hunterHitsGood = 0;

  for (const event of state.events) {
    if (event.type === "WITCH_USED_ANTIDOTE") {
      const target = getEventSeat(state, event, "targetSeatId");
      witchSaveUses += 1;
      if (target && getCamp(target.role) === "GOOD") witchSaveGood += 1;
    }

    if (event.type === "WITCH_USED_POISON") {
      const target = getEventSeat(state, event, "targetSeatId");
      witchPoisonUses += 1;
      if (target?.role === "WEREWOLF") witchPoisonHitsWolves += 1;
      else if (target) witchPoisonHitsGood += 1;
    }

    if (event.type === "HUNTER_SHOT") {
      const target = getEventSeat(state, event, "targetSeatId");
      hunterShots += 1;
      if (target?.role === "WEREWOLF") hunterHitsWolves += 1;
      else if (target) hunterHitsGood += 1;
    }

    if (event.type === "HUNTER_SKIPPED") {
      hunterSkips += 1;
    }
  }

  const seer = state.seats.find((seat) => seat.role === "SEER");
  const seerDeathEvent = seer
    ? state.events.find((event) => event.type === "PLAYER_DIED" && readNumber(event, "seatId") === seer.seatId)
    : undefined;
  const seerChecks = state.seerChecks.length;
  const seerWolfChecks = state.seerChecks.filter((check) => check.result === "WEREWOLF").length;
  const trueSeerClaimed = Boolean(
    seer && state.roleClaims.some((claim) => claim.claimantSeatId === seer.seatId && claim.claimedRole === "SEER"),
  );

  return {
    witchSaveUses,
    witchSaveGood,
    witchPoisonUses,
    witchPoisonHitsWolves,
    witchPoisonHitsGood,
    hunterShotWindows: hunterShots + hunterSkips,
    hunterShots,
    hunterSkips,
    hunterHitsWolves,
    hunterHitsGood,
    seerChecks,
    seerWolfChecks,
    seerGoodChecks: seerChecks - seerWolfChecks,
    seerSurvivalDays: seerDeathEvent?.day ?? state.day,
    seerDied: Boolean(seer && !seer.alive),
    seerDeathReason: seer?.deathReason,
    trueSeerClaimed,
  };
}

function buildSeerDeathBuckets(games: SimulationGameStats[]): SeerDeathBucket {
  const buckets: SeerDeathBucket = {
    WOLF_KILL: 0,
    WITCH_POISON: 0,
    EXILED: 0,
    HUNTER_SHOT: 0,
    ALIVE: 0,
  };

  for (const game of games) {
    buckets[game.seerDeathReason ?? "ALIVE"] += 1;
  }

  return buckets;
}

function countByPhase(aiLogs: AiDecisionLog[]): Partial<Record<Phase, number>> {
  return aiLogs.reduce<Partial<Record<Phase, number>>>((acc, log) => {
    acc[log.phase] = (acc[log.phase] ?? 0) + 1;
    return acc;
  }, {});
}

function createRoleBuckets(): Record<Role, RoleBucket> {
  return ROLES.reduce<Record<Role, RoleBucket>>((acc, role) => {
    acc[role] = { games: 0, goodWins: 0, werewolfWins: 0 };
    return acc;
  }, {} as Record<Role, RoleBucket>);
}

function readNumber(event: GameEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function getEventSeat(state: GameState, event: GameEvent, key: string) {
  const seatId = readNumber(event, key);
  return seatId ? getSeat(state, seatId) : undefined;
}

function readTally(event: GameEvent): Array<{ targetSeatId: number; votes: number }> {
  const tally = event.payload.tally;
  if (!Array.isArray(tally)) return [];

  return tally.flatMap((item) => {
    if (!isRecord(item) || typeof item.targetSeatId !== "number" || typeof item.votes !== "number") {
      return [];
    }
    return [{ targetSeatId: item.targetSeatId, votes: item.votes }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function winBalanceStatus(summary: SimulationSummary): AcceptanceStatus {
  if (summary.completedGames !== summary.gameCount) return "fail";
  const low = Math.min(summary.winRates.GOOD, summary.winRates.WEREWOLVES);
  return low >= 0.35 ? "pass" : "warn";
}

function formatRoleBuckets(buckets: Record<Role, RoleBucket>): string[] {
  return ROLES.map((role) => {
    const bucket = buckets[role];
    return `- ${role}: ${bucket.games} games, GOOD ${bucket.goodWins}, WEREWOLVES ${bucket.werewolfWins}`;
  });
}

function formatPhaseCounts(counts: Partial<Record<Phase, number>>): string[] {
  return Object.entries(counts)
    .sort(([phaseA], [phaseB]) => phaseA.localeCompare(phaseB))
    .map(([phase, count]) => `- ${phase}: ${count}`);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}
