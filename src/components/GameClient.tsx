"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  AiFriendConfig,
  AiRuntimeMode,
  HumanGameView,
} from "@/game/types";
import {
  GlossaryOverlay,
  IdentityBookOverlay,
  IdiotRevealOverlay,
  LandingPanel,
  PhaseCurtain,
  RoleIntroOverlay,
  RoomHeader,
  buildIdiotRevealCue,
} from "./game/GamePanels";
import {
  getAutoAdvanceDelay,
  getLatestStreamableAiSpeech,
  speechStreamKey,
} from "./game/autoAdvance";
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  buildAiSpeechAudioLoadingStatus,
  buildAiSpeechAudioPlaybackStatusPatch,
  buildClassTrialVoicePrewarmCue,
  createStreamingAiSpeechTtsQueue,
  estimateClassTrialTextFallbackDurationMs,
  findNewAiSpeech,
  getClassTrialFinalTextHoldMs,
  getOrCreatePreparedAiSpeechAudio,
  getSeatTtsConfig,
  prepareAiSpeechAudio,
  shouldCommitAiSpeechAudioPlaybackStatus,
  shouldMarkAiSpeechAudioUnavailable,
  shouldUseClassTrialTextFallback,
  waitForAudioReady,
  type AiSpeechAudioCue,
  type PreparedAiSpeechAudioCache,
} from "./game/aiSpeechAudio";
import {
  buildClassTrialLookaheadCompletedSpeechKeys,
  isMatchingClassTrialAudioLookahead,
  shouldAdvanceClassTrialLookaheadToSpeech,
  shouldStartClassTrialAudioLookahead,
  type ClassTrialAudioLookaheadRun,
} from "./game/classTrialAudioLookahead";
import {
  getClassTrialIntroStatus,
  sanitizeClassTrialIntroConfig,
  type ClassTrialIntroConfig,
} from "./game/classTrialIntro";
import {
  prepareClassTrialIntroAudio,
  type ClassTrialIntroAudioPreparation,
} from "./game/classTrialIntroAudio";
import {
  buildThemedHostAudioCue,
  findLatestUnplayedPublicEvent,
  hostClipPreDelayMs,
  hostClipSrc,
  type HostAudioCue,
} from "./game/hostAudioCues";
import {
  buildAiFriendOptions,
  buildRuntimeAiLlmConfigs,
  buildRuntimeAiTtsConfigs,
  getDefaultSelectedAiFriendIds,
  readStoredAiFriendLlmSecrets,
  readStoredAiRuntimeMode,
  readStoredCustomAiFriends,
  readStoredSelectedAiFriendIds,
  resolveEffectiveAiRuntimeMode,
  resolveSelectedAiFriends,
  writeStoredAiRuntimeMode,
  type AiFriendLlmSecretMap,
} from "./game/aiFriendStorage";
import { getDefaultBoardOptions, getInitialBoardSelection, resolveBoardSelectionToggle } from "./game/boardSelectionModel";
import {
  buildStreamingContinueContext,
  createGameView,
  loadGameView,
  submitContinueCommand,
  submitGameCommand,
} from "./game/gameClientRequests";
import {
  CLASS_TRIAL_DEFAULT_BOARD_ID,
  CLASS_TRIAL_FIXED_SEAT_ROLES,
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  buildClassTrialAiFriends,
  getClassTrialPackStatus,
  getClassTrialPersonasStatus,
  getClassTrialThemeStatusMessage,
  parseClassTrialThemeMode,
  sanitizeClassTrialPersonas,
  type ClassTrialPackManifest,
  type ClassTrialPersonasFile,
  type ClassTrialThemeMode,
} from "./game/classTrialTheme";
import type { IdiotRevealCue, PhaseCurtainCue } from "./game/GamePanels";
import { getClassTrialFlowModel } from "./game/classTrialFlowModel";
import { GameClientLoadedSurface } from "./game/GameClientLoadedSurface";
import { getClassTrialOpeningNightCurtainCue, getThemedPhaseCurtainCue } from "./game/phaseCurtainModel";
import { buildLandingLineupPreview } from "./game/landingLineupPreview";
import {
  clearCurrentGameId,
  getRecentGameIdsServerSnapshot,
  readRecentGameIds,
  rememberRecentGameId,
  subscribeRecentGameIds,
} from "./game/recentGamesStore";
import { submitStreamingContinue } from "./game/streamingContinue";
import type {
  AiSpeechAudioStatus,
  AiSpeechAudioTextCue,
  BoardOption,
  ClassTrialManualAudioPlayback,
  CommandPayload,
  HumanSeatMode,
  HostAudioStatus,
  LiveAiSpeech,
} from "./game/clientTypes";

const HOST_AUDIO_ENABLED_KEY = "ai-werewolf-host-audio-enabled";
const AI_SPEECH_AUDIO_ENABLED_KEY = "ai-werewolf-ai-speech-audio-enabled";
const AI_SPEECH_AUDIO_MAX_ATTEMPTS = 1;
const DEFAULT_BOARD_OPTIONS = getDefaultBoardOptions();
const DEFAULT_BOARD_SELECTION = getInitialBoardSelection(DEFAULT_BOARD_OPTIONS);
const EMPTY_CUSTOM_AI_FRIENDS: AiFriendConfig[] = [];
const IDIOT_REVEAL_EVENT_TYPES = new Set(["IDIOT_REVEALED"]);

type ManualAiSpeechPlaybackState = Omit<ClassTrialManualAudioPlayback, "onPlay">;
type ManualAiSpeechPlaybackRequest = {
  audio: HTMLAudioElement;
  resolve: () => void;
  speechKey: string;
};

function randomSeatId(seatCount: number): number {
  return 1 + Math.floor(Math.random() * seatCount);
}

async function tryPlayHostClip(audio: HTMLAudioElement, clip: string): Promise<void> {
  const sources = clip.endsWith(".mp3") ? [clip, clip.replace(/\.mp3$/, ".wav")] : [clip];
  let lastError: unknown;

  for (const source of sources) {
    try {
      audio.src = source;
      audio.load();
      await waitForAudioReady(audio);
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`音频加载失败：${source}`));
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function buildAiSpeechAudioTextCue(cue: AiSpeechAudioCue): AiSpeechAudioTextCue | undefined {
  const speaker = cue.speech.speaker;
  if (!speaker) return undefined;
  return {
    gameId: cue.gameId,
    speechKey: cue.key,
    speaker,
    voicePersonaName: cue.voicePersonaName,
    ttsVoice: cue.ttsVoice,
    ttsConfig: cue.ttsConfig,
    roleCard: cue.roleCard,
    text: cue.speech.message,
  };
}

export function GameClient() {
  const [game, setGame] = useState<HumanGameView | null>(null);
  const [boards, setBoards] = useState<BoardOption[]>(DEFAULT_BOARD_OPTIONS);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(DEFAULT_BOARD_SELECTION.selectedBoardId);
  const [humanSeatMode, setHumanSeatMode] = useState<HumanSeatMode>("random");
  const [selectedHumanSeatId, setSelectedHumanSeatId] = useState<number | null>(DEFAULT_BOARD_SELECTION.selectedHumanSeatId);
  const [customAiFriends, setCustomAiFriends] = useState<AiFriendConfig[]>(EMPTY_CUSTOM_AI_FRIENDS);
  const [aiLlmSecrets, setAiLlmSecrets] = useState<AiFriendLlmSecretMap>({});
  const [selectedAiFriendIds, setSelectedAiFriendIds] = useState<string[]>(getDefaultSelectedAiFriendIds);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("mock");
  const [classTrialThemeMode, setClassTrialThemeMode] = useState<ClassTrialThemeMode>("default");
  const [classTrialPackManifest, setClassTrialPackManifest] = useState<ClassTrialPackManifest | undefined>();
  const [classTrialPersonas, setClassTrialPersonas] = useState<ClassTrialPersonasFile | undefined>();
  const [classTrialIntroConfig, setClassTrialIntroConfig] = useState<ClassTrialIntroConfig | undefined>();
  const [classTrialIntroAudioPreparation, setClassTrialIntroAudioPreparation] =
    useState<ClassTrialIntroAudioPreparation | null>(null);
  const [classTrialIntroGameId, setClassTrialIntroGameId] = useState<string | null>(null);
  const [completedClassTrialIntroGameId, setCompletedClassTrialIntroGameId] = useState<string | null>(null);
  const [completedClassTrialOpeningNightCurtainGameId, setCompletedClassTrialOpeningNightCurtainGameId] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleIntroGameId, setRoleIntroGameId] = useState<string | null>(null);
  const [phaseCurtain, setPhaseCurtain] = useState<PhaseCurtainCue | null>(null);
  const [idiotReveal, setIdiotReveal] = useState<IdiotRevealCue | null>(null);
  const [identityBookOpen, setIdentityBookOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [hostAudioEnabled, setHostAudioEnabled] = useState(false);
  const [aiSpeechAudioEnabled, setAiSpeechAudioEnabled] = useState(false);
  const [liveAiSpeech, setLiveAiSpeech] = useState<LiveAiSpeech | null>(null);
  const [hostAudioStatus, setHostAudioStatus] = useState<HostAudioStatus | null>(null);
  const [aiSpeechAudioStatus, setAiSpeechAudioStatus] = useState<AiSpeechAudioStatus | null>(null);
  const [aiSpeechAudioUnavailable, setAiSpeechAudioUnavailable] = useState(false);
  const [manualAiSpeechPlayback, setManualAiSpeechPlayback] = useState<ManualAiSpeechPlaybackState | null>(null);
  const [bufferedClassTrialContinueKey, setBufferedClassTrialContinueKey] = useState<string | null>(null);
  const [pendingCommandType, setPendingCommandType] = useState<CommandPayload["type"] | null>(null);
  const [hostAudioCompletionTick, setHostAudioCompletionTick] = useState(0);
  const [aiSpeechAudioCompletionTick, setAiSpeechAudioCompletionTick] = useState(0);
  const lastCurtainKeyRef = useRef<string | null>(null);
  const activeIdiotRevealKeyRef = useRef<string | null>(null);
  const completedIdiotRevealKeysRef = useRef<Set<string>>(new Set());
  const idiotRevealTimerRef = useRef<number | null>(null);
  const autoReadGameIdRef = useRef<string | null>(null);
  const autoReadSpeechKeysRef = useRef<Set<string>>(new Set());
  const lastHostAudioKeyRef = useRef<string | null>(null);
  const completedHostAudioKeysRef = useRef<Set<string>>(new Set());
  const aiSpeechAudioGameIdRef = useRef<string | null>(null);
  const lastAiSpeechAudioKeyRef = useRef<string | null>(null);
  const completedAiSpeechAudioKeysRef = useRef<Set<string>>(new Set());
  const streamingAiSpeechAudioKeysRef = useRef<Set<string>>(new Set());
  const prewarmedClassTrialVoiceKeysRef = useRef<Set<string>>(new Set());
  const textFallbackAiSpeechKeysRef = useRef<Set<string>>(new Set());
  const aiSpeechAudioAttemptCountsRef = useRef<Map<string, number>>(new Map());
  const hostAudioRef = useRef<HTMLAudioElement | null>(null);
  const hostAudioRunRef = useRef(0);
  const aiSpeechAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiSpeechAudioRunRef = useRef(0);
  const lastAiSpeechAudioStatusCommitMsRef = useRef<number | null>(null);
  const manualAiSpeechPlaybackRef = useRef<ManualAiSpeechPlaybackRequest | null>(null);
  const preparedAiSpeechAudioRef = useRef<PreparedAiSpeechAudioCache>(new Map());
  const bufferedClassTrialContinueRef = useRef<ClassTrialAudioLookaheadRun<HumanGameView> | null>(null);
  const recentGameIds = useSyncExternalStore(subscribeRecentGameIds, readRecentGameIds, getRecentGameIdsServerSnapshot);
  const effectiveAiSpeechAudioEnabled = aiSpeechAudioEnabled && !aiSpeechAudioUnavailable;
  const aiFriendOptions = useMemo(() => buildAiFriendOptions(customAiFriends), [customAiFriends]);
  const selectedAiFriends = useMemo(
    () => resolveSelectedAiFriends(aiFriendOptions, selectedAiFriendIds),
    [aiFriendOptions, selectedAiFriendIds],
  );
  const effectiveAiRuntimeMode = useMemo(
    () => resolveEffectiveAiRuntimeMode(aiRuntimeMode, classTrialThemeMode),
    [aiRuntimeMode, classTrialThemeMode],
  );
  const runtimeAiLlmConfigs = useMemo(
    () => (effectiveAiRuntimeMode === "llm" ? buildRuntimeAiLlmConfigs(customAiFriends, aiLlmSecrets) : undefined),
    [aiLlmSecrets, effectiveAiRuntimeMode, customAiFriends],
  );
  const runtimeAiTtsConfigs = useMemo(
    () => buildRuntimeAiTtsConfigs(customAiFriends, aiLlmSecrets),
    [aiLlmSecrets, customAiFriends],
  );
  const selectedBoard = useMemo(
    () => (selectedBoardId ? boards.find((board) => board.id === selectedBoardId) : undefined),
    [boards, selectedBoardId],
  );
  const aiLineupPreview = useMemo(
    () =>
      buildLandingLineupPreview({
        seatCount: selectedBoard?.seatCount ?? 0,
        humanSeatMode,
        selectedHumanSeatId,
        selectedAiFriends,
      }),
    [humanSeatMode, selectedAiFriends, selectedBoard?.seatCount, selectedHumanSeatId],
  );
  const classTrialPackStatus = useMemo(() => getClassTrialPackStatus(classTrialPackManifest), [classTrialPackManifest]);
  const classTrialPersonasStatus = useMemo(() => getClassTrialPersonasStatus(classTrialPersonas), [classTrialPersonas]);
  const classTrialStatusMessage = useMemo(
    () => getClassTrialThemeStatusMessage(classTrialPackStatus, classTrialPersonasStatus),
    [classTrialPackStatus, classTrialPersonasStatus],
  );
  const classTrialIntroStatus = useMemo(
    () => getClassTrialIntroStatus(classTrialIntroConfig),
    [classTrialIntroConfig],
  );
  const classTrialIntroMessage = classTrialIntroAudioPreparation
    ? classTrialIntroAudioPreparation.message
    : classTrialIntroStatus.message;
  const classTrialAiFriends = useMemo(() => buildClassTrialAiFriends(classTrialPersonas), [classTrialPersonas]);
  const classTrialLocalThemeSelected = classTrialThemeMode === "class-trial";
  const classTrialThemeActive = classTrialThemeMode === "class-trial" && Boolean(game);
  const classTrialFlow = useMemo(
    () =>
      getClassTrialFlowModel({
        game,
        classTrialThemeActive,
        classTrialIntroGameId,
        completedClassTrialIntroGameId,
        completedClassTrialOpeningNightCurtainGameId,
        roleIntroGameId,
      }),
    [
      classTrialThemeActive,
      classTrialIntroGameId,
      completedClassTrialIntroGameId,
      completedClassTrialOpeningNightCurtainGameId,
      game,
      roleIntroGameId,
    ],
  );
  const classTrialIntroPending = classTrialFlow.introPending;

  const selectBoard = useCallback(
    (boardId: string) => {
      const nextSelection = resolveBoardSelectionToggle({
        boards,
        boardId,
        selectedBoardId,
        humanSeatMode,
        selectedHumanSeatId,
        pickRandomSeat: randomSeatId,
      });
      setSelectedBoardId(nextSelection.selectedBoardId);
      setHumanSeatMode(nextSelection.humanSeatMode);
      setSelectedHumanSeatId(nextSelection.selectedHumanSeatId);
    },
    [boards, humanSeatMode, selectedBoardId, selectedHumanSeatId],
  );

  const selectRandomHumanSeat = useCallback(() => {
    if (!selectedBoard) return;
    setHumanSeatMode("random");
    setSelectedHumanSeatId(randomSeatId(selectedBoard.seatCount));
  }, [selectedBoard]);

  const selectFixedHumanSeat = useCallback((seatId: number) => {
    setHumanSeatMode("fixed");
    setSelectedHumanSeatId(seatId);
  }, []);

  const selectNoHumanSeat = useCallback(() => {
    setHumanSeatMode("none");
    setSelectedHumanSeatId(null);
  }, []);

  const rememberGame = useCallback((gameId: string) => {
    rememberRecentGameId(gameId);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHostAudioEnabled(window.localStorage.getItem(HOST_AUDIO_ENABLED_KEY) === "true");
      setAiSpeechAudioEnabled(window.localStorage.getItem(AI_SPEECH_AUDIO_ENABLED_KEY) === "true");
      setCustomAiFriends(readStoredCustomAiFriends());
      setAiLlmSecrets(readStoredAiFriendLlmSecrets());
      setSelectedAiFriendIds(readStoredSelectedAiFriendIds());
      setAiRuntimeMode(readStoredAiRuntimeMode());
      setClassTrialThemeMode(parseClassTrialThemeMode(window.localStorage.getItem(CLASS_TRIAL_THEME_MODE_STORAGE_KEY)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/manifest.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((manifest: ClassTrialPackManifest | undefined) => {
        if (!cancelled) setClassTrialPackManifest(manifest);
      })
      .catch(() => {
        if (!cancelled) setClassTrialPackManifest(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/personas.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        if (!cancelled) setClassTrialPersonas(sanitizeClassTrialPersonas(raw));
      })
      .catch(() => {
        if (!cancelled) setClassTrialPersonas(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/class-trial-pack/intro/intro.json")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        if (!cancelled) setClassTrialIntroConfig(sanitizeClassTrialIntroConfig(raw));
      })
      .catch(() => {
        if (!cancelled) setClassTrialIntroConfig(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (classTrialThemeMode !== "class-trial" || !classTrialIntroConfig) {
      void Promise.resolve().then(() => {
        if (!cancelled) setClassTrialIntroAudioPreparation(null);
      });
      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setClassTrialIntroAudioPreparation({
            ready: false,
            message: "开场片头音频准备中。",
            readyCharacterIds: [],
            failedCharacterIds: [],
          });
        }
        return prepareClassTrialIntroAudio(classTrialIntroConfig);
      })
      .then((preparation) => {
        if (!cancelled) setClassTrialIntroAudioPreparation(preparation);
      })
      .catch(() => {
        if (!cancelled) setClassTrialIntroAudioPreparation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [classTrialIntroConfig, classTrialThemeMode]);

  useEffect(() => {
    let cancelled = false;
    if (typeof fetch !== "function") return;
    void fetch("/api/games/boards")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("读取板子失败。"))))
      .then((data: { boards?: BoardOption[] }) => {
        if (cancelled) return;
        const nextBoards = data.boards ?? [];
        setBoards(nextBoards);
        setSelectedBoardId((current) => current ?? nextBoards[0]?.id ?? null);
        setSelectedHumanSeatId((current) => current ?? (nextBoards[0] ? randomSeatId(nextBoards[0].seatCount) : null));
      })
      .catch(() => {
        if (!cancelled) setError("读取板子列表失败。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearBufferedClassTrialContinue = useCallback(() => {
    bufferedClassTrialContinueRef.current = null;
    setBufferedClassTrialContinueKey(null);
  }, []);

  const stopHostAudio = useCallback(() => {
    hostAudioRunRef.current += 1;
    if (hostAudioRef.current) {
      hostAudioRef.current.pause();
      hostAudioRef.current.src = "";
      hostAudioRef.current = null;
    }
    setHostAudioStatus(null);
  }, []);

  const stopAiSpeechAudio = useCallback(() => {
    aiSpeechAudioRunRef.current += 1;
    manualAiSpeechPlaybackRef.current?.resolve();
    manualAiSpeechPlaybackRef.current = null;
    if (aiSpeechAudioRef.current) {
      aiSpeechAudioRef.current.pause();
      aiSpeechAudioRef.current.src = "";
      aiSpeechAudioRef.current = null;
    }
    setManualAiSpeechPlayback(null);
    lastAiSpeechAudioStatusCommitMsRef.current = null;
    setAiSpeechAudioStatus(null);
  }, []);

  const markAiSpeechAudioUnavailable = useCallback(
    (error: unknown, cue?: Pick<AiSpeechAudioTextCue, "roleCard"> | Pick<AiSpeechAudioCue, "roleCard">) => {
      if (!shouldMarkAiSpeechAudioUnavailable(error, cue)) return false;
      setAiSpeechAudioUnavailable(true);
      streamingAiSpeechAudioKeysRef.current.clear();
      preparedAiSpeechAudioRef.current.clear();
      clearBufferedClassTrialContinue();
      stopAiSpeechAudio();
      return true;
    },
    [clearBufferedClassTrialContinue, stopAiSpeechAudio],
  );

  const pauseAiSpeechAudio = useCallback(() => {
    const audio = aiSpeechAudioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
    setAiSpeechAudioStatus((current) => (current ? { ...current, state: "paused" } : current));
  }, []);

  const resumeAiSpeechAudio = useCallback(async () => {
    const audio = aiSpeechAudioRef.current;
    if (!audio || !audio.paused) return;
    try {
      await audio.play();
      setAiSpeechAudioStatus((current) => (current ? { ...current, state: "playing" } : current));
    } catch (audioError) {
      console.info(audioError instanceof Error ? audioError.message : "AI 发言音频恢复播放失败。");
    }
  }, []);

  const skipAiSpeechAudio = useCallback(() => {
    const speechKey = aiSpeechAudioStatus?.speechKey ?? lastAiSpeechAudioKeyRef.current;
    if (speechKey) {
      completedAiSpeechAudioKeysRef.current.add(speechKey);
      aiSpeechAudioAttemptCountsRef.current.delete(speechKey);
      streamingAiSpeechAudioKeysRef.current.delete(speechKey);
    }
    stopAiSpeechAudio();
    setAiSpeechAudioCompletionTick((tick) => tick + 1);
  }, [aiSpeechAudioStatus?.speechKey, stopAiSpeechAudio]);

  const toggleHostAudio = useCallback(() => {
    setHostAudioEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(HOST_AUDIO_ENABLED_KEY, String(next));
      if (next) {
        lastHostAudioKeyRef.current = null;
      } else {
        stopHostAudio();
      }
      return next;
    });
  }, [stopHostAudio]);

  const toggleAiSpeechAudio = useCallback(() => {
    setAiSpeechAudioEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(AI_SPEECH_AUDIO_ENABLED_KEY, String(next));
      if (next) {
        setAiSpeechAudioUnavailable(false);
        lastAiSpeechAudioKeyRef.current = null;
      } else {
        streamingAiSpeechAudioKeysRef.current.clear();
        prewarmedClassTrialVoiceKeysRef.current.clear();
        preparedAiSpeechAudioRef.current.clear();
        clearBufferedClassTrialContinue();
        stopAiSpeechAudio();
      }
      return next;
    });
  }, [clearBufferedClassTrialContinue, stopAiSpeechAudio]);

  const selectClassTrialThemeMode = useCallback((mode: ClassTrialThemeMode) => {
    setClassTrialThemeMode(mode);
    window.localStorage.setItem(CLASS_TRIAL_THEME_MODE_STORAGE_KEY, mode);
    if (mode === "class-trial") {
      setAiRuntimeMode("llm");
      writeStoredAiRuntimeMode("llm");
    }
  }, []);

  const resumeManualAiSpeechPlayback = useCallback(() => {
    const pending = manualAiSpeechPlaybackRef.current;
    if (!pending) return;
    setManualAiSpeechPlayback((current) =>
      current?.speechKey === pending.speechKey ? { ...current, playing: true } : current,
    );
    void pending.audio
      .play()
      .then(() => {
        if (manualAiSpeechPlaybackRef.current === pending) {
          manualAiSpeechPlaybackRef.current = null;
        }
        setManualAiSpeechPlayback((current) => (current?.speechKey === pending.speechKey ? null : current));
        setAiSpeechAudioStatus((current) =>
          current?.speechKey === pending.speechKey ? { ...current, state: "playing" } : current,
        );
        pending.resolve();
      })
      .catch((audioError) => {
        const message = audioError instanceof Error ? audioError.message : "浏览器仍然没有允许播放语音。";
        console.info(message);
        setManualAiSpeechPlayback((current) =>
          current?.speechKey === pending.speechKey ? { ...current, errorMessage: message, playing: false } : current,
        );
      });
  }, []);

  const playHostAudioCue = useCallback(
    async (cue: HostAudioCue, runId: number) => {
      setHostAudioStatus({ key: cue.key });
      for (const clip of cue.clips) {
        if (hostAudioRunRef.current !== runId) return;
        const preDelayMs = hostClipPreDelayMs(clip);
        if (preDelayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, preDelayMs));
          if (hostAudioRunRef.current !== runId) return;
        }
        const source = hostClipSrc(clip);
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.volume = typeof clip === "string" ? 0.92 : (clip.volume ?? 0.92);
        audio.playbackRate = typeof clip === "string" ? 1 : (clip.playbackRate ?? 1);
        hostAudioRef.current = audio;

        try {
          await tryPlayHostClip(audio, source);
        } catch {
          console.info(`主持音频未找到或被浏览器拦截：${source}`);
          return;
        }
      }
    },
    [],
  );

  const loadAiSpeechAudioUrl = useCallback(async (cue: AiSpeechAudioTextCue): Promise<string> => {
    const response = await fetch("/api/ai-speech-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      const message = data.error ?? "AI 发言音频生成失败。";
      if (response.status === 503 && cue.roleCard?.theme !== "class-trial") {
        throw new AiSpeechAudioUnavailableError(message);
      }
      throw new Error(message);
    }
    return data.url;
  }, []);

  const loadAiSpeechAudioElement = useCallback(
    async (cue: AiSpeechAudioTextCue): Promise<HTMLAudioElement> => {
      const url = await loadAiSpeechAudioUrl(cue);
      return prepareAiSpeechAudio(url);
    },
    [loadAiSpeechAudioUrl],
  );

  const prepareAiSpeechAudioText = useCallback(
    (cue: AiSpeechAudioTextCue, runId: number): Promise<HTMLAudioElement> => {
      const publishPreparationStatus = (preparationStage: AiSpeechAudioStatus["preparationStage"]) => {
        if (aiSpeechAudioRunRef.current !== runId) return;
        setAiSpeechAudioStatus((current) => {
          if (current?.state === "playing" && current.speechKey !== cue.speechKey) return current;
          return buildAiSpeechAudioLoadingStatus(cue, { preparationStage });
        });
      };

      publishPreparationStatus("queued");
      const prepared = getOrCreatePreparedAiSpeechAudio({
        prepared: preparedAiSpeechAudioRef.current,
        cue,
        load: async (audioCue) => {
          publishPreparationStatus("generating");
          return loadAiSpeechAudioElement(audioCue);
        },
      });
      if (prepared.reused) publishPreparationStatus("generating");

      return prepared.promise.then((audio) => {
        publishPreparationStatus("ready");
        return audio;
      });
    },
    [loadAiSpeechAudioElement],
  );

  const startBufferedClassTrialContinue = useCallback(
    (sourceCue: AiSpeechAudioTextCue, runId: number) => {
      if (!game || sourceCue.gameId !== game.id) return;
      if (
        !shouldStartClassTrialAudioLookahead({
          enabled: effectiveAiSpeechAudioEnabled,
          classTrialThemeActive,
          roleIntroActive: roleIntroGameId === game.id,
          availableActions: game.availableActions,
          sourceSpeechKey: sourceCue.speechKey,
          activeBufferedKey: bufferedClassTrialContinueRef.current?.sourceSpeechKey ?? null,
        })
      ) {
        return;
      }

      const completedSpeechKeys = buildClassTrialLookaheadCompletedSpeechKeys(
        completedAiSpeechAudioKeysRef.current,
        sourceCue.speechKey,
      );
      const promise = submitContinueCommand({
        gameId: game.id,
        aiRuntimeMode: effectiveAiRuntimeMode,
        aiLlmConfigs: runtimeAiLlmConfigs,
      }).then(async (firstLookaheadView) => {
        let nextView = firstLookaheadView;
        const firstCue = buildAiSpeechAudioCue(nextView, completedSpeechKeys, runtimeAiTtsConfigs);
        if (
          shouldAdvanceClassTrialLookaheadToSpeech({
            enabled: effectiveAiSpeechAudioEnabled,
            classTrialThemeActive,
            roleIntroActive: roleIntroGameId === nextView.id,
            phase: nextView.phase,
            currentSpeakerSeatId: nextView.currentSpeakerSeatId,
            availableActions: nextView.availableActions,
            hasPendingSpeechCue: Boolean(firstCue),
          }) &&
          aiSpeechAudioRunRef.current === runId &&
          bufferedClassTrialContinueRef.current?.sourceSpeechKey === sourceCue.speechKey
        ) {
          nextView = await submitContinueCommand({
            gameId: game.id,
            aiRuntimeMode: effectiveAiRuntimeMode,
            aiLlmConfigs: runtimeAiLlmConfigs,
          });
        }

        if (
          aiSpeechAudioRunRef.current !== runId ||
          bufferedClassTrialContinueRef.current?.sourceSpeechKey !== sourceCue.speechKey
        ) {
          return nextView;
        }
        const nextCue = buildAiSpeechAudioCue(nextView, completedSpeechKeys, runtimeAiTtsConfigs);
        const nextTextCue = nextCue ? buildAiSpeechAudioTextCue(nextCue) : undefined;
        if (nextTextCue) {
          const prepared = getOrCreatePreparedAiSpeechAudio({
            prepared: preparedAiSpeechAudioRef.current,
            cue: nextTextCue,
            load: loadAiSpeechAudioElement,
          });
          void prepared.promise.catch(() => undefined);
        }
        return nextView;
      });
      const bufferedRun: ClassTrialAudioLookaheadRun<HumanGameView> = {
        gameId: game.id,
        sourceSpeechKey: sourceCue.speechKey,
        runId,
        promise,
      };

      bufferedClassTrialContinueRef.current = bufferedRun;
      setBufferedClassTrialContinueKey(sourceCue.speechKey);
      void promise.catch((lookaheadError) => {
        if (bufferedClassTrialContinueRef.current === bufferedRun) {
          clearBufferedClassTrialContinue();
        }
        console.info(lookaheadError instanceof Error ? lookaheadError.message : "学级裁判后台推进失败。");
      });
    },
    [
      classTrialThemeActive,
      clearBufferedClassTrialContinue,
      effectiveAiSpeechAudioEnabled,
      effectiveAiRuntimeMode,
      game,
      loadAiSpeechAudioElement,
      roleIntroGameId,
      runtimeAiLlmConfigs,
      runtimeAiTtsConfigs,
    ],
  );

  const consumeBufferedClassTrialContinue = useCallback(
    async (sourceCue: AiSpeechAudioTextCue, runId: number): Promise<boolean> => {
      const bufferedRun = bufferedClassTrialContinueRef.current;
      const matches = isMatchingClassTrialAudioLookahead(bufferedRun, {
        gameId: sourceCue.gameId,
        sourceSpeechKey: sourceCue.speechKey,
        runId,
        activeRunId: aiSpeechAudioRunRef.current,
      });
      if (!bufferedRun || !matches) return false;

      try {
        const nextView = await bufferedRun.promise;
        const stillMatches = isMatchingClassTrialAudioLookahead(bufferedRun, {
          gameId: sourceCue.gameId,
          sourceSpeechKey: sourceCue.speechKey,
          runId,
          activeRunId: aiSpeechAudioRunRef.current,
        });
        if (!stillMatches) {
          if (bufferedClassTrialContinueRef.current === bufferedRun) clearBufferedClassTrialContinue();
          return false;
        }
        clearBufferedClassTrialContinue();
        setGame(nextView);
        return true;
      } catch {
        if (bufferedClassTrialContinueRef.current === bufferedRun) clearBufferedClassTrialContinue();
        return false;
      }
    },
    [clearBufferedClassTrialContinue],
  );

  const playAiSpeechAudioElement = useCallback(async (
    audio: HTMLAudioElement,
    runId: number,
    cue: AiSpeechAudioTextCue,
    options?: { onPlaybackStarted?: () => void },
  ) => {
    if (aiSpeechAudioRunRef.current !== runId) return;

    aiSpeechAudioRef.current = audio;

    await waitForAudioReady(audio);
    try {
      await audio.play();
      setManualAiSpeechPlayback((current) => (current?.speechKey === cue.speechKey ? null : current));
    } catch (playError) {
      const errorMessage = playError instanceof Error ? playError.message : "浏览器拦截了自动播放，需要手动点一下。";
      setAiSpeechAudioStatus({
        speechKey: cue.speechKey,
        speaker: cue.speaker,
        state: "paused",
        preparationStage: "ready",
        text: cue.text,
      });
      await new Promise<void>((resolve) => {
        manualAiSpeechPlaybackRef.current = {
          audio,
          resolve,
          speechKey: cue.speechKey,
        };
        setManualAiSpeechPlayback({
          speechKey: cue.speechKey,
          speakerSeatId: cue.speaker.seatId,
          errorMessage,
          playing: false,
        });
      });
      if (aiSpeechAudioRunRef.current !== runId) return;
    }
    const playbackStartedAtMs = window.performance.now();
    options?.onPlaybackStarted?.();

    const updatePlaybackStatus = () => {
      const nowMs = window.performance.now();
      const next = buildAiSpeechAudioPlaybackStatusPatch({
        audio,
        cue,
        runId,
        activeRunId: aiSpeechAudioRunRef.current,
        classTrialThemeActive: classTrialLocalThemeSelected,
        playbackStartedAtMs,
        nowMs,
      });
      if (!next) return;
      setAiSpeechAudioStatus((current) => {
        if (
          !shouldCommitAiSpeechAudioPlaybackStatus({
            current,
            next,
            nowMs,
            lastCommittedAtMs: lastAiSpeechAudioStatusCommitMsRef.current,
          })
        ) {
          return current;
        }
        lastAiSpeechAudioStatusCommitMsRef.current = nowMs;
        return next;
      });
    };
    updatePlaybackStatus();

    let animationFrame = 0;
    const tick = () => {
      updatePlaybackStatus();
      if (aiSpeechAudioRunRef.current === runId && !audio.paused && !audio.ended) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    audio.addEventListener("loadedmetadata", updatePlaybackStatus);
    audio.addEventListener("durationchange", updatePlaybackStatus);
    audio.addEventListener("timeupdate", updatePlaybackStatus);
    audio.addEventListener("ended", updatePlaybackStatus);

    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`AI 发言音频加载失败：${audio.currentSrc || audio.src}`));
      });
      const tailHoldMs =
        classTrialLocalThemeSelected || cue.roleCard?.theme === "class-trial"
          ? Math.max(0, estimateClassTrialTextFallbackDurationMs(cue.text) - (window.performance.now() - playbackStartedAtMs))
          : 0;
      if (tailHoldMs > 0 && aiSpeechAudioRunRef.current === runId) {
        await new Promise<void>((resolve) => {
          const finishAtMs = window.performance.now() + tailHoldMs;
          const tickReadableTail = () => {
            updatePlaybackStatus();
            if (aiSpeechAudioRunRef.current !== runId || window.performance.now() >= finishAtMs) {
              updatePlaybackStatus();
              resolve();
              return;
            }
            animationFrame = window.requestAnimationFrame(tickReadableTail);
          };
          tickReadableTail();
        });
      }
      const finalTextHoldMs =
        classTrialLocalThemeSelected || cue.roleCard?.theme === "class-trial" ? getClassTrialFinalTextHoldMs(cue.text) : 0;
      if (finalTextHoldMs > 0 && aiSpeechAudioRunRef.current === runId) {
        updatePlaybackStatus();
        await new Promise<void>((resolve) => window.setTimeout(resolve, finalTextHoldMs));
      }
    } finally {
      window.cancelAnimationFrame(animationFrame);
      audio.removeEventListener("loadedmetadata", updatePlaybackStatus);
      audio.removeEventListener("durationchange", updatePlaybackStatus);
      audio.removeEventListener("timeupdate", updatePlaybackStatus);
      audio.removeEventListener("ended", updatePlaybackStatus);
    }
  }, [classTrialLocalThemeSelected]);

  const playAiSpeechAudioText = useCallback(
    async (cue: AiSpeechAudioTextCue, runId: number, preparedAudio?: Promise<HTMLAudioElement>) => {
      try {
        const audio = await (preparedAudio ?? prepareAiSpeechAudioText(cue, runId));
        await playAiSpeechAudioElement(audio, runId, cue, {
          onPlaybackStarted: () => startBufferedClassTrialContinue(cue, runId),
        });
      } finally {
        if (aiSpeechAudioRunRef.current === runId) {
          setAiSpeechAudioStatus((current) => (current?.speechKey === cue.speechKey ? null : current));
        }
      }
    },
    [playAiSpeechAudioElement, prepareAiSpeechAudioText, startBufferedClassTrialContinue],
  );

  const playClassTrialTextFallback = useCallback(async (cue: AiSpeechAudioTextCue, runId: number) => {
    if (aiSpeechAudioRunRef.current !== runId) return;
    setAiSpeechAudioStatus({
      speechKey: cue.speechKey,
      speaker: cue.speaker,
      state: "playing",
      text: cue.text,
    });
    try {
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, estimateClassTrialTextFallbackDurationMs(cue.text) + getClassTrialFinalTextHoldMs(cue.text)),
      );
    } finally {
      if (aiSpeechAudioRunRef.current === runId) {
        setAiSpeechAudioStatus((current) => (current?.speechKey === cue.speechKey ? null : current));
      }
    }
  }, []);

  const loadGameById = useCallback(
    async (gameId: string) => {
      setLoading(true);
      setError(null);
      try {
        const view = await loadGameView(gameId);
        rememberGame(view.id);
        setRoleIntroGameId(null);
        setClassTrialIntroGameId(null);
        setCompletedClassTrialIntroGameId(null);
        setCompletedClassTrialOpeningNightCurtainGameId(null);
        setGame(view);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取对局失败。");
      } finally {
        setLoading(false);
      }
    },
    [rememberGame],
  );

  const startGame = useCallback(async (boardId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const useFixedClassTrialLineup =
        classTrialThemeMode === "class-trial" && classTrialPersonasStatus.available && classTrialAiFriends.length === 9;
      const view = await createGameView({
        boardId,
        selectedBoardId,
        humanSeatMode,
        selectedHumanSeatId,
        selectedAiFriends,
        boardIdOverride: useFixedClassTrialLineup ? CLASS_TRIAL_DEFAULT_BOARD_ID : undefined,
        humanSeatModeOverride: useFixedClassTrialLineup ? "none" : undefined,
        aiFriendsOverride: useFixedClassTrialLineup ? classTrialAiFriends : undefined,
        seatRoleOverrides: useFixedClassTrialLineup ? CLASS_TRIAL_FIXED_SEAT_ROLES : undefined,
      });
      rememberGame(view.id);
      setRoleIntroGameId(view.humanSeatId === null ? null : view.id);
      setClassTrialIntroGameId(useFixedClassTrialLineup ? view.id : null);
      setCompletedClassTrialIntroGameId(null);
      setCompletedClassTrialOpeningNightCurtainGameId(null);
      setGame(view);
    } catch {
      setError("创建对局失败。");
    } finally {
      setLoading(false);
    }
  }, [
    classTrialAiFriends,
    classTrialPersonasStatus.available,
    classTrialThemeMode,
    humanSeatMode,
    rememberGame,
    selectedAiFriends,
    selectedBoardId,
    selectedHumanSeatId,
  ]);

  const returnHome = useCallback(() => {
    setGame(null);
    setLoading(false);
    setError(null);
    setRoleIntroGameId(null);
    setClassTrialIntroGameId(null);
    setCompletedClassTrialIntroGameId(null);
    setCompletedClassTrialOpeningNightCurtainGameId(null);
    setPhaseCurtain(null);
    setIdiotReveal(null);
    setIdentityBookOpen(false);
    setGlossaryOpen(false);
    setLiveAiSpeech(null);
    setPendingCommandType(null);
    stopHostAudio();
    stopAiSpeechAudio();
    lastCurtainKeyRef.current = null;
    activeIdiotRevealKeyRef.current = null;
    autoReadGameIdRef.current = null;
    autoReadSpeechKeysRef.current.clear();
    completedHostAudioKeysRef.current.clear();
    completedAiSpeechAudioKeysRef.current.clear();
    streamingAiSpeechAudioKeysRef.current.clear();
    prewarmedClassTrialVoiceKeysRef.current.clear();
    textFallbackAiSpeechKeysRef.current.clear();
    aiSpeechAudioAttemptCountsRef.current.clear();
    preparedAiSpeechAudioRef.current.clear();
    clearBufferedClassTrialContinue();
    aiSpeechAudioGameIdRef.current = null;
    lastHostAudioKeyRef.current = null;
    lastAiSpeechAudioKeyRef.current = null;
    if (idiotRevealTimerRef.current !== null) {
      window.clearTimeout(idiotRevealTimerRef.current);
      idiotRevealTimerRef.current = null;
    }
    clearCurrentGameId();
  }, [clearBufferedClassTrialContinue, stopAiSpeechAudio, stopHostAudio]);

  const completeClassTrialIntro = useCallback(() => {
    if (!game) return;
    setCompletedClassTrialIntroGameId(game.id);
  }, [game]);

  const skipClassTrialIntro = useCallback(() => {
    if (!game) return;
    setCompletedClassTrialIntroGameId(game.id);
  }, [game]);

  const submitCommand = useCallback(async (payload: CommandPayload) => {
    if (!game) return;
    if (payload.type === "continue" && bufferedClassTrialContinueRef.current) return;
    setLoading(true);
    setError(null);
    setLiveAiSpeech(null);
    setPendingCommandType(payload.type);
    let streamingTts: ReturnType<typeof createStreamingAiSpeechTtsQueue> | undefined;
    let streamingRunId: number | undefined;
    try {
      if (payload.type === "continue") {
        const { previousSpeechKeys, streamingSpeaker, streamingSpeechKeyPrefix } = buildStreamingContinueContext(
          game,
          effectiveAiSpeechAudioEnabled,
        );
        if (streamingSpeaker && streamingSpeechKeyPrefix) {
          stopAiSpeechAudio();
          const runId = aiSpeechAudioRunRef.current;
          streamingRunId = runId;
          setAiSpeechAudioStatus(
            buildAiSpeechAudioLoadingStatus(
              {
                gameId: game.id,
                speechKey: `${streamingSpeechKeyPrefix}:pending`,
                speaker: streamingSpeaker,
                text: "正在思考/准备发言。",
              },
              { preparationStage: "queued" },
            ),
          );
          streamingTts = createStreamingAiSpeechTtsQueue({
            gameId: game.id,
            speechKeyPrefix: streamingSpeechKeyPrefix,
            speaker: streamingSpeaker,
            voicePersonaName: streamingSpeaker.personaName,
            ttsVoice: streamingSpeaker.ttsVoice,
            ttsConfig: getSeatTtsConfig(game, streamingSpeaker.seatId, runtimeAiTtsConfigs),
            roleCard: streamingSpeaker.roleCard,
            runId,
            loadChunk: (cue) => prepareAiSpeechAudioText(cue, runId),
            playLoadedChunk: playAiSpeechAudioElement,
            shouldContinue: () => aiSpeechAudioRunRef.current === runId,
            onError: (audioError) => {
              markAiSpeechAudioUnavailable(audioError, { roleCard: streamingSpeaker.roleCard });
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
            },
            deferChunkLoadUntilDrain: classTrialThemeActive,
            chunkMode: classTrialThemeActive ? "whole-speech" : "stable",
          });
        }

        const streamedView = await submitStreamingContinue(
          game,
          payload,
          runtimeAiLlmConfigs,
          effectiveAiRuntimeMode,
          setLiveAiSpeech,
          streamingTts?.push,
        );
        const streamedSpeech = streamingSpeaker ? findNewAiSpeech(streamedView, previousSpeechKeys, streamingSpeaker.seatId) : undefined;
        if (streamingTts && streamedSpeech && streamingSpeaker && streamingRunId !== undefined) {
          const runId = streamingRunId;
          const streamedSpeechKey = speechStreamKey(streamedView.id, streamedSpeech);
          streamingAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
          lastAiSpeechAudioKeyRef.current = streamedSpeechKey;
          void streamingTts
            .finish(streamedSpeech.message)
            .then(() => {
              completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
              aiSpeechAudioAttemptCountsRef.current.delete(streamedSpeechKey);
            })
            .catch(async (audioError) => {
              const playedAny = Boolean(streamingTts?.hasPlayedAny());
              const useTextFallback = shouldUseClassTrialTextFallback({
                classTrialThemeActive,
                playedAny,
                roleCard: streamingSpeaker.roleCard,
              });
              const unavailable = markAiSpeechAudioUnavailable(audioError, { roleCard: streamingSpeaker.roleCard });
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
              if (playedAny) {
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
              } else if (useTextFallback) {
                await playClassTrialTextFallback(
                  {
                    gameId: streamedView.id,
                    speechKey: streamedSpeechKey,
                    speaker: streamedSpeech.speaker!,
                    voicePersonaName: streamingSpeaker.personaName,
                    ttsVoice: streamingSpeaker.ttsVoice,
                    ttsConfig: getSeatTtsConfig(streamedView, streamingSpeaker.seatId, runtimeAiTtsConfigs),
                    roleCard: streamingSpeaker.roleCard,
                    text: streamedSpeech.message,
                  },
                  runId,
                );
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
                aiSpeechAudioAttemptCountsRef.current.delete(streamedSpeechKey);
              } else {
                textFallbackAiSpeechKeysRef.current.add(streamedSpeechKey);
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
                if (!unavailable) {
                  lastAiSpeechAudioKeyRef.current = null;
                }
              }
            })
            .finally(() => {
              streamingAiSpeechAudioKeysRef.current.delete(streamedSpeechKey);
              setAiSpeechAudioStatus((current) =>
                streamingSpeechKeyPrefix && current?.speechKey.startsWith(streamingSpeechKeyPrefix) ? null : current,
              );
              setAiSpeechAudioCompletionTick((tick) => tick + 1);
            });
        } else {
          streamingTts?.cancel();
          if (!streamingTts && classTrialThemeActive && streamedSpeech?.speaker && streamingSpeaker) {
            const streamedSpeechKey = speechStreamKey(streamedView.id, streamedSpeech);
            stopAiSpeechAudio();
            const runId = aiSpeechAudioRunRef.current;
            lastAiSpeechAudioKeyRef.current = streamedSpeechKey;
            textFallbackAiSpeechKeysRef.current.add(streamedSpeechKey);
            void playClassTrialTextFallback(
              {
                gameId: streamedView.id,
                speechKey: streamedSpeechKey,
                speaker: streamedSpeech.speaker,
                voicePersonaName: streamingSpeaker.personaName,
                ttsVoice: streamingSpeaker.ttsVoice,
                ttsConfig: getSeatTtsConfig(streamedView, streamingSpeaker.seatId, runtimeAiTtsConfigs),
                roleCard: streamingSpeaker.roleCard,
                text: streamedSpeech.message,
              },
              runId,
            )
              .then(() => {
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
                aiSpeechAudioAttemptCountsRef.current.delete(streamedSpeechKey);
              })
              .finally(() => {
                if (aiSpeechAudioRunRef.current === runId) {
                  setAiSpeechAudioCompletionTick((tick) => tick + 1);
                }
              });
          }
        }
        setGame(streamedView);
        return;
      }

      const nextView = await submitGameCommand({
        gameId: game.id,
        payload,
        aiRuntimeMode: effectiveAiRuntimeMode,
        aiLlmConfigs: runtimeAiLlmConfigs,
      });
      setGame(nextView);
    } catch (submitError) {
      streamingTts?.cancel();
      setError(submitError instanceof Error ? submitError.message : "动作执行失败。");
    } finally {
      setLiveAiSpeech(null);
      setPendingCommandType(null);
      setLoading(false);
    }
  }, [
    classTrialThemeActive,
    effectiveAiSpeechAudioEnabled,
    effectiveAiRuntimeMode,
    game,
    markAiSpeechAudioUnavailable,
    playClassTrialTextFallback,
    playAiSpeechAudioElement,
    prepareAiSpeechAudioText,
    runtimeAiLlmConfigs,
    runtimeAiTtsConfigs,
    stopAiSpeechAudio,
  ]);

  useEffect(() => {
    if (!game) return;
    const event = findLatestUnplayedPublicEvent(game, completedIdiotRevealKeysRef.current, IDIOT_REVEAL_EVENT_TYPES);
    if (!event) return;

    const cue = buildIdiotRevealCue(game, event);
    if (!cue || activeIdiotRevealKeyRef.current === cue.key) return;

    activeIdiotRevealKeyRef.current = cue.key;
    window.setTimeout(() => setIdiotReveal(cue), 0);
    if (idiotRevealTimerRef.current !== null) window.clearTimeout(idiotRevealTimerRef.current);
    idiotRevealTimerRef.current = window.setTimeout(() => {
      completedIdiotRevealKeysRef.current.add(cue.key);
      if (activeIdiotRevealKeyRef.current === cue.key) activeIdiotRevealKeyRef.current = null;
      setIdiotReveal((current) => (current?.key === cue.key ? null : current));
      idiotRevealTimerRef.current = null;
    }, 4200);
  }, [game]);

  useEffect(() => {
    return () => {
      if (idiotRevealTimerRef.current !== null) window.clearTimeout(idiotRevealTimerRef.current);
    };
  }, []);

  const phaseCurtainActive = Boolean(phaseCurtain);
  const idiotRevealActive = Boolean(idiotReveal);
  const aiSpeechAudioActive = Boolean(aiSpeechAudioStatus);

  useEffect(() => {
    if (!game || loading || error || game.result || phaseCurtainActive || idiotRevealActive) return;
    if (classTrialFlow.pauseAutoAdvance) return;
    if (findLatestUnplayedPublicEvent(game, completedIdiotRevealKeysRef.current, IDIOT_REVEAL_EVENT_TYPES)) return;

    const currentSpeechKeys = new Set(game.tableSummary.recentSpeeches.map((speech) => speechStreamKey(game.id, speech)));
    if (autoReadGameIdRef.current !== game.id) {
      autoReadGameIdRef.current = game.id;
      autoReadSpeechKeysRef.current = currentSpeechKeys;
    }

    const action = game.availableActions[0];
    const isAutoStep = game.availableActions.length === 1 && action?.type === "continue";
    if (!isAutoStep) return;

    const pendingAiSpeechCue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
    const latestAiSpeech = getLatestStreamableAiSpeech(game);
    const latestAiSpeechKey = latestAiSpeech ? speechStreamKey(game.id, latestAiSpeech) : undefined;
    if (classTrialThemeActive && aiSpeechAudioActive) {
      return;
    }
    if (effectiveAiSpeechAudioEnabled && pendingAiSpeechCue) {
      return;
    }

    if (hostAudioEnabled) {
      const cue = buildThemedHostAudioCue(game, completedHostAudioKeysRef.current, { classTrialThemeActive });
      if (cue.clips.length > 0 && !completedHostAudioKeysRef.current.has(cue.key)) return;
    }

    const speechToRead =
      latestAiSpeech &&
      latestAiSpeechKey &&
      (!effectiveAiSpeechAudioEnabled || textFallbackAiSpeechKeysRef.current.has(latestAiSpeechKey)) &&
      !autoReadSpeechKeysRef.current.has(latestAiSpeechKey)
        ? latestAiSpeech
        : undefined;
    if (latestAiSpeechKey) {
      autoReadSpeechKeysRef.current.add(latestAiSpeechKey);
    }

    const timer = window.setTimeout(() => {
      void submitCommand({ type: "continue" });
    }, getAutoAdvanceDelay(game, action, speechToRead));

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    aiSpeechAudioActive,
    classTrialFlow,
    classTrialThemeActive,
    effectiveAiSpeechAudioEnabled,
    error,
    game,
    hostAudioCompletionTick,
    hostAudioEnabled,
    idiotRevealActive,
    loading,
    phaseCurtainActive,
    runtimeAiTtsConfigs,
    submitCommand,
  ]);

  useEffect(() => {
    if (!game || !classTrialFlow.allowThemedPhaseCurtain) {
      const timer = window.setTimeout(() => setPhaseCurtain(null), 0);
      return () => window.clearTimeout(timer);
    }

    const openingNightCurtainPending = classTrialFlow.openingNightCurtainPending;
    const curtainKey = openingNightCurtainPending ? `${game.id}:class-trial-opening-night` : `${game.id}:${game.day}:${game.phase}`;
    if (lastCurtainKeyRef.current === curtainKey) return;
    lastCurtainKeyRef.current = curtainKey;

    const cue = openingNightCurtainPending
      ? getClassTrialOpeningNightCurtainCue(game)
      : getThemedPhaseCurtainCue(game, { classTrialThemeActive });
    if (!cue) {
      const timer = window.setTimeout(() => setPhaseCurtain(null), 0);
      return () => window.clearTimeout(timer);
    }

    const showTimer = window.setTimeout(() => setPhaseCurtain(cue), 0);
    const hideTimer = window.setTimeout(() => {
      if (openingNightCurtainPending) {
        setCompletedClassTrialOpeningNightCurtainGameId(game.id);
        lastCurtainKeyRef.current = `${game.id}:${game.day}:${game.phase}`;
      }
      setPhaseCurtain(null);
    }, cue.durationMs);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [classTrialFlow, classTrialThemeActive, game]);

  useEffect(() => {
    if (!game) return;
    if (aiSpeechAudioGameIdRef.current === game.id) return;

    aiSpeechAudioGameIdRef.current = game.id;
    lastAiSpeechAudioKeyRef.current = null;
    textFallbackAiSpeechKeysRef.current.clear();
    prewarmedClassTrialVoiceKeysRef.current.clear();
    preparedAiSpeechAudioRef.current.clear();
    clearBufferedClassTrialContinue();
    for (const speech of game.tableSummary.recentSpeeches) {
      completedAiSpeechAudioKeysRef.current.add(speechStreamKey(game.id, speech));
    }
  }, [clearBufferedClassTrialContinue, game]);

  useEffect(() => {
    if (!game || !classTrialThemeActive || !effectiveAiSpeechAudioEnabled || loading || aiSpeechAudioActive) return;
    if (classTrialFlow.pauseVoicePrewarm) return;

    const cue = buildClassTrialVoicePrewarmCue(game, prewarmedClassTrialVoiceKeysRef.current, runtimeAiTtsConfigs);
    if (!cue) return;

    prewarmedClassTrialVoiceKeysRef.current.add(cue.speechKey);
    void loadAiSpeechAudioUrl(cue).catch((prewarmError) => {
      prewarmedClassTrialVoiceKeysRef.current.delete(cue.speechKey);
      console.info(prewarmError instanceof Error ? prewarmError.message : "学级裁判语音预热失败。");
    });
  }, [
    aiSpeechAudioActive,
    classTrialFlow,
    classTrialThemeActive,
    effectiveAiSpeechAudioEnabled,
    game,
    loadAiSpeechAudioUrl,
    loading,
    runtimeAiTtsConfigs,
  ]);

  useEffect(() => {
    if (!game || !hostAudioEnabled) return;
    if (classTrialFlow.pauseHostAudio) return;

    if (effectiveAiSpeechAudioEnabled && game.phase !== "DAY_ANNOUNCEMENT") {
      const pendingAiSpeechCue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
      if (pendingAiSpeechCue && !completedAiSpeechAudioKeysRef.current.has(pendingAiSpeechCue.key)) return;
    }

    const cue = buildThemedHostAudioCue(game, completedHostAudioKeysRef.current, { classTrialThemeActive });
    if (completedHostAudioKeysRef.current.has(cue.key)) return;
    if (cue.clips.length === 0) {
      completedHostAudioKeysRef.current.add(cue.key);
      setHostAudioCompletionTick((tick) => tick + 1);
      return;
    }
    if (lastHostAudioKeyRef.current === cue.key) return;
    lastHostAudioKeyRef.current = cue.key;
    stopHostAudio();
    const runId = hostAudioRunRef.current;

    const delayMs = game.phase === "DAY_ANNOUNCEMENT" ? 0 : 260;
    const timer = window.setTimeout(() => {
      void playHostAudioCue(cue, runId).finally(() => {
        if (hostAudioRunRef.current === runId) {
          setHostAudioStatus(null);
          completedHostAudioKeysRef.current.add(cue.key);
          setHostAudioCompletionTick((tick) => tick + 1);
        }
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    effectiveAiSpeechAudioEnabled,
    game,
    hostAudioCompletionTick,
    hostAudioEnabled,
    classTrialFlow,
    classTrialThemeActive,
    playHostAudioCue,
    runtimeAiTtsConfigs,
    stopHostAudio,
  ]);

  useEffect(() => {
    if (!game || !effectiveAiSpeechAudioEnabled) return;
    if (classTrialFlow.pauseAiAudio) return;

    const cue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
    if (!cue) return;
    if (completedAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (streamingAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (lastAiSpeechAudioKeyRef.current === cue.key) return;

    lastAiSpeechAudioKeyRef.current = cue.key;
    stopAiSpeechAudio();
    const runId = aiSpeechAudioRunRef.current;
    const textCue = buildAiSpeechAudioTextCue(cue);
    if (!textCue) return;
    const preparedAudio = prepareAiSpeechAudioText(textCue, runId);
    void preparedAudio.catch(() => undefined);

    const timer = window.setTimeout(() => {
      void playAiSpeechAudioText(textCue, runId, preparedAudio)
        .then(async () => {
          completedAiSpeechAudioKeysRef.current.add(cue.key);
          aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
          await consumeBufferedClassTrialContinue(textCue, runId);
        })
        .catch((audioError) => {
          const useTextFallback = shouldUseClassTrialTextFallback({
            classTrialThemeActive,
            playedAny: false,
            roleCard: cue.roleCard,
          });
          const unavailable = markAiSpeechAudioUnavailable(audioError, textCue);
          console.info(audioError instanceof Error ? audioError.message : "AI 发言音频播放失败。");
          const attempts = (aiSpeechAudioAttemptCountsRef.current.get(cue.key) ?? 0) + 1;
          aiSpeechAudioAttemptCountsRef.current.set(cue.key, attempts);
          if (!unavailable) {
            lastAiSpeechAudioKeyRef.current = null;
          }
          if (useTextFallback) {
            return playClassTrialTextFallback(textCue, runId).then(() => {
              completedAiSpeechAudioKeysRef.current.add(cue.key);
              aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
            });
          }
          if (attempts < AI_SPEECH_AUDIO_MAX_ATTEMPTS) return;
          completedAiSpeechAudioKeysRef.current.add(cue.key);
          textFallbackAiSpeechKeysRef.current.add(cue.key);
          aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
        })
        .finally(() => {
          if (aiSpeechAudioRunRef.current === runId) {
            setAiSpeechAudioCompletionTick((tick) => tick + 1);
          }
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    aiSpeechAudioCompletionTick,
    classTrialFlow,
    effectiveAiSpeechAudioEnabled,
    game,
    consumeBufferedClassTrialContinue,
    classTrialThemeActive,
    markAiSpeechAudioUnavailable,
    playClassTrialTextFallback,
    playAiSpeechAudioText,
    prepareAiSpeechAudioText,
    runtimeAiTtsConfigs,
    stopAiSpeechAudio,
  ]);

  useEffect(() => {
    return () => {
      stopHostAudio();
      stopAiSpeechAudio();
    };
  }, [stopAiSpeechAudio, stopHostAudio]);

  const classTrialIntroReady =
    Boolean(classTrialIntroConfig) && classTrialIntroStatus.available && Boolean(classTrialIntroAudioPreparation?.ready);

  return (
    <main
      className={
        classTrialThemeActive
          ? "class-trial-app-shell min-h-screen text-[#f7ead5]"
          : "min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      }
      style={
        classTrialThemeActive
          ? undefined
          : {
              backgroundImage:
                "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.88)), url('/images/werewolf-table-bg.jpg')",
            }
      }
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <div className={game ? "hidden" : "lg:hidden"}>
          <RoomHeader
            game={game}
            loading={loading}
            aiSpeechAudioEnabled={aiSpeechAudioEnabled}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            hostAudioEnabled={hostAudioEnabled}
            onNewGame={() => startGame()}
            onReturnHome={game ? returnHome : undefined}
            onOpenIdentityBook={() => setIdentityBookOpen(true)}
            onOpenGlossary={() => setGlossaryOpen(true)}
            onToggleAiSpeechAudio={toggleAiSpeechAudio}
            onToggleHostAudio={toggleHostAudio}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-[#e46d55]/45 bg-[#381511]/90 px-4 py-3 text-sm text-[#ffd8cf] shadow-lg">
            {error}
          </div>
        )}

        {!game ? (
          <LandingPanel
            loading={loading}
            boards={boards}
            selectedBoardId={selectedBoardId}
            onSelectBoard={selectBoard}
            humanSeatMode={humanSeatMode}
            selectedHumanSeatId={selectedHumanSeatId}
            onSelectRandomHumanSeat={selectRandomHumanSeat}
            onSelectFixedHumanSeat={selectFixedHumanSeat}
            onSelectNoHumanSeat={selectNoHumanSeat}
            selectedAiFriendCount={selectedAiFriends.length}
            customAiFriendCount={customAiFriends.length}
            aiLineupPreview={aiLineupPreview}
            recentGameIds={recentGameIds}
            onLoadGame={loadGameById}
            onStartGame={() => startGame(selectedBoardId ?? undefined)}
            classTrialThemeMode={classTrialThemeMode}
            classTrialAiRuntimeMode={effectiveAiRuntimeMode}
            classTrialPackAvailable={classTrialPackStatus.available && classTrialPersonasStatus.available}
            classTrialPackMessage={classTrialStatusMessage}
            classTrialIntroMessage={classTrialThemeMode === "class-trial" ? classTrialIntroMessage : undefined}
            onSelectClassTrialThemeMode={selectClassTrialThemeMode}
            onOpenIdentityBook={() => setIdentityBookOpen(true)}
            onOpenGlossary={() => setGlossaryOpen(true)}
          />
        ) : (
          <GameClientLoadedSurface
            game={game}
            loading={loading}
            pendingCommandType={pendingCommandType}
            liveAiSpeech={liveAiSpeech}
            hostAudioEnabled={hostAudioEnabled}
            aiSpeechAudioEnabled={aiSpeechAudioEnabled}
            hostAudioStatus={hostAudioStatus}
            aiSpeechAudioStatus={aiSpeechAudioStatus}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            bufferedClassTrialContinueKey={bufferedClassTrialContinueKey}
            classTrialThemeActive={classTrialThemeActive}
            classTrialIntroPending={classTrialIntroPending}
            classTrialIntroReady={classTrialIntroReady}
            classTrialIntroConfig={classTrialIntroConfig}
            classTrialIntroMessage={classTrialIntroMessage}
            classTrialPackManifest={classTrialPackManifest}
            manualAiSpeechPlayback={
              manualAiSpeechPlayback ? { ...manualAiSpeechPlayback, onPlay: resumeManualAiSpeechPlayback } : null
            }
            effectiveAiRuntimeMode={effectiveAiRuntimeMode}
            onNewGame={() => startGame()}
            onReturnHome={returnHome}
            onSubmit={submitCommand}
            onOpenIdentityBook={() => setIdentityBookOpen(true)}
            onOpenGlossary={() => setGlossaryOpen(true)}
            onToggleAiSpeechAudio={toggleAiSpeechAudio}
            onToggleHostAudio={toggleHostAudio}
            onPauseAiSpeechAudio={pauseAiSpeechAudio}
            onResumeAiSpeechAudio={resumeAiSpeechAudio}
            onSkipAiSpeechAudio={skipAiSpeechAudio}
            onCompleteClassTrialIntro={completeClassTrialIntro}
            onSkipClassTrialIntro={skipClassTrialIntro}
          />
        )}
      </div>

      {game && game.humanSeatId !== null && roleIntroGameId === game.id && (
        <RoleIntroOverlay game={game} onEnter={() => setRoleIntroGameId(null)} onReturnHome={returnHome} />
      )}
      {identityBookOpen && (
        <IdentityBookOverlay game={game} activeBoardId={game?.board.id ?? selectedBoardId ?? undefined} onClose={() => setIdentityBookOpen(false)} />
      )}
      {glossaryOpen && <GlossaryOverlay onClose={() => setGlossaryOpen(false)} />}
      {phaseCurtain && <PhaseCurtain cue={phaseCurtain} />}
      {idiotReveal && <IdiotRevealOverlay key={idiotReveal.key} cue={idiotReveal} />}
    </main>
  );
}
