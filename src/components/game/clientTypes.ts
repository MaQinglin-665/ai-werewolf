import type { AiFriendRuntimeTtsConfig, AvailableHumanAction, HumanGameView } from "@/game/types";
import type { AiFriendConfig } from "@/game/types";

export type CommandPayload =
  | { type: "wolfKill"; targetSeatId: number }
  | { type: "guardAction"; targetSeatId?: number }
  | { type: "seerCheck"; targetSeatId: number }
  | { type: "witchAction"; mode: "save" | "poison" | "skip"; targetSeatId?: number }
  | { type: "wolfBeautyCharm"; targetSeatId?: number }
  | { type: "speak"; message: string }
  | { type: "lastWords"; message: string }
  | { type: "vote"; targetSeatId?: number }
  | { type: "hunterReveal"; reveal: boolean }
  | { type: "hunterShoot"; targetSeatId?: number }
  | { type: "wolfKingShoot"; targetSeatId?: number }
  | { type: "whiteWolfKingExplode"; targetSeatId: number }
  | { type: "knightDuel"; targetSeatId?: number }
  | { type: "sheriffNominate"; run: boolean }
  | { type: "sheriffSpeech"; message: string }
  | { type: "sheriffWithdraw"; withdraw: boolean }
  | { type: "sheriffVote"; targetSeatId?: number }
  | { type: "sheriffHandoff"; targetSeatId?: number }
  | { type: "continue" };

export type SpeechItem = HumanGameView["tableSummary"]["recentSpeeches"][number];

export type LiveAiSpeech = {
  gameId: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  text: string;
};

export type AiSpeechAudioStatus = {
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  state: "loading" | "playing" | "paused";
  text: string;
};

export type SeatVoiceState = AiSpeechAudioStatus["state"] | "generating";

export type SeatVoiceActivity = {
  seatId: number;
  state: SeatVoiceState;
};

export type HostAudioStatus = {
  key: string;
};

export type AiSpeechAudioTextCue = {
  gameId: string;
  speechKey: string;
  speaker: NonNullable<SpeechItem["speaker"]>;
  voicePersonaName?: string;
  ttsVoice?: string;
  ttsConfig?: AiFriendRuntimeTtsConfig;
  text: string;
};

export type SeerCheckAction = Extract<AvailableHumanAction, { type: "seerCheck" }>;
export type WitchAction = Extract<AvailableHumanAction, { type: "witchAction" }>;
export type WolfBeautyCharmAction = Extract<AvailableHumanAction, { type: "wolfBeautyCharm" }>;
export type VoteAction = Extract<AvailableHumanAction, { type: "vote" }>;
export type KnightDuelAction = Extract<AvailableHumanAction, { type: "knightDuel" }>;
export type SheriffVoteAction = Extract<AvailableHumanAction, { type: "sheriffVote" }>;
export type ActionTargetView = SeerCheckAction["targets"][number];
export type HumanSpeechActionType = Extract<AvailableHumanAction["type"], "speak" | "lastWords" | "sheriffSpeech">;
export type BoardOption = HumanGameView["board"];
export type AiFriendOption = AiFriendConfig & {
  isDefault: boolean;
  basePersonaName: string;
  basePersonaModelLabel?: string;
  basePersonaLabel: string;
};
export type AiLineupPreviewItem = {
  seatId: number;
  nickname: string;
  personaName?: string;
  modelLabel?: string;
  avatarDataUrl?: string;
  ttsVoice?: string;
  ttsConfig?: HumanGameView["seats"][number]["ttsConfig"];
  isHuman: boolean;
  autoFilled: boolean;
};
export type HumanSeatMode = "random" | "fixed" | "none";
export type VoiceInputState = "idle" | "listening" | "processing";

export type BrowserSpeechRecognitionAlternative = {
  transcript?: string;
};

export type BrowserSpeechRecognitionResult = {
  isFinal?: boolean;
  0?: BrowserSpeechRecognitionAlternative;
};

export type BrowserSpeechRecognitionEvent = Event & {
  resultIndex?: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};

export type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
  message?: string;
};

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export type BrowserSpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
