import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { composeAiSpeechTtsInstruction, composeAiSpeechTtsText, getAiVoiceProfileByName } from "@/ai/voiceProfiles";
import {
  buildMimoChatCompletionsUrl,
  generateMimoTtsAudio,
  getMimoTtsConfig,
  sanitizeTtsError,
  type MimoTtsConfig,
} from "@/server/mimoTts";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  gameId: z.string().min(1).max(100),
  speechKey: z.string().min(1).max(160),
  speakerSeatId: z.number().int().min(1).max(20),
  speakerName: z.string().min(1).max(20),
  ttsVoice: z.string().min(1).max(80).optional(),
  ttsConfig: z
    .object({
      provider: z.literal("mimo-compatible"),
      label: z.string().min(1).max(40).optional(),
      baseUrl: z.string().min(1).max(260),
      model: z.string().min(1).max(120),
      voice: z.string().min(1).max(80),
      format: z.string().min(1).max(16).optional(),
      authHeader: z.string().min(1).max(80).optional(),
      apiKey: z.string().min(1).max(4096).optional(),
    })
    .optional(),
  text: z.string().min(1).max(1000),
});

const AI_SPEECH_CACHE_DIR = path.join(process.cwd(), "public", "audio", "ai-speech");

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "AI 发言音频参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  const profile = getAiVoiceProfileByName(parsed.data.speakerName);
  const config = buildRuntimeMimoTtsConfig(parsed.data.ttsConfig) ?? getMimoTtsConfig();
  if (!config) {
    return Response.json({ error: "缺少这个 AI 的 TTS API Key，无法生成 AI 发言音频。" }, { status: 503 });
  }

  const primaryVoice =
    parsed.data.ttsConfig?.voice ??
    parsed.data.ttsVoice ??
    readOptionalEnv(profile.voiceEnvKey) ??
    readOptionalEnv("MIMO_AI_TTS_VOICE") ??
    profile.voice;
  const voiceCandidates = uniqueValues([primaryVoice, readOptionalEnv("MIMO_AI_TTS_FALLBACK_VOICE"), "mimo_default"]);
  const ttsText = composeAiSpeechTtsText(parsed.data.text, profile);
  const ttsInstructions = composeAiSpeechTtsInstruction(profile);

  for (const voice of voiceCandidates) {
    const cache = buildAudioCacheEntry({
      gameId: parsed.data.gameId,
      speechKey: parsed.data.speechKey,
      speakerSeatId: parsed.data.speakerSeatId,
      baseUrl: config.baseUrl,
      authHeader: config.authHeader,
      model: config.model,
      format: config.format,
      voice,
      profileId: profile.id,
      instructions: ttsInstructions,
      text: ttsText,
    });
    if (existsSync(cache.filePath)) {
      return Response.json({
        url: cache.url,
        voiceProfile: {
          id: profile.id,
          name: profile.personaName,
          voice,
        },
      });
    }
  }

  let lastError: unknown;
  try {
    await mkdir(AI_SPEECH_CACHE_DIR, { recursive: true });
    for (const voice of voiceCandidates) {
      const cache = buildAudioCacheEntry({
        gameId: parsed.data.gameId,
        speechKey: parsed.data.speechKey,
        speakerSeatId: parsed.data.speakerSeatId,
        baseUrl: config.baseUrl,
        authHeader: config.authHeader,
        model: config.model,
        format: config.format,
        voice,
        profileId: profile.id,
        instructions: ttsInstructions,
        text: ttsText,
      });
      try {
        const audio = await generateMimoTtsAudio({ text: ttsText, voice, config, instructions: ttsInstructions });
        await writeFile(cache.filePath, audio);
        return Response.json({
          url: cache.url,
          voiceProfile: {
            id: profile.id,
            name: profile.personaName,
            voice,
          },
        });
      } catch (error) {
        lastError = error;
      }
    }
  } catch (error) {
    lastError = error;
  }

  const message = lastError instanceof Error ? sanitizeTtsError(lastError.message) : "AI 发言音频生成失败。";
  return Response.json({ error: message }, { status: 502 });
}

function buildAudioCacheEntry(value: {
  gameId: string;
  speechKey: string;
  speakerSeatId: number;
  baseUrl: string;
  authHeader: string;
  model: string;
  format: string;
  voice: string;
  profileId: string;
  instructions: string;
  text: string;
}): { filePath: string; url: string } {
  const fileName = `${value.profileId}-${hashAudioRequest({
    gameId: value.gameId,
    speechKey: value.speechKey,
    speakerSeatId: String(value.speakerSeatId),
    baseUrl: value.baseUrl,
    authHeader: value.authHeader,
    model: value.model,
    format: value.format,
    voice: value.voice,
    profileId: value.profileId,
    instructions: value.instructions,
    text: value.text,
  })}.${value.format}`;
  return {
    filePath: path.join(AI_SPEECH_CACHE_DIR, fileName),
    url: `/audio/ai-speech/${fileName}`,
  };
}

function hashAudioRequest(value: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function buildRuntimeMimoTtsConfig(value: z.infer<typeof requestSchema>["ttsConfig"]): MimoTtsConfig | undefined {
  const apiKey = value?.apiKey?.trim();
  if (!value || !apiKey) return undefined;
  const baseUrl = value.baseUrl.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  const authHeader = sanitizeAuthHeader(value.authHeader) ?? (baseUrl.includes("cxsee") ? "api-key" : "Authorization");
  return {
    apiKey,
    authHeader,
    baseUrl,
    endpoint: buildMimoChatCompletionsUrl(baseUrl),
    format: sanitizeTtsFormat(value.format) ?? "mp3",
    model: value.model.trim(),
  };
}

function sanitizeTtsFormat(value: string | undefined): string | undefined {
  const clean = value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return clean || undefined;
}

function sanitizeAuthHeader(value: string | undefined): string | undefined {
  const clean = value?.trim().slice(0, 80);
  return clean && /^[A-Za-z0-9-]+$/.test(clean) ? clean : undefined;
}
