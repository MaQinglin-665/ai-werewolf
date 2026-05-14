export type RoutedLlmResponse = {
  text: string;
  providerId: string;
};

export type LlmOutputStabilityHint = {
  attempt: number;
  previousIssue: string;
  previousOutput?: string;
  expectedFormat: string;
};

export type LlmOutputAttemptLog = {
  attempt: number;
  provider: string;
  rawOutput?: string;
  issue?: string;
  validationErrors?: string[];
};

type ModelRoute = {
  id: string;
  personaName: string;
  envPrefix: string;
  modelEnvKey: string;
  defaultModel: string;
  mergeSystemIntoUser?: boolean;
};

type RoutedJsonOptions = {
  personaName?: string;
  task: "speech" | "action" | "voice";
  system: string;
  input: unknown;
  maxTokens: number;
  onTextDelta?: (text: string) => void;
  onTextSnapshot?: (text: string) => void;
};

const MODEL_ROUTES: ModelRoute[] = [
  {
    id: "deepseek",
    personaName: "DeepSeek",
    envPrefix: "DEEPSEEK",
    modelEnvKey: "AI_MODEL_DEEPSEEK",
    defaultModel: "deepseek-v4-flash",
    mergeSystemIntoUser: true,
  },
  {
    id: "claude",
    personaName: "Claude",
    envPrefix: "CLAUDE",
    modelEnvKey: "AI_MODEL_CLAUDE",
    defaultModel: "claude-opus-4-6",
  },
  {
    id: "gpt",
    personaName: "GPT",
    envPrefix: "GPT",
    modelEnvKey: "AI_MODEL_GPT",
    defaultModel: "gpt-5.4",
  },
  {
    id: "doubao",
    personaName: "豆包",
    envPrefix: "DOUBAO",
    modelEnvKey: "AI_MODEL_DOUBAO",
    defaultModel: "doubao-seed-2-0-pro-260215",
  },
  {
    id: "mimo",
    personaName: "Mimo",
    envPrefix: "MIMO_LLM",
    modelEnvKey: "AI_MODEL_MIMO",
    defaultModel: "mimo-v2.5-pro",
  },
  {
    id: "gemini",
    personaName: "Gemini",
    envPrefix: "GEMINI",
    modelEnvKey: "AI_MODEL_GEMINI",
    defaultModel: "gemini-3-flash",
  },
  {
    id: "glm",
    personaName: "GLM",
    envPrefix: "GLM",
    modelEnvKey: "AI_MODEL_GLM",
    defaultModel: "glm-4-7-251222",
  },
  {
    id: "kimi",
    personaName: "Kimi",
    envPrefix: "KIMI",
    modelEnvKey: "AI_MODEL_KIMI",
    defaultModel: "kimi-k2.6",
  },
];

const FALLBACK_ROUTE = MODEL_ROUTES[0];

export function isModelLlmRoutingAvailable(): boolean {
  if (process.env.NODE_ENV === "test" && readOptionalEnv("AI_LLM_IN_TESTS") !== "true") {
    return false;
  }

  const mode = readOptionalEnv("AI_LLM_PROVIDER") ?? readOptionalEnv("AI_PROVIDER");
  const wantsRouting = mode === "models" || mode === "multi" || mode === "routed";
  return wantsRouting && MODEL_ROUTES.some((route) => Boolean(resolveRouteApiKey(route)));
}

export async function callRoutedModelJson(options: RoutedJsonOptions): Promise<RoutedLlmResponse> {
  const route = getModelRoute(options.personaName);
  const apiKey = resolveRouteApiKey(route);
  const baseUrl = resolveRouteBaseUrl(route, apiKey);
  const primaryModel = readOptionalEnv(route.modelEnvKey) ?? readRouteEnv(route, "MODEL") ?? route.defaultModel;
  const modelCandidates = resolveModelCandidates(route, primaryModel);

  if (!apiKey) {
    throw new Error("Missing AI_LLM_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTaskTimeoutMs(route, options.task));

  try {
    let lastError: Error | undefined;
    for (const [index, model] of modelCandidates.entries()) {
      const isLastCandidate = index === modelCandidates.length - 1;
      const body: Record<string, unknown> = {
        model,
        messages: buildMessages(route, options.system, options.input),
        temperature: readRouteTemperature(route, options.task),
        max_tokens: readRouteMaxTokens(route, options.task, options.maxTokens),
      };
      const thinkingMode = readThinkingMode(route);
      if (thinkingMode) {
        body.thinking = { type: thinkingMode };
      }

      if (options.task !== "speech" && readOptionalEnv("AI_LLM_JSON_MODE") === "on") {
        body.response_format = { type: "json_object" };
      }
      if (options.onTextDelta || options.onTextSnapshot) {
        body.stream = true;
      }

      let response: Response;
      let raw: string;
      try {
        response = await fetch(buildChatCompletionsUrl(baseUrl), {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        raw = body.stream && response.ok ? await readStreamingResponseText(response, options) : await response.text();
        if (!response.ok && body.stream && isStreamUnsupported(raw)) {
          delete body.stream;
          response = await fetch(buildChatCompletionsUrl(baseUrl), {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          });
          raw = await response.text();
        }
        if (!response.ok && body.thinking && isThinkingUnsupported(raw)) {
          delete body.thinking;
          response = await fetch(buildChatCompletionsUrl(baseUrl), {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          });
          raw = await response.text();
        }
        if (!response.ok && body.response_format && isResponseFormatUnsupported(raw)) {
          delete body.response_format;
          delete body.stream;
          response = await fetch(buildChatCompletionsUrl(baseUrl), {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          });
          raw = await response.text();
        }
      } catch (error) {
        lastError = formatModelRequestError(route, model, error);
        if (isLastCandidate || !shouldTryNextModelAfterRequestError(error)) {
          throw lastError;
        }
        continue;
      }

      if (response.ok) {
        return {
          text: extractTextFromResponse(raw),
          providerId: `${route.id}-${options.task}:${model}`,
        };
      }

      lastError = new Error(`LLM ${route.personaName} ${model} request failed: ${response.status} ${sanitizeLlmError(raw)}`);
      if (isLastCandidate || !shouldTryNextModel(response.status, raw)) {
        throw lastError;
      }
    }

    throw lastError ?? new Error(`LLM ${route.personaName} request failed.`);
  } finally {
    clearTimeout(timeout);
  }
}

async function readStreamingResponseText(response: Response, options: RoutedJsonOptions): Promise<string> {
  if (!response.body) return response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/event-stream")) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let lastSpeechSnapshot = "";

  const emit = (delta: string) => {
    output += delta;
    options.onTextDelta?.(delta);
    const snapshot = extractSpeechSnapshot(output);
    if (snapshot && snapshot !== lastSpeechSnapshot) {
      lastSpeechSnapshot = snapshot;
      options.onTextSnapshot?.(snapshot);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const clean = line.trim();
      if (!clean.startsWith("data:")) continue;
      const data = clean.slice("data:".length).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string };
            message?: { content?: string };
            text?: string;
          }>;
          output_text?: string;
        };
        const delta =
          parsed.choices?.map((choice) => choice.delta?.content ?? choice.message?.content ?? choice.text ?? "").join("") ??
          parsed.output_text ??
          "";
        if (delta) emit(delta);
      } catch {
        // Ignore non-JSON stream control lines from OpenAI-compatible gateways.
      }
    }
  }

  const rest = decoder.decode();
  if (rest) buffer += rest;
  return output;
}

function extractSpeechSnapshot(rawOutput: string): string | undefined {
  const match = rawOutput.match(/["']?speech["']?\s*[:：]\s*["“]([\s\S]*)$/i);
  const rawSpeech = match?.[1];
  if (!rawSpeech) {
    const plain = rawOutput
      .trim()
      .replace(/^```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    if (!plain || /^[{[]/.test(plain)) return undefined;
    return plain;
  }
  const clean = rawSpeech
    .replace(/\\n/g, " ")
    .replace(/\\"/g, "\"")
    .replace(/["”]\s*[,}]?\s*$/g, "")
    .trim();
  return clean || undefined;
}

export function readRenderedText(value: string | RoutedLlmResponse): string {
  return typeof value === "string" ? value : value.text;
}

export function readRenderedProviderId(value: string | RoutedLlmResponse): string | undefined {
  return typeof value === "string" ? undefined : value.providerId;
}

export function parseLlmJsonOutput(rawOutput: string): unknown {
  const candidates = collectJsonCandidates(rawOutput);
  let lastError: unknown;

  for (const candidate of candidates) {
    for (const jsonText of [candidate, repairLooseJson(candidate)]) {
      try {
        return JSON.parse(jsonText);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM output was not valid JSON.");
}

export function readLlmOutputMaxAttempts(): number {
  const retries = Math.floor(readNonNegativeNumberEnv("AI_LLM_MAX_RETRIES", 1));
  return Math.min(Math.max(retries, 0), 3) + 1;
}

export function packLlmOutputAttempts(attempts: LlmOutputAttemptLog[]): unknown {
  if (attempts.length === 0) return undefined;
  return attempts.length === 1 && !attempts[0]?.issue ? attempts[0]?.rawOutput : attempts;
}

export function trimLlmOutputForRetry(rawOutput: string | undefined): string | undefined {
  if (!rawOutput) return undefined;
  const clean = rawOutput.trim().replace(/\s+/g, " ");
  return clean.length > 500 ? `${clean.slice(0, 500)}...` : clean;
}

function getModelRoute(personaName: string | undefined): ModelRoute {
  return MODEL_ROUTES.find((route) => route.personaName === personaName) ?? FALLBACK_ROUTE;
}

function resolveModelCandidates(route: ModelRoute, primaryModel: string): string[] {
  const configuredFallbacks = readRouteEnv(route, "FALLBACK_MODELS") ?? defaultFallbackModels(route);
  return uniqueValues([
    primaryModel,
    ...configuredFallbacks
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  ]);
}

function defaultFallbackModels(route: ModelRoute): string {
  if (route.id === "gemini") return "gemini-3.1-pro,gemini-3.1-pro-preview";
  if (route.id === "gpt") return "gpt-5.5";
  return "";
}

function shouldTryNextModel(status: number, raw: string): boolean {
  if (status === 404 || status === 429 || status >= 500) return true;
  return /model|JWT|upstream|not found|not available|unsupported|quota|rate/i.test(raw);
}

function shouldTryNextModelAfterRequestError(error: unknown): boolean {
  return !isAbortLikeError(error);
}

function formatModelRequestError(route: ModelRoute, model: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`LLM ${route.personaName} ${model} request failed: ${message}`);
}

function isAbortLikeError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return name === "AbortError" || /abort|aborted|timeout/i.test(message);
}

function readRouteEnv(route: ModelRoute, suffix: string): string | undefined {
  return readOptionalEnv(`${route.envPrefix}_${suffix}`);
}

function buildMessages(route: ModelRoute, system: string, input: unknown): Array<{ role: "system" | "user"; content: string }> {
  const inputText = JSON.stringify(input);
  const forceSystemRole = readRouteEnv(route, "USE_SYSTEM_ROLE") === "true";
  if (route.mergeSystemIntoUser && !forceSystemRole) {
    return [
      {
        role: "user",
        content: `${system}\n\n输入：${inputText}`,
      },
    ];
  }
  return [
    { role: "system", content: system },
    { role: "user", content: inputText },
  ];
}

function readThinkingMode(route: ModelRoute): "disabled" | "enabled" | undefined {
  const routeMode = readRouteEnv(route, "THINKING")?.toLowerCase();
  if (routeMode === "disabled" || routeMode === "off" || routeMode === "false") return "disabled";
  if (routeMode === "enabled" || routeMode === "on" || routeMode === "true") return "enabled";

  const globalDisable = readOptionalEnv("AI_LLM_DISABLE_THINKING")?.toLowerCase();
  if (globalDisable === "false" || globalDisable === "off" || globalDisable === "0") return undefined;
  return route.id === "kimi" || route.id === "mimo" ? "disabled" : undefined;
}

function collectJsonCandidates(rawOutput: string): string[] {
  const trimmed = rawOutput
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim();
  const candidates: string[] = [];
  const push = (value: string | undefined) => {
    const clean = value?.trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencePattern)) {
    push(match[1]);
  }

  push(trimmed);
  push(extractBalancedJson(trimmed, "{", "}"));
  push(extractBalancedJson(trimmed, "[", "]"));

  return candidates;
}

function extractBalancedJson(text: string, openChar: "{" | "[", closeChar: "}" | "]"): string | undefined {
  const start = text.indexOf(openChar);
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return undefined;
}

function repairLooseJson(jsonText: string): string {
  return jsonText
    .trim()
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value: string) => JSON.stringify(value))
    .replace(/,\s*([}\]])/g, "$1");
}

function readRouteTemperature(route: ModelRoute, task: RoutedJsonOptions["task"]): number {
  const routeTaskTemperature = readRouteEnv(route, task === "action" ? "ACTION_TEMPERATURE" : "SPEECH_TEMPERATURE");
  if (route.id === "kimi") return 0.6;
  if (routeTaskTemperature) return readNumber(routeTaskTemperature, readTaskTemperature(task));

  const routeTemperature = readRouteEnv(route, "TEMPERATURE");
  if (routeTemperature) return readNumber(routeTemperature, readTaskTemperature(task));

  return readTaskTemperature(task);
}

function readRouteMaxTokens(route: ModelRoute, task: RoutedJsonOptions["task"], requested: number): number {
  const routeTaskMaxTokens = readRouteEnv(route, task === "action" ? "ACTION_MAX_TOKENS" : "SPEECH_MAX_TOKENS");
  if (routeTaskMaxTokens) return capTaskMaxTokens(task, Math.max(1, Math.floor(readNumber(routeTaskMaxTokens, requested))));

  const routeMaxTokens = readRouteEnv(route, "MAX_TOKENS");
  if (routeMaxTokens) return capTaskMaxTokens(task, Math.max(1, Math.floor(readNumber(routeMaxTokens, requested))));

  const genericTaskMaxTokens = readOptionalEnv(task === "action" ? "AI_LLM_ACTION_MAX_TOKENS" : "AI_LLM_SPEECH_MAX_TOKENS");
  if (genericTaskMaxTokens) {
    return capTaskMaxTokens(
      task,
      Math.max(1, reasoningModelTokenFloor(route, task), Math.floor(readNumber(genericTaskMaxTokens, requested))),
    );
  }

  return capTaskMaxTokens(task, Math.max(requested, reasoningModelTokenFloor(route, task)));
}

function reasoningModelTokenFloor(route: ModelRoute, task: RoutedJsonOptions["task"]): number {
  if (route.id !== "kimi" && route.id !== "mimo") return 0;
  if (task === "speech") return 2400;
  if (task === "action") return 1800;
  return 0;
}

function capTaskMaxTokens(task: RoutedJsonOptions["task"], maxTokens: number): number {
  if (task !== "speech") return maxTokens;
  return Math.min(maxTokens, Math.floor(readNumberEnv("AI_LLM_SPEECH_MAX_TOKENS_CAP", 3200)));
}

function readTaskTimeoutMs(route: ModelRoute, task: RoutedJsonOptions["task"]): number {
  const routeTaskTimeout = readRouteEnv(route, task === "speech" ? "SPEECH_TIMEOUT_MS" : "TIMEOUT_MS");
  if (routeTaskTimeout) return Math.floor(readNumber(routeTaskTimeout, 12000));
  const routeTimeout = readRouteEnv(route, "TIMEOUT_MS");
  if (routeTimeout) return Math.floor(readNumber(routeTimeout, 12000));

  if (task !== "speech") return readNumberEnv("AI_LLM_TIMEOUT_MS", 12000);
  const timeoutMs = readNumberEnv("AI_LLM_SPEECH_TIMEOUT_MS", readNumberEnv("AI_LLM_TIMEOUT_MS", 45000));
  const defaultCap = route.id === "glm" ? 90000 : 45000;
  const cap = readNumberEnv("AI_LLM_SPEECH_TIMEOUT_MS_CAP", defaultCap);
  return Math.min(Math.max(route.id === "glm" ? 90000 : timeoutMs, timeoutMs), Math.max(route.id === "glm" ? 90000 : cap, cap));
}

function readTaskTemperature(task: RoutedJsonOptions["task"]): number {
  if (task === "voice") {
    return readNumberEnv("VOICE_INPUT_REWRITE_TEMPERATURE", 0.2);
  }

  const taskKey = task === "action" ? "AI_LLM_ACTION_TEMPERATURE" : "AI_LLM_SPEECH_TEMPERATURE";
  return readNumberEnv(taskKey, readNumberEnv("AI_LLM_TEMPERATURE", task === "action" ? 0.45 : 0.72));
}

function readNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveRouteApiKey(route: ModelRoute): string | undefined {
  return (
    readRouteEnv(route, "API_KEY") ??
    (isArkRoute(route) ? readOptionalEnv("ARK_API_KEY") : undefined) ??
    readOptionalEnv("AI_LLM_API_KEY") ??
    readOptionalEnv("OPENAI_API_KEY")
  );
}

function resolveRouteBaseUrl(route: ModelRoute, apiKey: string | undefined): string {
  const routeBaseUrl = readRouteEnv(route, "BASE_URL");
  if (routeBaseUrl) return routeBaseUrl;
  if (route.id === "mimo" && apiKey?.startsWith("tp-")) return "https://token-plan-cn.xiaomimimo.com";
  if (isArkRoute(route) && apiKey?.startsWith("ark-")) return "https://ark.cn-beijing.volces.com/api/v3";
  return readOptionalEnv("AI_LLM_BASE_URL") ?? readOptionalEnv("OPENAI_BASE_URL") ?? "https://api.openai.com";
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  if (cleanBaseUrl.endsWith("/chat/completions")) return cleanBaseUrl;
  if (cleanBaseUrl.endsWith("/v1")) return `${cleanBaseUrl}/chat/completions`;
  if (cleanBaseUrl.endsWith("/api/v3")) return `${cleanBaseUrl}/chat/completions`;
  return `${cleanBaseUrl}/v1/chat/completions`;
}

function isArkRoute(route: ModelRoute): boolean {
  return route.id === "doubao" || route.id === "glm";
}

function extractTextFromResponse(raw: string): string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return raw;
  }

  if (typeof data === "object" && data && "output_text" in data && typeof data.output_text === "string") {
    return data.output_text;
  }

  const choices = typeof data === "object" && data && "choices" in data && Array.isArray(data.choices) ? data.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object" || !("message" in choice)) continue;
    const message = choice.message;
    if (!message || typeof message !== "object" || !("content" in message)) continue;
    const content = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          if ("text" in item && typeof item.text === "string") return item.text;
          if ("content" in item && typeof item.content === "string") return item.content;
          return "";
        })
        .join("");
      if (text) return text;
    }
  }

  const output = typeof data === "object" && data && "output" in data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("LLM response did not contain text.");
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function readNumberEnv(key: string, fallback: number): number {
  const value = Number(readOptionalEnv(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeNumberEnv(key: string, fallback: number): number {
  const value = Number(readOptionalEnv(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitizeLlmError(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/tp-[A-Za-z0-9_-]+/g, "tp-***");
}

function isResponseFormatUnsupported(raw: string): boolean {
  return /response_format|json_object/i.test(raw) && /not supported|not valid|unsupported|InvalidParameter/i.test(raw);
}

function isStreamUnsupported(raw: string): boolean {
  return /stream/i.test(raw) && /not supported|unsupported|not valid|InvalidParameter|unknown parameter/i.test(raw);
}

function isThinkingUnsupported(raw: string): boolean {
  return /thinking/i.test(raw) && /not supported|unsupported|not valid|InvalidParameter|unknown parameter|extra inputs/i.test(raw);
}
