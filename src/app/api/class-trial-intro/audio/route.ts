import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveClassTrialGptSoVitsVoiceProfile } from "@/ai/classTrialVoiceProfiles";
import type { AiCharacterRoleCard } from "@/game/types";
import { generateGptSoVitsTtsAudio, runGptSoVitsSynthesisExclusive, switchGptSoVitsWeights } from "@/server/gptSoVitsTts";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTRO_CHARACTER_IDS = [
  "anon",
  "tomori",
  "togami",
  "celestia",
  "enoshima",
  "monokuma",
  "fukawa",
  "kirigiri",
  "naegi",
] as const;

type ClassTrialIntroCharacterId = (typeof INTRO_CHARACTER_IDS)[number];
type GeneratedClassTrialIntroCharacterId = Exclude<ClassTrialIntroCharacterId, "anon" | "tomori">;

const requestSchema = z.object({
  characterId: z.enum(INTRO_CHARACTER_IDS),
});

const EXTERNAL_AUDIO_CHARACTER_IDS = new Set<ClassTrialIntroCharacterId>(["anon", "tomori"]);
const INTRO_AUDIO_DIR = path.join(process.cwd(), "local-assets", "class-trial-pack", "intro", "audio");
const INTRO_URL_PREFIX = "/class-trial-pack/intro/audio";

const GENERATED_INTRO_ENTRIES: Record<
  GeneratedClassTrialIntroCharacterId,
  {
    displayName: string;
    textJa: string;
  }
> = {
  togami: {
    displayName: "十神白夜",
    textJa: "俺が導いてやる。",
  },
  celestia: {
    displayName: "塞蕾丝缇雅",
    textJa: "わたくしはセレスティア・ルーデンベルクですわ。",
  },
  enoshima: {
    displayName: "江之岛盾子",
    textJa: "絶望的に飽きちゃった。",
  },
  monokuma: {
    displayName: "黑白熊",
    textJa: "うぷぷぷぷ。",
  },
  fukawa: {
    displayName: "腐川冬子",
    textJa: "どうせ私なんて...",
  },
  kirigiri: {
    displayName: "雾切响子",
    textJa: "ここまで言えば分かるわね?",
  },
  naegi: {
    displayName: "苗木诚",
    textJa: "それは違うよ!",
  },
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "开场片头音频参数不合法。", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const characterId = parsed.data.characterId;
  if (EXTERNAL_AUDIO_CHARACTER_IDS.has(characterId)) {
    return Response.json(
      { error: "这个开场片头角色需要使用本地截取音频，不能通过 GPT-SoVITS 生成。" },
      { status: 409 },
    );
  }

  const entry = GENERATED_INTRO_ENTRIES[characterId as GeneratedClassTrialIntroCharacterId];
  const filePath = resolveClassTrialIntroAudioPath(characterId);
  if (!entry || !filePath) {
    return Response.json({ error: "开场片头音频参数不合法。", details: { characterId } }, { status: 400 });
  }

  const url = `${INTRO_URL_PREFIX}/${characterId}.wav`;
  if (existsSync(filePath)) {
    return Response.json({ url, cached: true });
  }

  const roleCard = buildIntroRoleCard(characterId as GeneratedClassTrialIntroCharacterId, entry.displayName);
  const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard);
  if (!resolved.available) {
    return Response.json({ error: resolved.reason }, { status: 503 });
  }

  const baseUrl = readOptionalEnv("CLASS_TRIAL_GPT_SOVITS_BASE_URL") ?? "http://127.0.0.1:9880";
  try {
    const audio = await runGptSoVitsSynthesisExclusive(async () => {
      await switchGptSoVitsWeights({
        baseUrl,
        gptWeightsPath: resolved.profile.gptWeightsPath,
        sovitsWeightsPath: resolved.profile.sovitsWeightsPath,
      });
      return generateGptSoVitsTtsAudio({
        baseUrl,
        text: entry.textJa,
        textLang: resolved.profile.textLang,
        refAudioPath: resolved.profile.refAudioPath,
        promptLang: resolved.profile.promptLang,
        promptText: resolved.profile.promptText,
        mediaType: resolved.profile.mediaType,
      });
    });

    await mkdir(INTRO_AUDIO_DIR, { recursive: true });
    await writeFile(filePath, audio);
    return Response.json({ url, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "开场片头音频生成失败。";
    return Response.json({ error: `开场片头音频生成失败：${message}` }, { status: 502 });
  }
}

export function resolveClassTrialIntroAudioPath(characterId: string): string | undefined {
  if (!isKnownIntroCharacterId(characterId)) return undefined;
  if (!/^[a-z0-9_-]+$/.test(characterId)) return undefined;

  const filePath = path.join(INTRO_AUDIO_DIR, `${characterId}.wav`);
  const relative = path.relative(INTRO_AUDIO_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return filePath;
}

function isKnownIntroCharacterId(value: string): value is ClassTrialIntroCharacterId {
  return (INTRO_CHARACTER_IDS as readonly string[]).includes(value);
}

function buildIntroRoleCard(characterId: GeneratedClassTrialIntroCharacterId, displayName: string): AiCharacterRoleCard {
  return {
    id: characterId,
    displayName,
    theme: "class-trial",
    styleTags: [],
    speechStyleZh: "",
    reasoningBias: "",
    voteBias: "",
    nightActionBias: "",
    asVillager: "",
    asWerewolf: "",
    pressureResponse: "",
    relationshipHints: [],
    catchphrasePolicy: "",
    forbidden: [],
    voiceLocale: "ja-JP",
    voiceRewritePolicy: "",
  };
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}
