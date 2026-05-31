import type { ClassTrialCharacterId } from "./classTrialTheme";

export const CLASS_TRIAL_OPENING_INTRO_ORDER = [
  "anon",
  "tomori",
  "togami",
  "celestia",
  "enoshima",
  "monokuma",
  "fukawa",
  "kirigiri",
  "naegi",
] as const satisfies readonly ClassTrialCharacterId[];

export type ClassTrialIntroPattern = "shards" | "rings" | "checker" | "scanlines" | "spotlight";
export type ClassTrialIntroAudioMode = "external" | "generated";

export type ClassTrialIntroCharacter = {
  id: (typeof CLASS_TRIAL_OPENING_INTRO_ORDER)[number];
  displayNameJa: string;
  titleJa: string;
  subtitleJa: string;
  portraitUrl: string;
  audioUrl: string;
  themeColor: string;
  accentColor: string;
  pattern: ClassTrialIntroPattern;
  durationMs: number;
  audioMode: ClassTrialIntroAudioMode;
  externalSourceUrl?: string;
  externalSourceRange?: string;
};

export type ClassTrialIntroConfig = {
  id: string;
  version: string;
  characters: ClassTrialIntroCharacter[];
};

export type ClassTrialIntroStatus = {
  available: boolean;
  message: string;
  readyCharacterIds: ClassTrialIntroCharacter["id"][];
  missingCharacterIds: ClassTrialIntroCharacter["id"][];
};

const CLASS_TRIAL_INTRO_PATTERNS: readonly ClassTrialIntroPattern[] = [
  "shards",
  "rings",
  "checker",
  "scanlines",
  "spotlight",
];
const LOCAL_INTRO_ASSET_PREFIX = "/class-trial-pack/intro/";
const DEFAULT_THEME_COLOR = "#f6c94a";
const DEFAULT_ACCENT_COLOR = "#101014";
const DEFAULT_DURATION_MS = 5200;
const MIN_DURATION_MS = 4000;
const MAX_DURATION_MS = 6400;

export function sanitizeClassTrialIntroConfig(value: unknown): ClassTrialIntroConfig | undefined {
  if (!isRecord(value) || !Array.isArray(value.characters)) return undefined;

  const characters = value.characters
    .map(sanitizeClassTrialIntroCharacter)
    .filter((character): character is ClassTrialIntroCharacter => Boolean(character));

  if (!hasConfirmedIntroOrder(characters)) return undefined;

  return {
    id: readBoundedString(value.id, 80) ?? "class-trial-opening-intro",
    version: readBoundedString(value.version, 80) ?? "local",
    characters,
  };
}

export function getClassTrialIntroStatus(config: ClassTrialIntroConfig | undefined): ClassTrialIntroStatus {
  if (!config) {
    return {
      available: false,
      message: "未找到本地开场片头配置。请准备 local-assets/class-trial-pack/intro/intro.json。",
      readyCharacterIds: [],
      missingCharacterIds: [...CLASS_TRIAL_OPENING_INTRO_ORDER],
    };
  }

  const readyCharacterIds = config.characters
    .filter((character) => Boolean(character.portraitUrl && character.audioUrl))
    .map((character) => character.id);
  const readySet = new Set(readyCharacterIds);
  const missingCharacterIds = CLASS_TRIAL_OPENING_INTRO_ORDER.filter((id) => !readySet.has(id));

  return {
    available: missingCharacterIds.length === 0,
    message:
      missingCharacterIds.length === 0
        ? "本地开场片头配置已就绪。"
        : `本地开场片头配置缺少 ${missingCharacterIds.length} 个角色。`,
    readyCharacterIds,
    missingCharacterIds,
  };
}

export function buildClassTrialIntroSourcePath(segments: string[]): string | undefined {
  if (segments.length === 0) return undefined;
  if (segments.some((segment) => isUnsafePathSegment(segment))) return undefined;

  return `/class-trial-pack/${segments.join("/")}`;
}

function sanitizeClassTrialIntroCharacter(value: unknown): ClassTrialIntroCharacter | undefined {
  if (!isRecord(value)) return undefined;

  const id = readClassTrialIntroCharacterId(value.id);
  const displayNameJa = readBoundedString(value.displayNameJa, 40);
  const titleJa = readBoundedString(value.titleJa, 80);
  const subtitleJa = readBoundedString(value.subtitleJa, 160);
  const portraitUrl = readLocalIntroAssetUrl(value.portraitUrl);
  const audioUrl = readLocalIntroAssetUrl(value.audioUrl);
  const pattern = readClassTrialIntroPattern(value.pattern);
  const audioMode = readClassTrialIntroAudioMode(value.audioMode);

  if (!id || !displayNameJa || !titleJa || !subtitleJa || !portraitUrl || !audioUrl || !pattern || !audioMode) {
    return undefined;
  }

  return {
    id,
    displayNameJa,
    titleJa,
    subtitleJa,
    portraitUrl,
    audioUrl,
    themeColor: readHexColor(value.themeColor) ?? DEFAULT_THEME_COLOR,
    accentColor: readHexColor(value.accentColor) ?? DEFAULT_ACCENT_COLOR,
    pattern,
    durationMs: readDurationMs(value.durationMs),
    audioMode,
    ...optionalStringProperty("externalSourceUrl", readBoundedString(value.externalSourceUrl, 260)),
    ...optionalStringProperty("externalSourceRange", readBoundedString(value.externalSourceRange, 40)),
  };
}

function hasConfirmedIntroOrder(characters: ClassTrialIntroCharacter[]): boolean {
  return (
    characters.length === CLASS_TRIAL_OPENING_INTRO_ORDER.length &&
    characters.every((character, index) => character.id === CLASS_TRIAL_OPENING_INTRO_ORDER[index])
  );
}

function readClassTrialIntroCharacterId(value: unknown): ClassTrialIntroCharacter["id"] | undefined {
  return typeof value === "string" && CLASS_TRIAL_OPENING_INTRO_ORDER.includes(value as ClassTrialIntroCharacter["id"])
    ? (value as ClassTrialIntroCharacter["id"])
    : undefined;
}

function readClassTrialIntroPattern(value: unknown): ClassTrialIntroPattern | undefined {
  return typeof value === "string" && CLASS_TRIAL_INTRO_PATTERNS.includes(value as ClassTrialIntroPattern)
    ? (value as ClassTrialIntroPattern)
    : undefined;
}

function readClassTrialIntroAudioMode(value: unknown): ClassTrialIntroAudioMode | undefined {
  return value === "external" || value === "generated" ? value : undefined;
}

function readDurationMs(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DURATION_MS;

  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(number)));
}

function readLocalIntroAssetUrl(value: unknown): string | undefined {
  const url = readBoundedString(value, 240);
  if (!url?.startsWith(LOCAL_INTRO_ASSET_PREFIX)) return undefined;

  const relativePath = url.slice(LOCAL_INTRO_ASSET_PREFIX.length);
  return hasSafeLocalIntroAssetSegments(relativePath) ? url : undefined;
}

function readHexColor(value: unknown): string | undefined {
  const color = readBoundedString(value, 16);
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

function readBoundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return clean || undefined;
}

function optionalStringProperty<Key extends string>(key: Key, value: string | undefined): Partial<Record<Key, string>> {
  return value ? { [key]: value } as Record<Key, string> : {};
}

function isUnsafePathSegment(segment: string): boolean {
  return (
    segment.length === 0 ||
    segment !== segment.trim() ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\")
  );
}

function hasSafeLocalIntroAssetSegments(relativePath: string): boolean {
  const segments = relativePath.split("/");
  if (segments.length === 0) return false;

  return segments.every((segment) => {
    if (isUnsafePathSegment(segment)) return false;

    try {
      const decodedSegment = decodeURIComponent(segment);
      return !isUnsafePathSegment(decodedSegment);
    } catch {
      return false;
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
