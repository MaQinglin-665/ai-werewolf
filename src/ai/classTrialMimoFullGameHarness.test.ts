import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createGame } from "../game/engine";
import { advanceWithMockAi, createConfiguredAiOptions } from "./mockAgent";
import {
  buildClassTrialAiFriends,
  CLASS_TRIAL_DEFAULT_BOARD_ID,
  CLASS_TRIAL_FIXED_SEAT_ROLES,
  sanitizeClassTrialPersonas,
} from "../components/game/classTrialTheme";

const root = path.resolve(__dirname, "../..");

type SpeechReportSeat = {
  seatId: number;
  name: string;
  role: string;
  alive: boolean;
};

type FullGameSpeechReportSpeech = {
  day: number;
  phase: string;
  seatId: number;
  name: string;
  role: string;
  provider: string;
  isFallback: boolean;
  validationErrors: string[];
  text: string;
};

type FullGameSpeechReport = {
  generatedAt: string;
  result: {
    completed: boolean;
    phase: string;
    day: number;
    winner?: string;
    reason?: string;
    durationMs: number;
    aiLogs: number;
    fallback: number;
    speechFallback: number;
    actionFallback: number;
    providerCounts: Record<string, number>;
  };
  finalSeats: SpeechReportSeat[];
  speeches: FullGameSpeechReportSpeech[];
};

describe("class-trial Mimo full-game speech sample", () => {
  test(
    "writes a full-game speech report",
    async () => {
      const timestamp = Date.now();
      const outJson = path.join(root, "tmp", `class-trial-mimo-full-game-${timestamp}.json`);
      const outMd = path.join(root, "tmp", `class-trial-mimo-full-game-${timestamp}.md`);
      const maxSteps = Number(process.env.CLASS_TRIAL_FULL_GAME_MAX_STEPS ?? 320);
      const personasRaw = await fs.readFile(path.join(root, "local-assets", "class-trial-pack", "personas.json"), "utf8");
      const personas = sanitizeClassTrialPersonas(JSON.parse(personasRaw));
      const aiFriends = buildClassTrialAiFriends(personas, new Date().toISOString());
      const providers = createConfiguredAiOptions();
      const state = createGame({
        boardId: CLASS_TRIAL_DEFAULT_BOARD_ID,
        humanSeatId: null,
        seed: process.env.CLASS_TRIAL_FULL_GAME_SEED ?? "mimo-full-game-2026-06-06",
        aiFriends,
        seatRoleOverrides: CLASS_TRIAL_FIXED_SEAT_ROLES,
      });
      const startedAt = Date.now();
      const advanced = await advanceWithMockAi(state, {
        ignoreHuman: true,
        maxSteps,
        actionProvider: providers.actionProvider,
        speechProvider: providers.speechProvider,
      });
      const finalState = advanced.state;
      const aiLogs = advanced.aiLogs;
      const isSpeechLog = (log: (typeof aiLogs)[number]) =>
        log.output?.type === "speak" || log.output?.type === "lastWords" || log.output?.type === "sheriffSpeech";
      const speeches = aiLogs
        .filter(isSpeechLog)
        .map((log) => ({
          day: log.day,
          phase: log.phase,
          seatId: log.seatNumber,
          name: finalState.seats.find((seat) => seat.seatId === log.seatNumber)?.name ?? `seat-${log.seatNumber}`,
          role: finalState.seats.find((seat) => seat.seatId === log.seatNumber)?.role ?? "UNKNOWN",
          provider: log.provider,
          isFallback: Boolean(log.isFallback),
          validationErrors: log.validationErrors ?? [],
          text: "message" in log.output ? log.output.message : "",
          rawOutput: log.rawOutput,
          speechPlan: log.speechPlan,
        }));
      const actions = aiLogs
        .filter((log) => !isSpeechLog(log))
        .map((log) => ({
          day: log.day,
          phase: log.phase,
          seatId: log.seatNumber,
          name: finalState.seats.find((seat) => seat.seatId === log.seatNumber)?.name ?? `seat-${log.seatNumber}`,
          provider: log.provider,
          isFallback: Boolean(log.isFallback),
          validationErrors: log.validationErrors ?? [],
          command: log.output,
          rawOutput: log.rawOutput,
        }));
      const report = {
        generatedAt: new Date().toISOString(),
        outJson: path.relative(root, outJson).replaceAll("\\", "/"),
        outMd: path.relative(root, outMd).replaceAll("\\", "/"),
        options: {
          maxSteps,
          seed: process.env.CLASS_TRIAL_FULL_GAME_SEED ?? "mimo-full-game-2026-06-06",
          boardId: CLASS_TRIAL_DEFAULT_BOARD_ID,
          brainPersonaIds: [...new Set(aiFriends.map((friend) => friend.basePersonaId))],
        },
        result: {
          completed: finalState.phase === "GAME_OVER" || Boolean(finalState.result),
          phase: finalState.phase,
          day: finalState.day,
          winner: finalState.result?.winner,
          reason: finalState.result?.reason,
          durationMs: Date.now() - startedAt,
          aiLogs: aiLogs.length,
          speeches: speeches.length,
          actions: actions.length,
          fallback: aiLogs.filter((log) => log.isFallback).length,
          speechFallback: speeches.filter((speech) => speech.isFallback).length,
          actionFallback: actions.filter((action) => action.isFallback).length,
          speechFallbackByDay: countBy(speeches.filter((speech) => speech.isFallback).map((speech) => `D${speech.day}`)),
          providerCounts: countBy(aiLogs.map((log) => log.provider)),
          fallbackByProvider: countBy(aiLogs.filter((log) => log.isFallback).map((log) => log.provider)),
        },
        finalSeats: finalState.seats.map((seat) => ({
          seatId: seat.seatId,
          name: seat.name,
          role: seat.role,
          alive: seat.alive,
        })),
        speeches,
        actions,
      };

      await fs.writeFile(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await fs.writeFile(outMd, formatMarkdown(report), "utf8");
      console.log(JSON.stringify({ outJson: report.outJson, outMd: report.outMd, result: report.result }, null, 2));

      expect(report.result.completed).toBe(true);
      expect(speeches.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});

function countBy(values: Array<string | undefined>) {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value ?? "unknown"] = (counts[value ?? "unknown"] ?? 0) + 1;
  }
  return counts;
}

function formatMarkdown(report: FullGameSpeechReport) {
  const lines = [
    "# Class Trial Mimo Full Game",
    "",
    `generatedAt: ${report.generatedAt}`,
    `completed: ${report.result.completed}`,
    `phase: ${report.result.phase}`,
    `day: ${report.result.day}`,
    `winner: ${report.result.winner ?? "none"}`,
    `reason: ${report.result.reason ?? "none"}`,
    `durationMs: ${report.result.durationMs}`,
    `aiLogs: ${report.result.aiLogs}`,
    `fallback: ${report.result.fallback}`,
    `speechFallback: ${report.result.speechFallback}`,
    `actionFallback: ${report.result.actionFallback}`,
    "",
    "## Provider Counts",
    "",
    ...Object.entries(report.result.providerCounts).map(([provider, count]) => `- ${provider}: ${count}`),
    "",
    "## Final Seats",
    "",
    ...report.finalSeats.map((seat) => `- ${seat.seatId}号 ${seat.name} / ${seat.role} / ${seat.alive ? "alive" : "dead"}`),
    "",
    "## Speeches",
    "",
  ];

  for (const speech of report.speeches) {
    lines.push(
      `### D${speech.day} ${speech.seatId}号 ${speech.name} / ${speech.role} / ${speech.phase}`,
      "",
      `provider: ${speech.provider}`,
      `fallback: ${speech.isFallback}`,
      speech.validationErrors.length ? `validationErrors: ${speech.validationErrors.join("；")}` : "validationErrors: none",
      "",
      speech.text,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}
