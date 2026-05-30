export type ClassTrialDialogueTimeline = {
  mode: "characters" | "segments" | "full";
  frames: string[];
  thinkingText: string;
};

export type ClassTrialDialogueOptions = {
  shortTextMaxLength?: number;
  reducedMotion?: boolean;
  thinkingText?: string;
};

const DEFAULT_SHORT_TEXT_MAX_LENGTH = 36;
const DEFAULT_SEGMENT_MAX_LENGTH = 4;
const DEFAULT_THINKING_TEXT = "正在思考/准备发言。";
const SENTENCE_BOUNDARY = /(?<=[。！？；!?;])\s*/u;
const SOFT_SEGMENT_BOUNDARY = /[，,、：:\s]/u;

export function buildClassTrialDialogueTimeline(
  text: string,
  options: ClassTrialDialogueOptions = {},
): ClassTrialDialogueTimeline {
  const normalized = normalizeDialogueText(text);
  const thinkingText = options.thinkingText ?? DEFAULT_THINKING_TEXT;
  if (!normalized) return { mode: "full", frames: [thinkingText], thinkingText };
  if (options.reducedMotion) return { mode: "full", frames: [normalized], thinkingText };

  const shortTextMaxLength = options.shortTextMaxLength ?? DEFAULT_SHORT_TEXT_MAX_LENGTH;
  if (countDisplayCharacters(normalized) <= shortTextMaxLength) {
    return {
      mode: "characters",
      frames: Array.from(normalized).map((_, index, chars) => chars.slice(0, index + 1).join("")),
      thinkingText,
    };
  }

  const segments = splitDialogueSegments(normalized);
  return {
    mode: "segments",
    frames: segments.map((_, index) => segments.slice(0, index + 1).join("")),
    thinkingText,
  };
}

export function getClassTrialDialogueFrame(timeline: ClassTrialDialogueTimeline, frameIndex: number): string {
  if (frameIndex < 0) return timeline.thinkingText;
  return timeline.frames[Math.min(frameIndex, timeline.frames.length - 1)] ?? timeline.thinkingText;
}

export function getClassTrialDialogueFrameByProgress(
  timeline: ClassTrialDialogueTimeline,
  progress: number,
): string | undefined {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return undefined;
  if (timeline.mode === "full") return timeline.frames.at(-1) ?? timeline.thinkingText;
  const frameCount = timeline.frames.length;
  if (frameCount <= 0) return undefined;
  const frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
  return getClassTrialDialogueFrame(timeline, frameIndex);
}

export function splitDialogueSegments(text: string): string[] {
  const normalized = normalizeDialogueText(text);
  if (!normalized) return [];
  const segments = normalized
    .split(SENTENCE_BOUNDARY)
    .map((segment) => segment.trim())
    .flatMap((segment) => splitLongDialogueSegment(segment, DEFAULT_SEGMENT_MAX_LENGTH))
    .filter(Boolean);
  return segments.length > 0 ? segments : [normalized];
}

function splitLongDialogueSegment(text: string, maxLength: number): string[] {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return [text];

  const segments: string[] = [];
  let cursor = 0;
  while (cursor < chars.length) {
    const remaining = chars.length - cursor;
    if (remaining <= maxLength) {
      segments.push(chars.slice(cursor).join(""));
      break;
    }

    const windowEnd = cursor + maxLength;
    let boundary = -1;
    for (let index = windowEnd - 1; index > cursor + Math.floor(maxLength * 0.55); index -= 1) {
      if (SOFT_SEGMENT_BOUNDARY.test(chars[index] ?? "")) {
        boundary = index + 1;
        break;
      }
    }

    const end = boundary > cursor ? boundary : windowEnd;
    segments.push(chars.slice(cursor, end).join(""));
    cursor = end;
  }

  return segments;
}

function normalizeDialogueText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function countDisplayCharacters(text: string): number {
  return Array.from(text).length;
}
