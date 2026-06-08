import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createGame } from "../game/engine";
import { advanceOneAiStep, createConfiguredAiOptions } from "./mockAgent";
import type { AiDecisionLog } from "./types";
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

type D2SpeechReportSpeech = {
  day: number;
  seatId: number;
  name: string;
  role: string;
  provider: string;
  isFallback: boolean;
  validationErrors: string[];
  text: string;
};

type D2SpeechReport = {
  generatedAt: string;
  result: {
    phase: string;
    day: number;
    winner?: string;
    reason?: string;
    durationMs: number;
    aiLogs: number;
    fallback: number;
    speechFallback: number;
    d2SpeechFallback: number;
  };
  finalSeats: SpeechReportSeat[];
  speeches: D2SpeechReportSpeech[];
};

type D2SpeechLog = AiDecisionLog & {
  output: Extract<AiDecisionLog["output"], { type: "speak" }>;
};

function isD2SpeechLog(log: AiDecisionLog): log is D2SpeechLog {
  return log.output.type === "speak";
}

describe("class-trial Mimo D2 speech sample", () => {
  test(
    "writes a D2 speech report",
    async () => {
      const timestamp = Date.now();
      const outJson = path.join(root, "tmp", `class-trial-mimo-d2-speeches-${timestamp}.json`);
      const outMd = path.join(root, "tmp", `class-trial-mimo-d2-speeches-${timestamp}.md`);
      const maxSteps = Number(process.env.CLASS_TRIAL_D2_MAX_STEPS ?? 160);
      const personasRaw = await fs.readFile(path.join(root, "local-assets", "class-trial-pack", "personas.json"), "utf8");
      const personas = sanitizeClassTrialPersonas(JSON.parse(personasRaw));
      const aiFriends = buildClassTrialAiFriends(personas, new Date().toISOString());
      const providers = createConfiguredAiOptions();
      let state = createGame({
        boardId: CLASS_TRIAL_DEFAULT_BOARD_ID,
        humanSeatId: null,
        seed: process.env.CLASS_TRIAL_D2_SEED ?? "mimo-d2-2026-06-05",
        aiFriends,
        seatRoleOverrides: CLASS_TRIAL_FIXED_SEAT_ROLES,
      });
      const aiLogs: AiDecisionLog[] = [];
      const startedAt = Date.now();
      let sawD2Speech = false;

      for (let step = 0; step < maxSteps; step += 1) {
        if (state.result || state.phase === "GAME_OVER") break;
        if (sawD2Speech && !(state.day === 2 && state.phase === "DAY_SPEECH")) break;
        const advanced = await advanceOneAiStep(state, {
          actionProvider: providers.actionProvider,
          speechProvider: providers.speechProvider,
        });
        state = advanced.state;
        aiLogs.push(...advanced.aiLogs);
        if (advanced.aiLogs.some((log) => log.day === 2 && log.output?.type === "speak")) sawD2Speech = true;
      }

      const speeches = aiLogs
        .filter(isD2SpeechLog)
        .map((log) => ({
          day: log.day,
          seatId: log.seatNumber,
          name: state.seats.find((seat) => seat.seatId === log.seatNumber)?.name ?? `seat-${log.seatNumber}`,
          role: state.seats.find((seat) => seat.seatId === log.seatNumber)?.role ?? "UNKNOWN",
          provider: log.provider,
          isFallback: Boolean(log.isFallback),
          validationErrors: log.validationErrors ?? [],
          text: log.output.message,
          rawOutput: log.rawOutput,
          speechPlan: log.speechPlan,
        }));
      const d2Speeches = speeches.filter((speech) => speech.day === 2);
      const report = {
        generatedAt: new Date().toISOString(),
        outJson: path.relative(root, outJson).replaceAll("\\", "/"),
        outMd: path.relative(root, outMd).replaceAll("\\", "/"),
        options: {
          maxSteps,
          seed: process.env.CLASS_TRIAL_D2_SEED ?? "mimo-d2-2026-06-05",
          boardId: CLASS_TRIAL_DEFAULT_BOARD_ID,
          brainPersonaIds: [...new Set(aiFriends.map((friend) => friend.basePersonaId))],
        },
        result: {
          phase: state.phase,
          day: state.day,
          winner: state.result?.winner,
          reason: state.result?.reason,
          durationMs: Date.now() - startedAt,
          aiLogs: aiLogs.length,
          speeches: speeches.length,
          d2Speeches: d2Speeches.length,
          fallback: aiLogs.filter((log) => log.isFallback).length,
          speechFallback: speeches.filter((speech) => speech.isFallback).length,
          d2SpeechFallback: d2Speeches.filter((speech) => speech.isFallback).length,
          providerCounts: countBy(aiLogs.map((log) => log.provider)),
        },
        finalSeats: state.seats.map((seat) => ({
          seatId: seat.seatId,
          name: seat.name,
          role: seat.role,
          alive: seat.alive,
        })),
        speeches,
      };

      await fs.writeFile(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await fs.writeFile(outMd, formatMarkdown(report), "utf8");
      console.log(JSON.stringify({ outJson: report.outJson, outMd: report.outMd, result: report.result }, null, 2));

      expect(d2Speeches.length).toBeGreaterThan(0);
    },
    900_000,
  );
});

function countBy(values: Array<string | undefined>) {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value ?? "unknown"] = (counts[value ?? "unknown"] ?? 0) + 1;
  }
  return counts;
}

function formatMarkdown(report: D2SpeechReport) {
  const lines = [
    "# Class Trial Mimo D2 Speeches",
    "",
    `generatedAt: ${report.generatedAt}`,
    `phase: ${report.result.phase}`,
    `day: ${report.result.day}`,
    `winner: ${report.result.winner ?? "none"}`,
    `reason: ${report.result.reason ?? "none"}`,
    `durationMs: ${report.result.durationMs}`,
    `aiLogs: ${report.result.aiLogs}`,
    `fallback: ${report.result.fallback}`,
    `speechFallback: ${report.result.speechFallback}`,
    `d2SpeechFallback: ${report.result.d2SpeechFallback}`,
    "",
    "## Final Seats",
    "",
    ...report.finalSeats.map((seat) => `- ${seat.seatId}号 ${seat.name} / ${seat.role} / ${seat.alive ? "alive" : "dead"}`),
    "",
    "## D2 Speeches",
    "",
  ];

  const d2Speeches = report.speeches.filter((speech) => speech.day === 2);
  if (d2Speeches.length === 0) {
    lines.push("_No D2 speeches reached._", "");
  }
  for (const speech of d2Speeches) {
    lines.push(
      `### D2 ${speech.seatId}号 ${speech.name} / ${speech.role}`,
      "",
      `provider: ${speech.provider}`,
      `fallback: ${speech.isFallback}`,
      speech.validationErrors.length ? `validationErrors: ${speech.validationErrors.join("；")}` : "validationErrors: none",
      "",
      speech.text,
      "",
    );
  }

  lines.push("## All Speeches", "");
  for (const speech of report.speeches) {
    lines.push(
      `### D${speech.day} ${speech.seatId}号 ${speech.name} / ${speech.role}`,
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
