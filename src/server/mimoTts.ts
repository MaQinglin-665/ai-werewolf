export type MimoTtsConfig = {
  apiKey: string;
  authHeader: string;
  baseUrl: string;
  endpoint: string;
  format: string;
  model: string;
};

export type MimoTtsInput = {
  text: string;
  voice: string;
  config?: MimoTtsConfig;
  instructions?: string;
};

type AudioLocator =
  | {
      type: "base64";
      value: string;
    }
  | {
      type: "url";
      value: string;
    };

export function getMimoTtsConfig(): MimoTtsConfig | undefined {
  const apiKey =
    readOptionalEnv("MIMO_API_KEY") ??
    readOptionalEnv("MIMO_LLM_API_KEY") ??
    readOptionalEnv("XIAOMI_API_KEY") ??
    readOptionalEnv("CXSEE_API_KEY");
  if (!apiKey) return undefined;

  const defaultBaseUrl = apiKey.startsWith("tp-")
    ? "https://token-plan-cn.xiaomimimo.com"
    : "https://api.xiaomimimo.com";
  const baseUrl = readOptionalEnv("MIMO_TTS_BASE_URL") ?? defaultBaseUrl;
  const authHeader = readOptionalEnv("MIMO_AUTH_HEADER") ?? (baseUrl.includes("cxsee") ? "api-key" : "Authorization");

  return {
    apiKey,
    authHeader,
    baseUrl,
    endpoint: buildMimoChatCompletionsUrl(baseUrl),
    format: readOptionalEnv("MIMO_AI_TTS_FORMAT") ?? readOptionalEnv("MIMO_TTS_FORMAT") ?? "mp3",
    model: readOptionalEnv("MIMO_AI_TTS_MODEL") ?? readOptionalEnv("MIMO_TTS_MODEL") ?? "mimo-v2.5-tts",
  };
}

export async function generateMimoTtsAudio({
  text,
  voice,
  config = getMimoTtsConfig(),
  instructions,
}: MimoTtsInput): Promise<Buffer> {
  if (!config) {
    throw new Error("Missing MIMO_API_KEY or MIMO_LLM_API_KEY.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.authHeader.toLowerCase() === "authorization") {
    headers.Authorization = `Bearer ${config.apiKey}`;
  } else {
    headers[config.authHeader] = config.apiKey;
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: buildTtsMessages(text, instructions),
      audio: {
        format: config.format,
        voice,
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Mimo TTS failed: ${response.status} ${sanitizeTtsError(raw)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Buffer.from(raw, "binary");
  }

  const audio = findAudio(payload);
  if (!audio) {
    throw new Error(`Mimo TTS response did not include audio data. Keys: ${readObjectKeys(payload).join(", ")}`);
  }

  if (audio.type === "url") {
    const audioResponse = await fetch(audio.value);
    if (!audioResponse.ok) {
      throw new Error(`Mimo TTS audio download failed: ${audioResponse.status}`);
    }
    return Buffer.from(await audioResponse.arrayBuffer());
  }

  return Buffer.from(audio.value, "base64");
}

export function sanitizeMimoApiKey(value: string | undefined): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  const embeddedKey = clean.match(/(?:tp|sk)-[A-Za-z0-9_-]+/);
  if (embeddedKey?.[0]) return embeddedKey[0];
  return clean.replace(/[，,。.;；:\s]+$/g, "") || undefined;
}

function buildTtsMessages(text: string, instructions: string | undefined): Array<{ role: "user" | "assistant"; content: string }> {
  if (!instructions) {
    return [
      {
        role: "assistant",
        content: text,
      },
    ];
  }

  return [
    {
      role: "user",
      content: instructions,
    },
    {
      role: "assistant",
      content: text,
    },
  ];
}

export function sanitizeTtsError(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
}

export function buildMimoChatCompletionsUrl(baseUrl: string): string {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  if (cleanBaseUrl.endsWith("/chat/completions")) return cleanBaseUrl;
  const versionedBaseUrl = cleanBaseUrl.endsWith("/v1") ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
  return `${versionedBaseUrl}/chat/completions`;
}

function findAudio(value: unknown): AudioLocator | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) return { type: "url", value };
    const dataUrl = value.match(/^data:audio\/[^;]+;base64,(.+)$/);
    if (dataUrl?.[1]) return { type: "base64", value: dataUrl[1] };
    if (value.length > 200 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return { type: "base64", value };
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudio(item);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = ["audio", "data", "b64_json", "base64", "url", "audio_url", "content"];
    for (const key of preferredKeys) {
      const found = findAudio(record[key]);
      if (found) return found;
    }
    for (const item of Object.values(record)) {
      const found = findAudio(item);
      if (found) return found;
    }
  }

  return undefined;
}

function readObjectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>);
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
