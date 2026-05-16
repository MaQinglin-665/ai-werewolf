import { describe, expect, it } from "vitest";
import { buildSimulationHealthReport, formatSimulationHealthReport } from "./simulationHealth";
import { evaluateSimulationAcceptance, runMockGameSimulation } from "./simulationStats";

describe("simulation stats", () => {
  it("summarizes a deterministic mock AI batch", async () => {
    const summary = await runMockGameSimulation({ gameCount: 25, seedStart: 2000, maxSteps: 500 });
    const checks = evaluateSimulationAcceptance(summary);
    const health = buildSimulationHealthReport(summary);

    expect(summary.completedGames).toBe(25);
    expect(summary.winners.GOOD + summary.winners.WEREWOLVES).toBe(25);
    expect(summary.averageDays).toBeGreaterThan(0);
    expect(summary.totalVotes).toBeGreaterThan(0);
    expect(summary.reasonedVotes).toBeGreaterThan(0);
    expect(summary.publicLogicVoteRate).toBeGreaterThanOrEqual(0);
    expect(summary.firstExiles).toBeGreaterThan(0);
    expect(summary.firstExileWolves + summary.firstExileGood).toBe(summary.firstExiles);
    expect(summary.phaseActionCounts.DAY_VOTE).toBeGreaterThan(0);
    expect(summary.seerChecks).toBeGreaterThan(0);
    expect(summary.trueSeerClaimGames).toBeGreaterThanOrEqual(summary.seerClaimedByDay2Games);
    expect(summary.seerGoldPublicRate).toBeGreaterThanOrEqual(0);
    expect(summary.averageSeerSurvivalDays).toBeGreaterThan(0);
    expect(Object.values(summary.seerDeathsByReason).reduce((total, count) => total + count, 0)).toBe(25);
    expect(summary.witchSaveUses + summary.witchPoisonUses).toBeGreaterThan(0);
    expect(summary.hunterShotWindows).toBe(summary.hunterShots + summary.hunterSkips);
    expect(summary.fragmentedVoteRounds).toBeGreaterThanOrEqual(0);
    expect(health.outcome.completedGames).toBe(25);
    expect(formatSimulationHealthReport(health)).toContain("simulation health report");
    expect(checks.filter((check) => check.status === "fail")).toEqual([]);
  }, 20000);

  it("runs the 12-player sheriff board through mock AI", async () => {
    const summary = await runMockGameSimulation({
      boardId: "12p-sheriff-seer-witch-hunter-guard",
      gameCount: 3,
      seedStart: 2200,
      maxSteps: 700,
    });

    expect(summary.completedGames).toBe(3);
    expect(summary.phaseActionCounts.NIGHT_GUARD).toBeGreaterThan(0);
    expect(summary.phaseActionCounts.SHERIFF_NOMINATION).toBeGreaterThan(0);
    expect(summary.guardProtectUses).toBeGreaterThanOrEqual(summary.guardBlocks);
  }, 20000);
});
