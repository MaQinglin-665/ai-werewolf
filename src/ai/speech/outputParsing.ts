import { z } from "zod";

import { parseLlmJsonOutput } from "../modelLlms";

const SpeechSchema = z.object({
  speech: z.string().min(1),
});

export function parseSpeechDecision(rawOutput: string): { success: true; speech: string } | { success: false; issue: string } {
  if (looksLikeTransportArtifact(rawOutput)) {
    return { success: false, issue: "LLM speech output contained transport metadata instead of speech." };
  }

  try {
    const candidate = parseLlmJsonOutput(rawOutput);
    const coerced = coerceSpeechPayload(candidate);
    const parsed = SpeechSchema.safeParse(coerced);
    if (parsed.success) {
      return { success: true, speech: parsed.data.speech };
    }
  } catch {
    // Free-speech mode treats malformed JSON as text instead of rejecting it.
  }

  const looseSpeech = extractLooseSpeechField(rawOutput);
  if (looseSpeech) {
    return { success: true, speech: looseSpeech };
  }

  const plainSpeech = coercePlainSpeech(rawOutput);
  if (plainSpeech) {
    return { success: true, speech: plainSpeech };
  }

  return { success: false, issue: "LLM 输出格式不合法。" };
}

function looksLikeTransportArtifact(rawOutput: string): boolean {
  const clean = rawOutput.trim();
  return (
    /^data:\s*[{[]/i.test(clean) ||
    /"object"\s*:\s*"chat\.completion\.chunk"/i.test(clean) ||
    /"system_fingerprint"\s*:|"prompt_tokens"\s*:|"completion_tokens"\s*:/i.test(clean)
  );
}

function coerceSpeechPayload(value: unknown): { speech: string } | undefined {
  if (typeof value === "string") return { speech: value };
  if (!value || typeof value !== "object") return undefined;

  for (const key of ["speech", "message", "text", "utterance", "line"]) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string" && field.trim()) return { speech: field };
  }

  return undefined;
}

function extractLooseSpeechField(rawOutput: string): string | undefined {
  const clean = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const quoted = clean.match(
    /(?:^|[\s{,])["']?speech["']?\s*[:：]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|“([^”]*)”)/i,
  );
  const unclosedQuoted = clean.match(/(?:^|[\s{,])["']?speech["']?\s*[:：]\s*(?:"([^"]*)$|'([^']*)$|“([^”]*)$)/i);
  const unquoted = clean.match(/^(?:发言|speech|输出|回答)\s*[:：]\s*([\s\S]+)$/i);
  const speech = (
    quoted?.[1] ??
    quoted?.[2] ??
    quoted?.[3] ??
    unclosedQuoted?.[1] ??
    unclosedQuoted?.[2] ??
    unclosedQuoted?.[3] ??
    unquoted?.[1]
  )
    ?.replace(/\\n/g, " ")
    .replace(/\\"/g, "\"")
    .trim();
  if (!speech) return undefined;
  return speech;
}

function coercePlainSpeech(rawOutput: string): string | undefined {
  const stripped = rawOutput
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:发言|speech|输出|回答)\s*[:：]\s*/i, "")
    .trim()
    .replace(/^["“”']|["“”']$/g, "");
  if (!stripped) return undefined;
  if (/^[{[]?\s*["']?(?:speech|message|text|utterance|line)["']?\s*[:：]\s*["']?\s*[}\]]?$/i.test(stripped)) {
    return undefined;
  }
  return stripped;
}
