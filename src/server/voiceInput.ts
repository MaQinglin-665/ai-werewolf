import { z } from "zod";
import { callRoutedModelJson, parseLlmJsonOutput, type RoutedLlmResponse } from "@/ai/modelLlms";
import { buildHumanView } from "@/game/projection";
import type { GameState, HumanGameView } from "@/game/types";

export type VoiceInputMode = "speak" | "lastWords";

export type VoiceInputResult = {
  transcript: string;
  message: string;
  confidenceNote?: string;
};

export type VoiceInputRequest = {
  audio: File;
  mode: VoiceInputMode;
  game: GameState;
  durationMs?: number;
};

export type VoiceTranscriptRequest = {
  transcript: string;
  mode: VoiceInputMode;
  game: GameState;
};

const VOICE_TERMS =
  "狼人杀术语：1号、2号、3号、4号、5号、6号、7号、8号、9号、预言家、女巫、猎人、狼人、平民、查杀、金水、银水、放逐、票型、悍跳、倒钩、冲票、归票、站边、对跳。";

const RewriteSchema = z.object({
  message: z.string().min(1),
  rawTranscript: z.string().optional(),
  confidenceNote: z.string().optional(),
});

const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
];

export async function processVoiceInput({ audio, mode, game, durationMs }: VoiceInputRequest): Promise<VoiceInputResult> {
  validateVoiceInputAudio(audio, durationMs);
  const transcript = await transcribeVoiceInput(audio);
  return processVoiceInputTranscript({ transcript, mode, game });
}

export async function processVoiceInputTranscript({
  transcript,
  mode,
  game,
}: VoiceTranscriptRequest): Promise<VoiceInputResult> {
  const cleanTranscript = validateVoiceInputTranscript(transcript);
  const maxLength = 800;
  const rewritten = await rewriteVoiceInputDraft({
    transcript: cleanTranscript,
    mode,
    maxLength,
    publicContext: buildVoiceInputContext(game),
  });

  return {
    transcript: cleanTranscript,
    message: normalizeFinalMessage(rewritten.message, maxLength),
    confidenceNote: rewritten.confidenceNote,
  };
}

export function validateVoiceInputTranscript(transcript: string): string {
  const cleanTranscript = transcript.replace(/\s+/g, " ").trim();
  if (!cleanTranscript) {
    throw new VoiceInputError("语音识别结果为空，请重试。", 400);
  }

  const maxChars = readPositiveNumberEnv("VOICE_INPUT_MAX_TRANSCRIPT_CHARS", 1200);
  if (cleanTranscript.length > maxChars) {
    throw new VoiceInputError(`语音转写过长，请控制在 ${maxChars} 字以内。`, 400);
  }

  return cleanTranscript;
}

export function validateVoiceInputAudio(audio: File, durationMs?: number): void {
  const maxBytes = readPositiveNumberEnv("VOICE_INPUT_MAX_AUDIO_MB", 25) * 1024 * 1024;
  if (audio.size <= 0) {
    throw new VoiceInputError("没有收到语音文件。", 400);
  }
  if (audio.size > maxBytes) {
    throw new VoiceInputError(`语音文件过大，请控制在 ${readPositiveNumberEnv("VOICE_INPUT_MAX_AUDIO_MB", 25)}MB 内。`, 400);
  }
  if (!isAllowedAudioType(audio.type)) {
    throw new VoiceInputError("语音格式不支持，请使用浏览器录音生成的 webm 音频。", 400);
  }

  const maxSeconds = readPositiveNumberEnv("VOICE_INPUT_MAX_SECONDS", 45);
  if (durationMs !== undefined && durationMs > maxSeconds * 1000 + 500) {
    throw new VoiceInputError(`语音过长，请控制在 ${maxSeconds} 秒内。`, 400);
  }
}

async function transcribeVoiceInput(audio: File): Promise<string> {
  const mockTranscript = readOptionalEnv("VOICE_INPUT_TEST_TRANSCRIPT");
  if (process.env.NODE_ENV === "test" && mockTranscript) {
    return mockTranscript;
  }

  const provider = readOptionalEnv("VOICE_INPUT_STT_PROVIDER") ?? "openai";
  if (provider !== "openai") {
    throw new VoiceInputError("当前只支持 OpenAI 语音识别。", 503);
  }

  const apiKey = readOptionalEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new VoiceInputError("缺少 OPENAI_API_KEY，无法进行语音识别。", 503);
  }

  const form = new FormData();
  form.set("file", audio, audio.name || "voice-input.webm");
  form.set("model", readOptionalEnv("VOICE_INPUT_STT_MODEL") ?? "gpt-4o-mini-transcribe");
  form.set("language", "zh");
  form.set("response_format", "json");
  form.set("prompt", `这是一段中文狼人杀玩家发言。请准确识别数字座位和术语。${VOICE_TERMS}`);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new VoiceInputError(`语音识别失败：${response.status} ${sanitizeVoiceInputError(raw)}`, 502);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  const text =
    typeof payload === "object" && payload && "text" in payload && typeof payload.text === "string"
      ? payload.text
      : typeof payload === "string"
        ? payload
        : "";
  const transcript = text.trim();
  if (!transcript) {
    throw new VoiceInputError("语音识别结果为空，请重试。", 502);
  }
  return transcript;
}

async function rewriteVoiceInputDraft(input: {
  transcript: string;
  mode: VoiceInputMode;
  maxLength: number;
  publicContext: ReturnType<typeof buildVoiceInputContext>;
}): Promise<{ message: string; confidenceNote?: string }> {
  if (process.env.NODE_ENV === "test" && readOptionalEnv("VOICE_INPUT_REWRITE_PROVIDER") === "mock") {
    return {
      message: normalizeFinalMessage(mockRewriteTranscript(input.transcript), input.maxLength),
      confidenceNote: "mock",
    };
  }

  let rendered: RoutedLlmResponse;
  try {
    rendered = await callRoutedModelJson({
      personaName: readOptionalEnv("VOICE_INPUT_REWRITE_PERSONA") ?? "GPT",
      task: "voice",
      system:
        "你是狼人杀玩家语音发言整理器。把语音转写整理成玩家可直接发送的中文公开发言。必须保留玩家原意，不新增身份、查验、票型或结论；只删除口头禅和重复，规范座位号和狼人杀术语。只返回 JSON：{\"message\":\"...\",\"rawTranscript\":\"...\",\"confidenceNote\":\"...\"}。",
      input: {
        transcript: input.transcript,
        mode: input.mode,
        maxLength: input.maxLength,
        publicContext: input.publicContext,
      },
      maxTokens: 360,
    });
  } catch (error) {
    throw new VoiceInputError(
      `语义整理失败：${error instanceof Error ? sanitizeVoiceInputError(error.message) : "模型请求失败。"}`,
      502,
    );
  }

  const parsed = RewriteSchema.safeParse(parseLlmJsonOutput(rendered.text));
  if (!parsed.success) {
    throw new VoiceInputError("语义整理失败：模型输出格式不合法。", 502);
  }

  return {
    message: normalizeFinalMessage(parsed.data.message, input.maxLength),
    confidenceNote: parsed.data.confidenceNote,
  };
}

function buildVoiceInputContext(game: GameState): {
  day: number;
  phase: HumanGameView["phase"];
  humanSeatId: number;
  aliveSeats: Array<{ seatId: number; name: string; alive: boolean }>;
  recentSpeeches: HumanGameView["tableSummary"]["recentSpeeches"];
  voteSnapshot: HumanGameView["tableSummary"]["voteSnapshot"];
  claimBoard: HumanGameView["tableSummary"]["claimBoard"];
} {
  const view = buildHumanView(game);
  return {
    day: view.day,
    phase: view.phase,
    humanSeatId: view.humanSeatId,
    aliveSeats: view.seats.map((seat) => ({ seatId: seat.seatId, name: seat.name, alive: seat.alive })),
    recentSpeeches: view.tableSummary.recentSpeeches.slice(-6),
    voteSnapshot: view.tableSummary.voteSnapshot,
    claimBoard: view.tableSummary.claimBoard,
  };
}

function mockRewriteTranscript(transcript: string): string {
  return normalizeChineseSeatNumbers(transcript)
    .replace(/像狼先出/g, "像狼，今天可以先出")
    .replace(/先出(\d号)/g, "今天可以先出$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFinalMessage(message: string, maxLength: number): string {
  const clean = normalizeChineseSeatNumbers(message)
    .replace(/\s+/g, " ")
    .replace(/([。！？；])(?=\S)/g, "$1 ")
    .replace(/[,，]{2,}/g, "，")
    .trim();
  const withPunctuation = clean && !/[。！？]$/.test(clean) ? `${clean}。` : clean;
  return withPunctuation.slice(0, maxLength);
}

function normalizeChineseSeatNumbers(text: string): string {
  const digitMap: Record<string, string> = {
    一: "1",
    二: "2",
    两: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6",
    七: "7",
    八: "8",
    九: "9",
  };
  return text.replace(/[一二两三四五六七八九](?=号)/g, (value) => digitMap[value] ?? value);
}

function isAllowedAudioType(type: string): boolean {
  const normalized = type.toLowerCase().split(";")[0]?.trim() ?? "";
  return ALLOWED_AUDIO_TYPES.includes(normalized);
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function readPositiveNumberEnv(key: string, fallback: number): number {
  const value = Number(readOptionalEnv(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function sanitizeVoiceInputError(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
}

export class VoiceInputError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
