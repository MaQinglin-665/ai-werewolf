import type { ClassTrialIntroCharacter, ClassTrialIntroConfig } from "./classTrialIntro";

export type ClassTrialIntroAudioPreparation = {
  ready: boolean;
  message: string;
  readyCharacterIds: ClassTrialIntroCharacter["id"][];
  failedCharacterIds: ClassTrialIntroCharacter["id"][];
};

type PrepareClassTrialIntroAudioOptions = {
  fetcher?: typeof fetch;
};

const GENERATE_CLASS_TRIAL_INTRO_AUDIO_PATH = "/api/class-trial-intro/audio";

export async function prepareClassTrialIntroAudio(
  config: ClassTrialIntroConfig | undefined,
  options: PrepareClassTrialIntroAudioOptions = {},
): Promise<ClassTrialIntroAudioPreparation> {
  if (!config) {
    return {
      ready: false,
      message: "未找到开场片头配置。",
      readyCharacterIds: [],
      failedCharacterIds: [],
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const readyCharacterIds: ClassTrialIntroCharacter["id"][] = [];
  const failedCharacterIds: ClassTrialIntroCharacter["id"][] = [];

  for (const character of config.characters) {
    const audioReady = await isAudioReachable(fetcher, character.audioUrl);

    if (audioReady) {
      readyCharacterIds.push(character.id);
      continue;
    }

    if (character.audioMode !== "generated") {
      failedCharacterIds.push(character.id);
      continue;
    }

    const generated = await generateIntroAudio(fetcher, character.id);
    const generatedAudioReady = generated ? await isAudioReachable(fetcher, character.audioUrl) : false;

    if (generatedAudioReady) {
      readyCharacterIds.push(character.id);
    } else {
      failedCharacterIds.push(character.id);
    }
  }

  return {
    ready: failedCharacterIds.length === 0,
    message:
      failedCharacterIds.length === 0
        ? "开场片头音频已就绪。"
        : `开场片头音频缺少 ${failedCharacterIds.length} 个角色。`,
    readyCharacterIds,
    failedCharacterIds,
  };
}

async function isAudioReachable(fetcher: typeof fetch, audioUrl: string): Promise<boolean> {
  try {
    const response = await fetcher(audioUrl, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function generateIntroAudio(
  fetcher: typeof fetch,
  characterId: ClassTrialIntroCharacter["id"],
): Promise<boolean> {
  try {
    const response = await fetcher(GENERATE_CLASS_TRIAL_INTRO_AUDIO_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
