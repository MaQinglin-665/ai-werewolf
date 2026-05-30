import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AiCharacterRoleCard } from "@/game/types";

export type ClassTrialGptSoVitsVoiceProfileDefinition = {
  characterId: string;
  displayName: string;
  weightKey: string;
  logKey: string;
  gptWeightFile: string;
  sovitsWeightFile: string;
};

export type ResolvedClassTrialGptSoVitsVoiceProfile = ClassTrialGptSoVitsVoiceProfileDefinition & {
  gptWeightsPath: string;
  sovitsWeightsPath: string;
  refAudioPath: string;
  promptText: string;
  promptLang: "ja";
  textLang: "ja";
  mediaType: "wav";
};

export type ClassTrialVoiceProfileFs = {
  existsSync: (filePath: string) => boolean;
  readTextFile: (filePath: string) => string;
};

const SOVITS_WEIGHT_STEPS: Record<string, string> = {
  miao_mu: "2112",
  wu_qie: "8896",
  fu_chuan_dong_zi: "1968",
  jiang_zhi_dao: "5744",
  sai_lei_si_ti_ya: "2656",
  shi_shen_bai_ye: "6992",
  gao_song_deng: "2096",
};

export const CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES: ClassTrialGptSoVitsVoiceProfileDefinition[] = [
  profile("naegi", "苗木诚", "miao_mu", "miao_mu"),
  profile("kirigiri", "雾切响子", "wu_qie", "wu_qie"),
  profile("fukawa", "腐川冬子", "fu_chuan_dong_zi", "fu_chuan_dong_zi"),
  {
    characterId: "monokuma",
    displayName: "黑白熊",
    weightKey: "hei_bai_xiong_clean_denoised",
    logKey: "hei_bai_xiong_clean_denoised",
    gptWeightFile: "hei_bai_xiong_clean_denoised-e30.ckpt",
    sovitsWeightFile: "hei_bai_xiong_clean_denoised_e16_s2240.pth",
  },
  profile("enoshima", "江之岛盾子", "jiang_zhi_dao", "jiang_zhi_dao"),
  profile("celestia", "塞蕾丝缇雅", "sai_lei_si_ti_ya", "sai_lei_si_ti_ya"),
  profile("togami", "十神白夜", "shi_shen_bai_ye", "shi_shen_bai_ye"),
  profile("tomori", "高松灯", "gao_song_deng", "gao_song_deng"),
  {
    characterId: "anon",
    displayName: "千早爱音",
    weightKey: "qian_dao_ai_yin",
    logKey: "AI_voice_1",
    gptWeightFile: "qian_dao_ai_yin-e30.ckpt",
    sovitsWeightFile: "qian_dao_ai_yin_e16_s8064.pth",
  },
];

export function resolveClassTrialGptSoVitsVoiceProfile(
  roleCard: AiCharacterRoleCard | undefined,
  options: {
    root?: string;
    existsSync?: ClassTrialVoiceProfileFs["existsSync"];
    readTextFile?: ClassTrialVoiceProfileFs["readTextFile"];
  } = {},
): { available: true; profile: ResolvedClassTrialGptSoVitsVoiceProfile } | { available: false; reason: string } {
  if (roleCard?.theme !== "class-trial" || roleCard.voiceLocale !== "ja-JP") {
    return { available: false, reason: "不是学级裁判日语语音角色。" };
  }
  const definition = CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES.find((item) => item.characterId === roleCard.id);
  if (!definition) return { available: false, reason: `未配置角色语音：${roleCard.id}` };

  const root = options.root ?? readOptionalEnv("CLASS_TRIAL_GPT_SOVITS_ROOT") ?? "D:\\AI\\GPT-SoVITS";
  const fileExists = options.existsSync ?? existsSync;
  const readText = options.readTextFile ?? ((filePath: string) => readFileSync(filePath, "utf8"));
  const gptWeightsPath = path.join(root, "GPT_weights_v2Pro", definition.gptWeightFile);
  const sovitsWeightsPath = path.join(root, "SoVITS_weights_v2Pro", definition.sovitsWeightFile);
  const promptListPath = path.join(root, "logs", definition.logKey, "2-name2text.txt");

  for (const filePath of [gptWeightsPath, sovitsWeightsPath, promptListPath]) {
    if (!fileExists(filePath)) return { available: false, reason: `缺少本地语音文件：${filePath}` };
  }

  const promptLine = readText(promptListPath).split(/\r?\n/).find((line) => line.trim());
  const prompt = parsePromptLine(promptLine);
  if (!prompt) return { available: false, reason: `无法读取参考音频提示：${promptListPath}` };

  const refAudioPath = path.join(root, "logs", definition.logKey, "5-wav32k", prompt.fileName);
  if (!fileExists(refAudioPath)) return { available: false, reason: `缺少参考音频：${refAudioPath}` };

  return {
    available: true,
    profile: {
      ...definition,
      gptWeightsPath,
      sovitsWeightsPath,
      refAudioPath,
      promptText: prompt.promptText,
      promptLang: "ja",
      textLang: "ja",
      mediaType: "wav",
    },
  };
}

function profile(
  characterId: string,
  displayName: string,
  weightKey: string,
  logKey: string,
): ClassTrialGptSoVitsVoiceProfileDefinition {
  const sovitsStep = SOVITS_WEIGHT_STEPS[weightKey];
  if (!sovitsStep) throw new Error(`缺少 SoVITS 权重步数配置：${weightKey}`);
  return {
    characterId,
    displayName,
    weightKey,
    logKey,
    gptWeightFile: `${weightKey}-e30.ckpt`,
    sovitsWeightFile: `${weightKey}_e16_s${sovitsStep}.pth`,
  };
}

function parsePromptLine(line: string | undefined): { fileName: string; promptText: string } | undefined {
  if (!line) return undefined;
  const parts = line.split("\t");
  const fileName = parts[0]?.trim();
  const promptText = parts.at(-1)?.trim();
  return fileName && promptText ? { fileName, promptText } : undefined;
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}
