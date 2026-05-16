import { listModelRouteStatuses } from "@/ai/modelLlms";
import { getAiVoiceProfiles } from "@/ai/voiceProfiles";
import { getAiRoster } from "@/game/personas";
import { getMimoTtsConfig } from "@/server/mimoTts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTS_VOICE_OPTIONS = ["mimo_default", "default_zh", "default_en"] as const;

export function GET() {
  const llmRoutes = listModelRouteStatuses();
  const ttsConfig = getMimoTtsConfig();
  const voiceProfiles = getAiVoiceProfiles();

  return Response.json({
    llm: {
      providerMode: llmRoutes[0]?.providerMode ?? "mock",
      routingEnabled: llmRoutes.some((route) => route.routingEnabled),
      routes: getAiRoster().map((persona) => {
        const route = llmRoutes.find((item) => item.personaName === persona.name);
        return {
          personaId: persona.id,
          personaName: persona.name,
          routeId: route?.id,
          model: route?.resolvedModel ?? persona.modelLabel,
          defaultModel: route?.defaultModel ?? persona.modelLabel,
          connected: route?.connected ?? false,
          routingEnabled: route?.routingEnabled ?? false,
          providerMode: route?.providerMode ?? "mock",
        };
      }),
    },
    tts: {
      provider: "mimo",
      available: Boolean(ttsConfig),
      model: ttsConfig?.model ?? readOptionalEnv("MIMO_AI_TTS_MODEL") ?? readOptionalEnv("MIMO_TTS_MODEL") ?? "mimo-v2.5-tts",
      format: ttsConfig?.format ?? readOptionalEnv("MIMO_AI_TTS_FORMAT") ?? readOptionalEnv("MIMO_TTS_FORMAT") ?? "mp3",
      voices: TTS_VOICE_OPTIONS.map((voice) => ({
        value: voice,
        label: voiceLabel(voice),
      })),
      profiles: voiceProfiles.map((profile) => {
        const resolvedVoice = readOptionalEnv(profile.voiceEnvKey) ?? readOptionalEnv("MIMO_AI_TTS_VOICE") ?? profile.voice;
        return {
          id: profile.id,
          personaName: profile.personaName,
          voiceEnvKey: profile.voiceEnvKey,
          defaultVoice: profile.voice,
          resolvedVoice,
          style: profile.style,
        };
      }),
    },
  });
}

function voiceLabel(voice: string): string {
  switch (voice) {
    case "mimo_default":
      return "Mimo 默认";
    case "default_zh":
      return "中文自然";
    case "default_en":
      return "英文默认";
    default:
      return voice;
  }
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
