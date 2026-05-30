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
  now?: () => number;
};

export type GptSoVitsControlStepTiming = {
  durationMs: number;
  skipped: boolean;
};

export type GptSoVitsWeightSwitchReport = {
  gpt: GptSoVitsControlStepTiming;
  sovits: GptSoVitsControlStepTiming;
};

type ActiveGptSoVitsWeights = {
  gptWeightsPath?: string;
  sovitsWeightsPath?: string;
};

const activeWeightsByBaseUrl = new Map<string, ActiveGptSoVitsWeights>();
let gptSoVitsSynthesisQueue: Promise<void> = Promise.resolve();

export function buildGptSoVitsEndpoint(baseUrl: string, path: string): string {
  const cleanBase = normalizeGptSoVitsBaseUrl(baseUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function clearGptSoVitsWeightSwitchCache(): void {
  activeWeightsByBaseUrl.clear();
}

export function clearGptSoVitsSynthesisQueueForTests(): void {
  gptSoVitsSynthesisQueue = Promise.resolve();
}

export async function runGptSoVitsSynthesisExclusive<T>(work: () => Promise<T>): Promise<T> {
  const previous = gptSoVitsSynthesisQueue;
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  gptSoVitsSynthesisQueue = previous.catch(() => undefined).then(() => current);

  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    releaseCurrent?.();
  }
}

export async function switchGptSoVitsWeights(input: GptSoVitsWeightSwitchInput): Promise<GptSoVitsWeightSwitchReport> {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? Date.now;
  const baseUrl = normalizeGptSoVitsBaseUrl(input.baseUrl);
  const active = activeWeightsByBaseUrl.get(baseUrl) ?? {};
  const gptWeightsPath = input.gptWeightsPath.trim();
  const sovitsWeightsPath = input.sovitsWeightsPath.trim();

  const gpt =
    active.gptWeightsPath === gptWeightsPath
      ? { durationMs: 0, skipped: true }
      : await callControlEndpoint(
          fetcher,
          `${buildGptSoVitsEndpoint(baseUrl, "/set_gpt_weights")}?weights_path=${encodeURIComponent(gptWeightsPath)}`,
          "GPT",
          now,
        );
  if (!gpt.skipped) {
    active.gptWeightsPath = gptWeightsPath;
    activeWeightsByBaseUrl.set(baseUrl, active);
  }

  const sovits =
    active.sovitsWeightsPath === sovitsWeightsPath
      ? { durationMs: 0, skipped: true }
      : await callControlEndpoint(
          fetcher,
          `${buildGptSoVitsEndpoint(baseUrl, "/set_sovits_weights")}?weights_path=${encodeURIComponent(sovitsWeightsPath)}`,
          "SoVITS",
          now,
        );
  if (!sovits.skipped) {
    active.sovitsWeightsPath = sovitsWeightsPath;
    activeWeightsByBaseUrl.set(baseUrl, active);
  }

  return { gpt, sovits };
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

function normalizeGptSoVitsBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function callControlEndpoint(
  fetcher: GptSoVitsFetch,
  url: string,
  label: string,
  now: () => number,
): Promise<GptSoVitsControlStepTiming> {
  const startedAt = now();
  const response = await fetcher(url);
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`GPT-SoVITS ${label} weight switch failed: ${response.status} ${sanitizeGptSoVitsError(body)}`);
  }
  return { durationMs: Math.max(0, Math.round(now() - startedAt)), skipped: false };
}
