# Class Trial GPT-SoVITS Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect local-only class-trial AI speech playback to the local GPT-SoVITS `api_v2.py` service, keeping on-screen text Chinese while playing per-character Japanese voice.

**Architecture:** Keep the existing Chinese speech generation and frontend playback loop. Add a narrow server-side GPT-SoVITS adapter plus class-trial voice-profile and Japanese-rewrite helpers, then let `/api/ai-speech-audio` prefer that path only for class-trial `ja-JP` role cards and fall back to the existing Mimo Chinese TTS path.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vitest, Node `Buffer`, local GPT-SoVITS FastAPI `api_v2.py`, existing routed LLM helpers, existing browser AI speech playback.

---

## File Structure

- `src/components/game/clientTypes.ts`: extend the browser TTS cue with optional `roleCard`.
- `src/components/game/aiSpeechAudio.ts`: read `roleCard` from the speaking seat and include it in `AiSpeechAudioCue`.
- `src/components/game/aiSpeechAudio.test.ts`: protect role-card propagation.
- `src/components/GameClient.tsx`: include `roleCard` in the `/api/ai-speech-audio` request body.
- `src/server/gptSoVitsTts.ts`: GPT-SoVITS transport helper for weight switching, `/tts`, audio parsing, and error sanitizing.
- `src/server/gptSoVitsTts.test.ts`: transport helper tests with a fake fetch.
- `src/ai/classTrialVoiceProfiles.ts`: map class-trial role cards to local weight/reference/prompt paths.
- `src/ai/classTrialVoiceProfiles.test.ts`: resolver tests for all 9 roles and unavailable states.
- `src/ai/classTrialSpeechRewrite.ts`: temporary Chinese-to-Japanese TTS rewrite helper.
- `src/ai/classTrialSpeechRewrite.test.ts`: rewrite parsing and failure tests.
- `src/app/api/ai-speech-audio/route.ts`: prefer GPT-SoVITS for class-trial `ja-JP`, preserve Mimo fallback.
- `src/app/api/ai-speech-audio/route.test.ts`: route-level provider selection and fallback tests.
- `docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`: task card and completion evidence.
- `feature_list.json`, `progress.md`, `session-handoff.md`: state and handoff updates after implementation.

## Task 1: Propagate Class-Trial Role Card To Speech Audio Requests

**Files:**
- Modify: `src/components/game/clientTypes.ts`
- Modify: `src/components/game/aiSpeechAudio.ts`
- Modify: `src/components/game/aiSpeechAudio.test.ts`
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Write the failing role-card propagation test**

Add this test to `src/components/game/aiSpeechAudio.test.ts`:

```ts
it("includes the speaker role card in the AI speech audio cue", () => {
  const roleCard = {
    id: "tomori",
    displayName: "高松灯",
    theme: "class-trial",
    styleTags: ["sensitive"],
    speechStyleZh: "短句偏多。",
    reasoningBias: "关注发言变化。",
    voteBias: "谨慎投票。",
    nightActionBias: "谨慎行动。",
    asVillager: "按公开信息找狼。",
    asWerewolf: "用公开理由伪装。",
    pressureResponse: "先停顿，再解释。",
    relationshipHints: [],
    catchphrasePolicy: "允许极短犹豫。",
    forbidden: ["不能泄露隐藏身份。"],
    voiceProfileId: "tomori-ja-local",
    voiceLocale: "ja-JP",
    voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
  };
  const speech = speechItem({ seq: 4, speakerSeatId: 8, message: "我觉得3号前后变化有点大。" });
  const game = gameView({
    seats: [
      seat(1, true),
      { ...seat(8, false), name: "高松灯", personaName: "Gemini", roleCard },
    ],
    recentSpeeches: [speech],
  });

  expect(buildAiSpeechAudioCue(game, new Set(), undefined)?.speech.message).toBe("我觉得3号前后变化有点大。");
  expect(buildAiSpeechAudioCue(game, new Set(), undefined)?.roleCard).toEqual(roleCard);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts
```

Expected: FAIL because `AiSpeechAudioCue` does not yet expose `roleCard`.

- [ ] **Step 3: Extend cue types and helper implementation**

In `src/components/game/clientTypes.ts`, change `AiSpeechAudioTextCue` to include the role card:

```ts
export type AiSpeechAudioTextCue = {
  gameId: string;
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
  roleCard?: HumanGameView["seats"][number]["roleCard"];
  text: string;
};
```

In `src/components/game/aiSpeechAudio.ts`, add the field to `AiSpeechAudioCue`:

```ts
export type AiSpeechAudioCue = {
  key: string;
  gameId: string;
  speech: SpeechItem;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
  roleCard?: HumanGameView["seats"][number]["roleCard"];
};
```

Add this helper near `getSeatTtsConfig`:

```ts
export function getSeatRoleCard(game: HumanGameView, seatId: number | undefined) {
  if (!seatId) return undefined;
  return game.seats.find((seat) => seat.seatId === seatId)?.roleCard;
}
```

Then update `buildAiSpeechAudioCue`:

```ts
return {
  key: speechStreamKey(game.id, speech),
  gameId: game.id,
  speech,
  voicePersonaName: getSeatPersonaName(game, speech.speaker.seatId),
  ttsVoice: getSeatTtsVoice(game, speech.speaker.seatId),
  ttsConfig: getSeatTtsConfig(game, speech.speaker.seatId, runtimeAiTtsConfigs),
  roleCard: getSeatRoleCard(game, speech.speaker.seatId),
};
```

- [ ] **Step 4: Send roleCard from GameClient**

In `src/components/GameClient.tsx`, update the request body in `loadAiSpeechAudioUrl`:

```ts
body: JSON.stringify({
  gameId: cue.gameId,
  speechKey: cue.speechKey,
  speakerSeatId: cue.speaker.seatId,
  speakerName: cue.voicePersonaName ?? cue.speaker.name,
  ttsVoice: cue.ttsVoice,
  ttsConfig: cue.ttsConfig,
  roleCard: cue.roleCard,
  text: cue.text,
}),
```

In `playAiSpeechAudioCue`, pass the cue role card:

```ts
await playAiSpeechAudioText(
  {
    gameId: cue.gameId,
    speechKey: cue.key,
    speaker,
    voicePersonaName: cue.voicePersonaName,
    ttsVoice: cue.ttsVoice,
    ttsConfig: cue.ttsConfig,
    roleCard: cue.roleCard,
    text: cue.speech.message,
  },
  runId,
);
```

In the streaming queue setup inside `GameClient.tsx`, pass `roleCard: streamingSpeaker.roleCard` when creating queued live TTS chunks.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
npm run test -- src/components/game/aiSpeechAudio.test.ts src/components/game/gameClientRequests.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/components/game/clientTypes.ts src/components/game/aiSpeechAudio.ts src/components/game/aiSpeechAudio.test.ts src/components/GameClient.tsx
git commit -m "feat: pass role card to ai speech audio"
```

## Task 2: Add GPT-SoVITS Transport Helper

**Files:**
- Create: `src/server/gptSoVitsTts.ts`
- Create: `src/server/gptSoVitsTts.test.ts`

- [ ] **Step 1: Write the failing transport tests**

Create `src/server/gptSoVitsTts.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  buildGptSoVitsEndpoint,
  generateGptSoVitsTtsAudio,
  sanitizeGptSoVitsError,
  switchGptSoVitsWeights,
} from "./gptSoVitsTts";

describe("GPT-SoVITS TTS helper", () => {
  it("builds endpoints from either a base URL or endpoint URL", () => {
    expect(buildGptSoVitsEndpoint("http://127.0.0.1:9880", "/tts")).toBe("http://127.0.0.1:9880/tts");
    expect(buildGptSoVitsEndpoint("http://127.0.0.1:9880/", "set_gpt_weights")).toBe(
      "http://127.0.0.1:9880/set_gpt_weights",
    );
  });

  it("switches both GPT and SoVITS weights with encoded local paths", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await switchGptSoVitsWeights({
      baseUrl: "http://127.0.0.1:9880",
      gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
      sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
      fetcher,
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/set_gpt_weights?weights_path=");
    expect(decodeURIComponent(String(fetcher.mock.calls[0]?.[0]))).toContain("gao_song_deng-e30.ckpt");
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/set_sovits_weights?weights_path=");
    expect(decodeURIComponent(String(fetcher.mock.calls[1]?.[0]))).toContain("gao_song_deng_e16_s2096.pth");
  });

  it("posts api_v2 TTS JSON and returns audio bytes", async () => {
    const fetcher = vi.fn(async () => new Response(Buffer.from("RIFF-ok"), { status: 200, headers: { "content-type": "audio/wav" } }));

    const audio = await generateGptSoVitsTtsAudio({
      baseUrl: "http://127.0.0.1:9880",
      text: "本当に、そう思う。",
      textLang: "ja",
      refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
      promptLang: "ja",
      promptText: "本当に…やめちゃうの…でも…",
      mediaType: "wav",
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      text: "本当に、そう思う。",
      text_lang: "ja",
      ref_audio_path: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
      prompt_lang: "ja",
      prompt_text: "本当に…やめちゃうの…でも…",
      media_type: "wav",
      streaming_mode: false,
    });
    expect(audio.toString()).toBe("RIFF-ok");
  });

  it("sanitizes local secrets in provider errors", () => {
    expect(sanitizeGptSoVitsError("failed with sk-secret and tp-secret")).toBe("failed with sk-*** and tp-***");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/server/gptSoVitsTts.test.ts
```

Expected: FAIL because `src/server/gptSoVitsTts.ts` does not exist.

- [ ] **Step 3: Implement the transport helper**

Create `src/server/gptSoVitsTts.ts`:

```ts
export type GptSoVitsFetch = typeof fetch;

export type GptSoVitsTtsInput = {
  baseUrl: string;
  text: string;
  textLang: "ja" | "zh" | "en" | string;
  refAudioPath: string;
  promptLang: "ja" | "zh" | "en" | string;
  promptText: string;
  mediaType?: "wav" | "mp3" | string;
  fetcher?: GptSoVitsFetch;
};

export type GptSoVitsWeightSwitchInput = {
  baseUrl: string;
  gptWeightsPath: string;
  sovitsWeightsPath: string;
  fetcher?: GptSoVitsFetch;
};

export function buildGptSoVitsEndpoint(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function switchGptSoVitsWeights(input: GptSoVitsWeightSwitchInput): Promise<void> {
  const fetcher = input.fetcher ?? fetch;
  await callControlEndpoint(
    fetcher,
    `${buildGptSoVitsEndpoint(input.baseUrl, "/set_gpt_weights")}?weights_path=${encodeURIComponent(input.gptWeightsPath)}`,
    "GPT",
  );
  await callControlEndpoint(
    fetcher,
    `${buildGptSoVitsEndpoint(input.baseUrl, "/set_sovits_weights")}?weights_path=${encodeURIComponent(input.sovitsWeightsPath)}`,
    "SoVITS",
  );
}

export async function generateGptSoVitsTtsAudio(input: GptSoVitsTtsInput): Promise<Buffer> {
  const response = await (input.fetcher ?? fetch)(buildGptSoVitsEndpoint(input.baseUrl, "/tts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      text_lang: input.textLang,
      ref_audio_path: input.refAudioPath,
      prompt_lang: input.promptLang,
      prompt_text: input.promptText,
      text_split_method: "cut5",
      batch_size: 1,
      speed_factor: 1,
      fragment_interval: 0.3,
      media_type: input.mediaType ?? "wav",
      streaming_mode: false,
      parallel_infer: true,
      repetition_penalty: 1.35,
    }),
  });
  const raw = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`GPT-SoVITS TTS failed: ${response.status} ${sanitizeGptSoVitsError(raw.toString("utf8"))}`);
  }
  if (raw.length === 0) throw new Error("GPT-SoVITS TTS returned empty audio.");
  return raw;
}

export function sanitizeGptSoVitsError(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
}

async function callControlEndpoint(fetcher: GptSoVitsFetch, url: string, label: string): Promise<void> {
  const response = await fetcher(url);
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`GPT-SoVITS ${label} weight switch failed: ${response.status} ${sanitizeGptSoVitsError(body)}`);
  }
}
```

- [ ] **Step 4: Run the transport tests and commit**

Run:

```powershell
npm run test -- src/server/gptSoVitsTts.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/server/gptSoVitsTts.ts src/server/gptSoVitsTts.test.ts
git commit -m "feat: add gpt-sovits tts transport"
```

## Task 3: Resolve Class-Trial Voice Profiles From Local GPT-SoVITS Files

**Files:**
- Create: `src/ai/classTrialVoiceProfiles.ts`
- Create: `src/ai/classTrialVoiceProfiles.test.ts`

- [ ] **Step 1: Write the failing resolver tests**

Create `src/ai/classTrialVoiceProfiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import {
  CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES,
  resolveClassTrialGptSoVitsVoiceProfile,
} from "./classTrialVoiceProfiles";

describe("class-trial GPT-SoVITS voice profiles", () => {
  it("declares all 9 class-trial character profiles", () => {
    expect(CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES.map((profile) => profile.characterId)).toEqual([
      "naegi",
      "kirigiri",
      "fukawa",
      "monokuma",
      "enoshima",
      "celestia",
      "togami",
      "tomori",
      "anon",
    ]);
  });

  it("uses the clean denoised black-white bear weights", () => {
    const profile = CLASS_TRIAL_GPT_SOVITS_VOICE_PROFILES.find((item) => item.characterId === "monokuma");

    expect(profile?.weightKey).toBe("hei_bai_xiong_clean_denoised");
    expect(profile?.gptWeightFile).toBe("hei_bai_xiong_clean_denoised-e30.ckpt");
    expect(profile?.sovitsWeightFile).toBe("hei_bai_xiong_clean_denoised_e16_s2240.pth");
  });

  it("resolves weights and first prompt line from local logs", () => {
    const files = new Map<string, string>();
    const root = "D:\\AI\\GPT-SoVITS";
    files.set(
      `${root}\\logs\\AI_voice_1\\2-name2text.txt`,
      "anon_ref.wav\tphones\tNone\t千葉屋アノンです。よろしくお願いします。",
    );
    const exists = new Set([
      `${root}\\GPT_weights_v2Pro\\qian_dao_ai_yin-e30.ckpt`,
      `${root}\\SoVITS_weights_v2Pro\\qian_dao_ai_yin_e16_s8064.pth`,
      `${root}\\logs\\AI_voice_1\\5-wav32k\\anon_ref.wav`,
    ]);

    const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard("anon", "千早爱音"), {
      root,
      existsSync: (filePath) => exists.has(filePath),
      readTextFile: (filePath) => files.get(filePath) ?? "",
    });

    expect(resolved.available).toBe(true);
    expect(resolved.profile?.characterId).toBe("anon");
    expect(resolved.profile?.logKey).toBe("AI_voice_1");
    expect(resolved.profile?.promptText).toBe("千葉屋アノンです。よろしくお願いします。");
    expect(resolved.profile?.refAudioPath).toContain("logs\\AI_voice_1\\5-wav32k\\anon_ref.wav");
  });

  it("returns unavailable when a local file is missing", () => {
    const resolved = resolveClassTrialGptSoVitsVoiceProfile(roleCard("tomori", "高松灯"), {
      root: "D:\\AI\\GPT-SoVITS",
      existsSync: () => false,
      readTextFile: () => "",
    });

    expect(resolved.available).toBe(false);
    expect(resolved.reason).toContain("缺少");
  });
});

function roleCard(id: string, displayName: string): AiCharacterRoleCard {
  return {
    id,
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
    voiceProfileId: `${id}-ja-local`,
    voiceLocale: "ja-JP",
    voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
  };
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/ai/classTrialVoiceProfiles.test.ts
```

Expected: FAIL because the resolver module does not exist.

- [ ] **Step 3: Implement the resolver**

Create `src/ai/classTrialVoiceProfiles.ts`:

```ts
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
```

- [ ] **Step 4: Run resolver tests and commit**

Run:

```powershell
npm run test -- src/ai/classTrialVoiceProfiles.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/ai/classTrialVoiceProfiles.ts src/ai/classTrialVoiceProfiles.test.ts
git commit -m "feat: resolve class trial gpt-sovits voices"
```

## Task 4: Add Temporary Japanese Rewrite Helper

**Files:**
- Create: `src/ai/classTrialSpeechRewrite.ts`
- Create: `src/ai/classTrialSpeechRewrite.test.ts`

- [ ] **Step 1: Write failing rewrite tests**

Create `src/ai/classTrialSpeechRewrite.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AiCharacterRoleCard } from "@/game/types";
import { rewriteClassTrialSpeechForJapaneseTts } from "./classTrialSpeechRewrite";

describe("class-trial Japanese TTS rewrite", () => {
  it("returns a clean Japanese line from routed JSON output", async () => {
    const text = await rewriteClassTrialSpeechForJapaneseTts(
      {
        sourceZh: "我觉得3号前后变化有点大，今天先听他解释。",
        roleCard: roleCard("tomori", "高松灯"),
      },
      async () => '{"textJa":"3番の発言は前後で少し変わっていると思う。今日はまず説明を聞きたい。"}',
    );

    expect(text).toBe("3番の発言は前後で少し変わっていると思う。今日はまず説明を聞きたい。");
  });

  it("rejects empty or explanatory rewrite output", async () => {
    await expect(
      rewriteClassTrialSpeechForJapaneseTts(
        { sourceZh: "我先压5号。", roleCard: roleCard("naegi", "苗木诚") },
        async () => '{"textJa":"以下是日语翻译：5番を押します。"}',
      ),
    ).rejects.toThrow("日语改写不可用");
  });

  it("keeps seat numbers from the Chinese source", async () => {
    await expect(
      rewriteClassTrialSpeechForJapaneseTts(
        { sourceZh: "我会投7号。", roleCard: roleCard("kirigiri", "雾切响子") },
        async () => '{"textJa":"私は投票します。"}',
      ),
    ).rejects.toThrow("座位号");
  });
});

function roleCard(id: string, displayName: string): AiCharacterRoleCard {
  return {
    id,
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
    voiceProfileId: `${id}-ja-local`,
    voiceLocale: "ja-JP",
    voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
  };
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test -- src/ai/classTrialSpeechRewrite.test.ts
```

Expected: FAIL because the rewrite module does not exist.

- [ ] **Step 3: Implement the rewrite helper**

Create `src/ai/classTrialSpeechRewrite.ts`:

```ts
import { callRoutedModelJsonWithFallbacks, readRenderedText } from "./modelLlms";
import type { AiCharacterRoleCard } from "@/game/types";

type RewriteRenderer = (input: { system: string; input: unknown }) => Promise<string>;

export async function rewriteClassTrialSpeechForJapaneseTts(
  options: {
    sourceZh: string;
    roleCard: AiCharacterRoleCard;
  },
  renderer: RewriteRenderer = defaultRewriteRenderer,
): Promise<string> {
  const sourceZh = options.sourceZh.trim();
  if (!sourceZh) throw new Error("日语改写不可用：中文台词为空。");

  const raw = await renderer({
    system: [
      "你把中文狼人杀公开发言改写成自然日语朗读稿。",
      "只输出 JSON：{\"textJa\":\"...\"}。",
      "不要解释，不要添加括号动作，不要新增身份、死因、查验、投票目标等事实。",
      "保留所有座位号，例如 3号 改为 3番。",
      `角色：${options.roleCard.displayName}。风格：${options.roleCard.speechStyleZh}`,
      options.roleCard.voiceRewritePolicy ? `改写策略：${options.roleCard.voiceRewritePolicy}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    input: {
      sourceZh,
      character: options.roleCard.displayName,
    },
  });
  const textJa = readTextJa(raw);
  validateRewrite(sourceZh, textJa);
  return textJa;
}

async function defaultRewriteRenderer(input: { system: string; input: unknown }): Promise<string> {
  const rendered = await callRoutedModelJsonWithFallbacks({
    task: "speech",
    personaName: "GPT",
    fallbackPersonaNames: ["DeepSeek", "Kimi"],
    system: input.system,
    input: input.input,
    maxTokens: 220,
  });
  return readRenderedText(rendered);
}

function readTextJa(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { textJa?: unknown };
    return typeof parsed.textJa === "string" ? parsed.textJa.trim() : "";
  } catch {
    return "";
  }
}

function validateRewrite(sourceZh: string, textJa: string): void {
  if (!textJa) throw new Error("日语改写不可用：输出为空。");
  if (/以下|翻译|日语|JSON|textJa|改写/.test(textJa)) {
    throw new Error("日语改写不可用：输出包含解释性前缀。");
  }
  const sourceSeatNumbers = new Set([...sourceZh.matchAll(/(\d{1,2})号/g)].map((match) => match[1]));
  for (const seatNumber of sourceSeatNumbers) {
    if (!new RegExp(`${seatNumber}\\s*番`).test(textJa)) {
      throw new Error(`日语改写不可用：缺少座位号 ${seatNumber}号。`);
    }
  }
}
```

- [ ] **Step 4: Run rewrite tests and commit**

Run:

```powershell
npm run test -- src/ai/classTrialSpeechRewrite.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/ai/classTrialSpeechRewrite.ts src/ai/classTrialSpeechRewrite.test.ts
git commit -m "feat: rewrite class trial speech for japanese tts"
```

## Task 5: Prefer GPT-SoVITS In The AI Speech Audio Route With Mimo Fallback

**Files:**
- Modify: `src/app/api/ai-speech-audio/route.ts`
- Create: `src/app/api/ai-speech-audio/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/ai-speech-audio/route.test.ts` with module mocks before importing the route:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const generateGptSoVitsTtsAudio = vi.fn();
const switchGptSoVitsWeights = vi.fn();
const resolveClassTrialGptSoVitsVoiceProfile = vi.fn();
const rewriteClassTrialSpeechForJapaneseTts = vi.fn();
const generateMimoTtsAudio = vi.fn();
const getMimoTtsConfig = vi.fn();

vi.mock("@/server/gptSoVitsTts", () => ({
  generateGptSoVitsTtsAudio,
  switchGptSoVitsWeights,
  buildGptSoVitsEndpoint: (baseUrl: string, path: string) => `${baseUrl.replace(/\\/+$/, "")}/${path.replace(/^\\//, "")}`,
  sanitizeGptSoVitsError: (message: string) => message,
}));

vi.mock("@/ai/classTrialVoiceProfiles", () => ({
  resolveClassTrialGptSoVitsVoiceProfile,
}));

vi.mock("@/ai/classTrialSpeechRewrite", () => ({
  rewriteClassTrialSpeechForJapaneseTts,
}));

vi.mock("@/server/mimoTts", async () => {
  const actual = await vi.importActual<typeof import("@/server/mimoTts")>("@/server/mimoTts");
  return {
    ...actual,
    generateMimoTtsAudio,
    getMimoTtsConfig,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/ai-speech-audio class-trial GPT-SoVITS routing", () => {
  it("uses GPT-SoVITS for class-trial ja-JP role cards", async () => {
    resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({
      available: true,
      profile: voiceProfile(),
    });
    rewriteClassTrialSpeechForJapaneseTts.mockResolvedValue("3番の発言を聞きたい。");
    switchGptSoVitsWeights.mockResolvedValue(undefined);
    generateGptSoVitsTtsAudio.mockResolvedValue(Buffer.from("voice"));
    const { POST } = await import("./route");

    const response = await POST(requestBody());
    const data = (await response.json()) as { url?: string; voiceProfile?: { provider?: string } };

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^\/audio\/ai-speech\//);
    expect(data.voiceProfile?.provider).toBe("gpt-sovits");
    expect(rewriteClassTrialSpeechForJapaneseTts).toHaveBeenCalledWith(
      expect.objectContaining({ sourceZh: "我想听3号解释。" }),
    );
    expect(switchGptSoVitsWeights).toHaveBeenCalledWith(expect.objectContaining({
      gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
      sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
    }));
    expect(generateGptSoVitsTtsAudio).toHaveBeenCalledWith(expect.objectContaining({
      text: "3番の発言を聞きたい。",
      promptText: "本当に…やめちゃうの…でも…",
    }));
    expect(generateMimoTtsAudio).not.toHaveBeenCalled();
  });

  it("falls back to Mimo Chinese TTS when GPT-SoVITS fails", async () => {
    resolveClassTrialGptSoVitsVoiceProfile.mockReturnValue({ available: true, profile: voiceProfile() });
    rewriteClassTrialSpeechForJapaneseTts.mockRejectedValue(new Error("rewrite failed"));
    getMimoTtsConfig.mockReturnValue({
      apiKey: "mimo",
      authHeader: "Authorization",
      baseUrl: "https://tts.example.com",
      endpoint: "https://tts.example.com/v1/chat/completions",
      format: "mp3",
      model: "mimo-v2.5-tts",
    });
    generateMimoTtsAudio.mockResolvedValue(Buffer.from("mimo"));
    const { POST } = await import("./route");

    const response = await POST(requestBody());
    const data = (await response.json()) as { url?: string; voiceProfile?: { provider?: string } };

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^\/audio\/ai-speech\//);
    expect(data.voiceProfile?.provider).not.toBe("gpt-sovits");
    expect(generateMimoTtsAudio).toHaveBeenCalled();
  });
});

function requestBody(): Request {
  return new Request("http://localhost/api/ai-speech-audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: "game-1",
      speechKey: "game-1:1:8",
      speakerSeatId: 8,
      speakerName: "高松灯",
      text: "我想听3号解释。",
      roleCard: {
        id: "tomori",
        displayName: "高松灯",
        theme: "class-trial",
        voiceLocale: "ja-JP",
        speechStyleZh: "短句偏多。",
        voiceRewritePolicy: "轻微意译，不改变狼人杀信息。",
      },
    }),
  });
}

function voiceProfile() {
  return {
    characterId: "tomori",
    displayName: "高松灯",
    weightKey: "gao_song_deng",
    logKey: "gao_song_deng",
    gptWeightFile: "gao_song_deng-e30.ckpt",
    sovitsWeightFile: "gao_song_deng_e16_s2096.pth",
    gptWeightsPath: "D:\\AI\\GPT-SoVITS\\GPT_weights_v2Pro\\gao_song_deng-e30.ckpt",
    sovitsWeightsPath: "D:\\AI\\GPT-SoVITS\\SoVITS_weights_v2Pro\\gao_song_deng_e16_s2096.pth",
    refAudioPath: "D:\\AI\\GPT-SoVITS\\logs\\gao_song_deng\\5-wav32k\\ref.wav",
    promptText: "本当に…やめちゃうの…でも…",
    promptLang: "ja",
    textLang: "ja",
    mediaType: "wav",
  };
}
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```powershell
npm run test -- src/app/api/ai-speech-audio/route.test.ts
```

Expected: FAIL because the route does not accept `roleCard` and does not call GPT-SoVITS helpers.

- [ ] **Step 3: Extend route schema for roleCard**

In `src/app/api/ai-speech-audio/route.ts`, add this zod schema near `requestSchema`:

```ts
const roleCardSchema = z
  .object({
    id: z.string().min(1).max(80),
    displayName: z.string().min(1).max(40),
    theme: z.string().min(1).max(40),
    speechStyleZh: z.string().max(260).optional(),
    voiceLocale: z.string().max(16).optional(),
    voiceRewritePolicy: z.string().max(160).optional(),
  })
  .optional();
```

Add it to `requestSchema`:

```ts
roleCard: roleCardSchema,
```

- [ ] **Step 4: Add GPT-SoVITS attempt before Mimo**

In `src/app/api/ai-speech-audio/route.ts`, import:

```ts
import { rewriteClassTrialSpeechForJapaneseTts } from "@/ai/classTrialSpeechRewrite";
import { resolveClassTrialGptSoVitsVoiceProfile } from "@/ai/classTrialVoiceProfiles";
import { generateGptSoVitsTtsAudio, switchGptSoVitsWeights } from "@/server/gptSoVitsTts";
```

Add this helper in the route file:

```ts
async function tryGenerateClassTrialGptSoVitsAudio(value: z.infer<typeof requestSchema>): Promise<
  | {
      audio: Buffer;
      format: string;
      cacheParts: Record<string, string>;
      voiceProfile: { id: string; name: string; voice: string; provider: "gpt-sovits" };
    }
  | undefined
> {
  const resolved = resolveClassTrialGptSoVitsVoiceProfile(value.roleCard as never);
  if (!resolved.available) return undefined;

  const baseUrl = readOptionalEnv("CLASS_TRIAL_GPT_SOVITS_BASE_URL") ?? "http://127.0.0.1:9880";
  const textJa = await rewriteClassTrialSpeechForJapaneseTts({
    sourceZh: value.text,
    roleCard: value.roleCard as never,
  });
  await switchGptSoVitsWeights({
    baseUrl,
    gptWeightsPath: resolved.profile.gptWeightsPath,
    sovitsWeightsPath: resolved.profile.sovitsWeightsPath,
  });
  const audio = await generateGptSoVitsTtsAudio({
    baseUrl,
    text: textJa,
    textLang: resolved.profile.textLang,
    refAudioPath: resolved.profile.refAudioPath,
    promptLang: resolved.profile.promptLang,
    promptText: resolved.profile.promptText,
    mediaType: resolved.profile.mediaType,
  });

  return {
    audio,
    format: resolved.profile.mediaType,
    cacheParts: {
      provider: "gpt-sovits",
      profileId: resolved.profile.characterId,
      gptWeightsPath: resolved.profile.gptWeightsPath,
      sovitsWeightsPath: resolved.profile.sovitsWeightsPath,
      refAudioPath: resolved.profile.refAudioPath,
      promptText: resolved.profile.promptText,
      text: textJa,
    },
    voiceProfile: {
      id: resolved.profile.characterId,
      name: resolved.profile.displayName,
      voice: resolved.profile.weightKey,
      provider: "gpt-sovits",
    },
  };
}
```

Then in `POST`, before the existing Mimo `voiceCandidates` loop, try GPT-SoVITS:

```ts
const classTrialAudio = await tryGenerateClassTrialGptSoVitsAudio(parsed.data).catch(() => undefined);
if (classTrialAudio) {
  const cache = buildAudioCacheEntry({
    gameId: parsed.data.gameId,
    speechKey: parsed.data.speechKey,
    speakerSeatId: parsed.data.speakerSeatId,
    baseUrl: readOptionalEnv("CLASS_TRIAL_GPT_SOVITS_BASE_URL") ?? "http://127.0.0.1:9880",
    authHeader: "none",
    model: classTrialAudio.cacheParts.provider,
    format: classTrialAudio.format,
    voice: classTrialAudio.voiceProfile.voice,
    profileId: classTrialAudio.voiceProfile.id,
    instructions: JSON.stringify(classTrialAudio.cacheParts),
    text: classTrialAudio.cacheParts.text,
  });
  await mkdir(AI_SPEECH_CACHE_DIR, { recursive: true });
  await writeFile(cache.filePath, classTrialAudio.audio);
  return Response.json({
    url: cache.url,
    voiceProfile: classTrialAudio.voiceProfile,
  });
}
```

Keep all existing Mimo logic after this block unchanged so fallback remains available.

- [ ] **Step 5: Run route tests and fix import/type issues**

Run:

```powershell
npm run test -- src/app/api/ai-speech-audio/route.test.ts
```

Expected: PASS after resolving any `z.infer` or test mock import issues.

- [ ] **Step 6: Run combined speech tests and commit**

Run:

```powershell
npm run test -- src/app/api/ai-speech-audio/route.test.ts src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/voiceProfiles.test.ts
```

Expected: PASS.

Commit:

```powershell
git add src/app/api/ai-speech-audio/route.ts src/app/api/ai-speech-audio/route.test.ts
git commit -m "feat: route class trial speech to gpt-sovits"
```

## Task 6: Manual GPT-SoVITS Smoke And State Updates

**Files:**
- Modify: `docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`
- Modify: `feature_list.json`
- Modify: `progress.md`
- Modify: `session-handoff.md`

- [ ] **Step 1: Run full focused verification**

Run:

```powershell
npm run test -- src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/voiceProfiles.test.ts
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all pass. `npm run build` may still show the existing Turbopack NFT trace warning; record it if present.

- [ ] **Step 2: Verify GPT-SoVITS service is reachable**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9880/openapi.json' -TimeoutSec 8 | Select-Object StatusCode,Headers
```

Expected: `StatusCode` is `200`.

- [ ] **Step 3: Run browser/manual flow**

1. Start local dev server.
2. Open `http://127.0.0.1:<port>`.
3. Select `学级裁判主题局`.
4. Enable AI speech if it is not enabled.
5. Select `9 人预女猎`.
6. Select `无真人 · 只看 AI 对局`.
7. Click `进入牌桌`.
8. Advance through at least two different AI speakers.
9. Confirm the browser plays Japanese speech while the visible dialogue remains Chinese.
10. Confirm GPT-SoVITS logs show `/set_gpt_weights`, `/set_sovits_weights`, and `/tts`.

- [ ] **Step 4: Verify fallback behavior**

Use one of these controlled failures:

```powershell
# Option A: stop GPT-SoVITS service, then trigger another class-trial speech.
# Option B: temporarily set CLASS_TRIAL_GPT_SOVITS_BASE_URL to http://127.0.0.1:9999 for the app process only.
```

Expected: the route returns audio from existing Mimo Chinese TTS if configured; if Mimo is unavailable, frontend uses current no-audio degradation and does not block the game flow.

- [ ] **Step 5: Update state files**

In `feature_list.json`, add a new feature entry:

```json
{
  "id": "class-trial-gpt-sovits-voice",
  "name": "Class Trial GPT-SoVITS Voice",
  "description": "Route local-only class-trial AI speech through GPT-SoVITS Japanese per-character voices while preserving Chinese visible text and Mimo fallback.",
  "dependencies": ["class-trial-verdict-review"],
  "status": "done",
  "evidence": "docs/superpowers/specs/2026-05-28-class-trial-gpt-sovits-voice-design.md; docs/superpowers/plans/2026-05-28-class-trial-gpt-sovits-voice.md; docs/tasks/2026-05-class-trial-gpt-sovits-voice.md; src/server/gptSoVitsTts.ts; src/ai/classTrialVoiceProfiles.ts; src/ai/classTrialSpeechRewrite.ts; src/app/api/ai-speech-audio/route.ts; npm run test -- src/server/gptSoVitsTts.test.ts src/ai/classTrialVoiceProfiles.test.ts src/ai/classTrialSpeechRewrite.test.ts src/app/api/ai-speech-audio/route.test.ts src/components/game/aiSpeechAudio.test.ts src/ai/voiceProfiles.test.ts; npm run lint; npx tsc --noEmit; npm run build; browser local class-trial smoke with GPT-SoVITS at http://127.0.0.1:9880"
}
```

In `progress.md`, set:

```md
**Session ID:** class-trial gpt-sovits voice
**Active Feature:** class-trial-gpt-sovits-voice - Class Trial GPT-SoVITS Voice
```

Add completion bullets for GPT-SoVITS helper, voice profile resolver, Japanese rewrite, route fallback, and browser smoke.

In `session-handoff.md`, record the implementation status, verification output, and any remaining local-service risks.

In `docs/tasks/2026-05-class-trial-gpt-sovits-voice.md`, append completion evidence using the required handoff shape.

- [ ] **Step 6: Run harness and whitespace checks**

Run:

```powershell
npm run harness:task-card -- docs/tasks/2026-05-class-trial-gpt-sovits-voice.md
npm run harness:check
git diff --check
```

Expected: task card and harness pass; `git diff --check` has no whitespace errors. Line-ending warnings are acceptable if no whitespace errors are reported.

- [ ] **Step 7: Commit implementation state**

Commit only tracked source/docs state. Do not stage `local-assets`, `D:\AI\GPT-SoVITS`, or generated `public/audio/ai-speech` files.

```powershell
git add src/server/gptSoVitsTts.ts src/server/gptSoVitsTts.test.ts `
  src/ai/classTrialVoiceProfiles.ts src/ai/classTrialVoiceProfiles.test.ts `
  src/ai/classTrialSpeechRewrite.ts src/ai/classTrialSpeechRewrite.test.ts `
  src/app/api/ai-speech-audio/route.ts src/app/api/ai-speech-audio/route.test.ts `
  src/components/game/clientTypes.ts src/components/game/aiSpeechAudio.ts src/components/game/aiSpeechAudio.test.ts `
  src/components/GameClient.tsx docs/tasks/2026-05-class-trial-gpt-sovits-voice.md `
  feature_list.json progress.md session-handoff.md
git commit -m "feat: add class trial gpt-sovits voice"
```

## Self-Review Notes

- Spec coverage: The plan covers role-card routing, local GPT-SoVITS transport, 9-role profile resolution, Japanese temporary rewrite, Mimo fallback, cache-key inclusion, browser smoke, and state updates.
- Scope check: This remains class-trial-only and does not add AI Pool UI or public deployment support.
- Type consistency: The plan uses `roleCard` consistently from browser cue to route schema to profile resolver.
- TDD check: Each implementation task starts with failing tests and an expected RED command before production code.
