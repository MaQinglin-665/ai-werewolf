import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  rewriteClassTrialSpeechForJapaneseTtsWithMeta,
  type ClassTrialSpeechRewriteMode,
} from "@/ai/classTrialSpeechRewrite";
import { resolveClassTrialGptSoVitsVoiceProfile, type ResolvedClassTrialGptSoVitsVoiceProfile } from "@/ai/classTrialVoiceProfiles";
import { composeAiSpeechTtsInstruction, composeAiSpeechTtsText, getAiVoiceProfileByName } from "@/ai/voiceProfiles";
import type { AiCharacterRoleCard } from "@/game/types";
import { generateGptSoVitsTtsAudio, runGptSoVitsSynthesisExclusive, switchGptSoVitsWeights } from "@/server/gptSoVitsTts";
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

const roleCardSchema = z
  .object({
    id: z.string().min(1).max(80),
    displayName: z.string().min(1).max(40),
    theme: z.string().min(1).max(40),
    styleTags: z.array(z.string().min(1).max(40)).max(12).optional(),
    speechStyleZh: z.string().max(260).optional(),
    reasoningBias: z.string().max(260).optional(),
    voteBias: z.string().max(220).optional(),
    nightActionBias: z.string().max(220).optional(),
    asVillager: z.string().max(260).optional(),
    asWerewolf: z.string().max(260).optional(),
    pressureResponse: z.string().max(220).optional(),
    relationshipHints: z.array(z.string().min(1).max(120)).max(8).optional(),
    catchphrasePolicy: z.string().max(220).optional(),
    forbidden: z.array(z.string().min(1).max(140)).max(8).optional(),
    voiceLocale: z.string().max(16).optional(),
    voiceRewritePolicy: z.string().max(160).optional(),
  })
  .optional();

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
  roleCard: roleCardSchema,
  text: z.string().min(1).max(1000),
});

const AI_SPEECH_CACHE_DIR = path.join(process.cwd(), "public", "audio", "ai-speech");

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "AI 发言音频参数不合法。", details: parsed.error.flatten() }, { status: 400 });
  }

  const classTrialAudio = await tryGenerateClassTrialGptSoVitsAudio(parsed.data).catch(() => undefined);
  if (classTrialAudio) {
    return Response.json({
      url: classTrialAudio.url,
      voiceProfile: classTrialAudio.voiceProfile,
    });
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

async function tryGenerateClassTrialGptSoVitsAudio(value: z.infer<typeof requestSchema>): Promise<
  | {
      url: string;
      voiceProfile: { id: string; name: string; voice: string; provider: "gpt-sovits" };
    }
  | undefined
> {
  const roleCard = toAiCharacterRoleCard(value.roleCard);
  if (!roleCard) return undefined;
  const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard);
  if (!resolved.available) return undefined;

  const totalStartedAt = Date.now();
  const baseUrl = readOptionalEnv("CLASS_TRIAL_GPT_SOVITS_BASE_URL") ?? "http://127.0.0.1:9880";
  const rewriteStartedAt = Date.now();
  const rewrite = await rewriteClassTrialSpeechForJapaneseTtsWithMeta({
    sourceZh: value.text,
    roleCard,
  });
  const rewriteMs = elapsedMs(rewriteStartedAt);
  const voiceProfile = {
    id: resolved.profile.characterId,
    name: resolved.profile.displayName,
    voice: resolved.profile.weightKey,
    provider: "gpt-sovits" as const,
  };
  const cache = buildClassTrialGptSoVitsCacheEntry({
    gameId: value.gameId,
    speechKey: value.speechKey,
    speakerSeatId: value.speakerSeatId,
    baseUrl,
    profile: resolved.profile,
    textJa: rewrite.textJa,
  });

  if (existsSync(cache.filePath)) {
    logClassTrialGptSoVitsTiming({
      speechKey: value.speechKey,
      speakerSeatId: value.speakerSeatId,
      profileId: resolved.profile.characterId,
      cacheHit: true,
      rewriteMode: rewrite.mode,
      rewriteMs,
      switchMs: 0,
      switchGptMs: 0,
      switchGptSkipped: true,
      switchSovitsMs: 0,
      switchSovitsSkipped: true,
      ttsMs: 0,
      writeMs: 0,
      totalMs: elapsedMs(totalStartedAt),
    });
    return {
      url: cache.url,
      voiceProfile,
    };
  }

  await mkdir(AI_SPEECH_CACHE_DIR, { recursive: true });
  const synthesis = await runGptSoVitsSynthesisExclusive(async () => {
    const switchStartedAt = Date.now();
    const switchReport = await switchGptSoVitsWeights({
      baseUrl,
      gptWeightsPath: resolved.profile.gptWeightsPath,
      sovitsWeightsPath: resolved.profile.sovitsWeightsPath,
    });
    const switchMs = elapsedMs(switchStartedAt);
    const ttsStartedAt = Date.now();
    const audio = await generateGptSoVitsTtsAudio({
      baseUrl,
      text: rewrite.textJa,
      textLang: resolved.profile.textLang,
      refAudioPath: resolved.profile.refAudioPath,
      promptLang: resolved.profile.promptLang,
      promptText: resolved.profile.promptText,
      mediaType: resolved.profile.mediaType,
    });
    return {
      audio,
      switchReport,
      switchMs,
      ttsMs: elapsedMs(ttsStartedAt),
    };
  });
  const writeStartedAt = Date.now();
  await writeFile(cache.filePath, synthesis.audio);
  const writeMs = elapsedMs(writeStartedAt);

  logClassTrialGptSoVitsTiming({
    speechKey: value.speechKey,
    speakerSeatId: value.speakerSeatId,
    profileId: resolved.profile.characterId,
    cacheHit: false,
    rewriteMode: rewrite.mode,
    rewriteMs,
    switchMs: synthesis.switchMs,
    switchGptMs: synthesis.switchReport.gpt.durationMs,
    switchGptSkipped: synthesis.switchReport.gpt.skipped,
    switchSovitsMs: synthesis.switchReport.sovits.durationMs,
    switchSovitsSkipped: synthesis.switchReport.sovits.skipped,
    ttsMs: synthesis.ttsMs,
    writeMs,
    totalMs: elapsedMs(totalStartedAt),
  });

  return {
    url: cache.url,
    voiceProfile,
  };
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function logClassTrialGptSoVitsTiming(value: {
  speechKey: string;
  speakerSeatId: number;
  profileId: string;
  cacheHit: boolean;
  rewriteMode: ClassTrialSpeechRewriteMode;
  rewriteMs: number;
  switchMs: number;
  switchGptMs: number;
  switchGptSkipped: boolean;
  switchSovitsMs: number;
  switchSovitsSkipped: boolean;
  ttsMs: number;
  writeMs: number;
  totalMs: number;
}): void {
  console.info(`[class-trial-gpt-sovits] ${JSON.stringify(value)}`);
}

function buildClassTrialGptSoVitsCacheEntry(value: {
  gameId: string;
  speechKey: string;
  speakerSeatId: number;
  baseUrl: string;
  profile: ResolvedClassTrialGptSoVitsVoiceProfile;
  textJa: string;
}): { filePath: string; url: string } {
  const cacheParts = {
    provider: "gpt-sovits",
    baseUrl: value.baseUrl,
    profileId: value.profile.characterId,
    gptWeightsPath: value.profile.gptWeightsPath,
    sovitsWeightsPath: value.profile.sovitsWeightsPath,
    refAudioPath: value.profile.refAudioPath,
    promptText: value.profile.promptText,
    text: value.textJa,
  };
  return buildAudioCacheEntry({
    gameId: value.gameId,
    speechKey: value.speechKey,
    speakerSeatId: value.speakerSeatId,
    baseUrl: value.baseUrl,
    authHeader: "none",
    model: cacheParts.provider,
    format: value.profile.mediaType,
    voice: value.profile.weightKey,
    profileId: value.profile.characterId,
    instructions: JSON.stringify(cacheParts),
    text: value.textJa,
  });
}

function toAiCharacterRoleCard(value: z.infer<typeof roleCardSchema>): AiCharacterRoleCard | undefined {
  if (!value) return undefined;
  return {
    id: value.id,
    displayName: value.displayName,
    theme: value.theme,
    styleTags: value.styleTags ?? [],
    speechStyleZh: value.speechStyleZh ?? "",
    reasoningBias: value.reasoningBias ?? "",
    voteBias: value.voteBias ?? "",
    nightActionBias: value.nightActionBias ?? "",
    asVillager: value.asVillager ?? "",
    asWerewolf: value.asWerewolf ?? "",
    pressureResponse: value.pressureResponse ?? "",
    relationshipHints: value.relationshipHints ?? [],
    catchphrasePolicy: value.catchphrasePolicy ?? "",
    forbidden: value.forbidden ?? [],
    voiceLocale: value.voiceLocale,
    voiceRewritePolicy: value.voiceRewritePolicy,
  };
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
