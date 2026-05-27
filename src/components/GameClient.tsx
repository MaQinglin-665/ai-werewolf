"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  AiFriendConfig,
  AiRuntimeMode,
  HumanGameView,
} from "@/game/types";
import {
  ActionPanel,
  AuxiliaryInfoPanel,
  ClassTrialGameTable,
  FlowStatusBar,
  GlossaryOverlay,
  HostStage,
  IdentityBookOverlay,
  IdiotRevealOverlay,
  LandingPanel,
  PhaseCurtain,
  PhaseRhythm,
  ReviewPanel,
  RoleIntroOverlay,
  RoomHeader,
  SeatBoard,
  VoteTable,
  buildIdiotRevealCue,
  getPhaseCurtainCue,
} from "./game/GamePanels";
import {
  getAutoAdvanceDelay,
  getLatestStreamableAiSpeech,
  speechStreamKey,
} from "./game/autoAdvance";
import {
  AiSpeechAudioUnavailableError,
  buildAiSpeechAudioCue,
  createStreamingAiSpeechTtsQueue,
  findNewAiSpeech,
  getSeatTtsConfig,
  isAiSpeechAudioUnavailableError,
  prepareAiSpeechAudio,
  waitForAudioReady,
  type AiSpeechAudioCue,
} from "./game/aiSpeechAudio";
import {
  buildHostAudioCue,
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
  resolveSelectedAiFriends,
  type AiFriendLlmSecretMap,
} from "./game/aiFriendStorage";
import { getDefaultBoardOptions, getInitialBoardSelection, resolveBoardSelectionToggle } from "./game/boardSelectionModel";
import {
  buildStreamingContinueContext,
  createGameView,
  loadGameView,
  submitGameCommand,
} from "./game/gameClientRequests";
import {
  CLASS_TRIAL_THEME_MODE_STORAGE_KEY,
  getClassTrialPackStatus,
  parseClassTrialThemeMode,
  type ClassTrialPackManifest,
  type ClassTrialThemeMode,
} from "./game/classTrialTheme";
import type { IdiotRevealCue, PhaseCurtainCue } from "./game/GamePanels";
import { buildLandingLineupPreview } from "./game/landingLineupPreview";
import { MobileGameTable } from "./game/MobileGameTable";
import {
  clearCurrentGameId,
  getRecentGameIdsServerSnapshot,
  readRecentGameIds,
  rememberRecentGameId,
  subscribeRecentGameIds,
} from "./game/recentGamesStore";
import { submitStreamingContinue } from "./game/streamingContinue";
import { buildTableEventFeed } from "./game/tableEventFeed";
import type {
  AiSpeechAudioStatus,
  AiSpeechAudioTextCue,
  BoardOption,
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
  const textFallbackAiSpeechKeysRef = useRef<Set<string>>(new Set());
  const aiSpeechAudioAttemptCountsRef = useRef<Map<string, number>>(new Map());
  const hostAudioRef = useRef<HTMLAudioElement | null>(null);
  const hostAudioRunRef = useRef(0);
  const aiSpeechAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiSpeechAudioRunRef = useRef(0);
  const recentGameIds = useSyncExternalStore(subscribeRecentGameIds, readRecentGameIds, getRecentGameIdsServerSnapshot);
  const effectiveAiSpeechAudioEnabled = aiSpeechAudioEnabled && !aiSpeechAudioUnavailable;
  const aiFriendOptions = useMemo(() => buildAiFriendOptions(customAiFriends), [customAiFriends]);
  const selectedAiFriends = useMemo(
    () => resolveSelectedAiFriends(aiFriendOptions, selectedAiFriendIds),
    [aiFriendOptions, selectedAiFriendIds],
  );
  const runtimeAiLlmConfigs = useMemo(
    () => (aiRuntimeMode === "llm" ? buildRuntimeAiLlmConfigs(customAiFriends, aiLlmSecrets) : undefined),
    [aiLlmSecrets, aiRuntimeMode, customAiFriends],
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
    if (aiSpeechAudioRef.current) {
      aiSpeechAudioRef.current.pause();
      aiSpeechAudioRef.current.src = "";
      aiSpeechAudioRef.current = null;
    }
    setAiSpeechAudioStatus(null);
  }, []);

  const markAiSpeechAudioUnavailable = useCallback(
    (error: unknown) => {
      if (!isAiSpeechAudioUnavailableError(error)) return false;
      setAiSpeechAudioUnavailable(true);
      streamingAiSpeechAudioKeysRef.current.clear();
      stopAiSpeechAudio();
      return true;
    },
    [stopAiSpeechAudio],
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
        stopAiSpeechAudio();
      }
      return next;
    });
  }, [stopAiSpeechAudio]);

  const selectClassTrialThemeMode = useCallback((mode: ClassTrialThemeMode) => {
    setClassTrialThemeMode(mode);
    window.localStorage.setItem(CLASS_TRIAL_THEME_MODE_STORAGE_KEY, mode);
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
        text: cue.text,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      const message = data.error ?? "AI 发言音频生成失败。";
      if (response.status === 503) {
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

  const playAiSpeechAudioElement = useCallback(async (audio: HTMLAudioElement, runId: number, cue: AiSpeechAudioTextCue) => {
    if (aiSpeechAudioRunRef.current !== runId) return;

    aiSpeechAudioRef.current = audio;

    await waitForAudioReady(audio);
    await audio.play();
    setAiSpeechAudioStatus({
      speechKey: cue.speechKey,
      speaker: cue.speaker,
      state: "playing",
      text: cue.text,
    });
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error(`AI 发言音频加载失败：${audio.currentSrc || audio.src}`));
    });
  }, []);

  const playAiSpeechAudioText = useCallback(
    async (cue: AiSpeechAudioTextCue, runId: number) => {
      setAiSpeechAudioStatus({
        speechKey: cue.speechKey,
        speaker: cue.speaker,
        state: "loading",
        text: cue.text,
      });
      try {
        const audio = await loadAiSpeechAudioElement(cue);
        await playAiSpeechAudioElement(audio, runId, cue);
      } finally {
        if (aiSpeechAudioRunRef.current === runId) {
          setAiSpeechAudioStatus((current) => (current?.speechKey === cue.speechKey ? null : current));
        }
      }
    },
    [loadAiSpeechAudioElement, playAiSpeechAudioElement],
  );

  const playAiSpeechAudioCue = useCallback(
    async (cue: AiSpeechAudioCue, runId: number) => {
      const speaker = cue.speech.speaker;
      if (!speaker) return;
      await playAiSpeechAudioText(
        {
          gameId: cue.gameId,
          speechKey: cue.key,
          speaker,
          voicePersonaName: cue.voicePersonaName,
          ttsVoice: cue.ttsVoice,
          ttsConfig: cue.ttsConfig,
          text: cue.speech.message,
        },
        runId,
      );
    },
    [playAiSpeechAudioText],
  );

  const loadGameById = useCallback(
    async (gameId: string) => {
      setLoading(true);
      setError(null);
      try {
        const view = await loadGameView(gameId);
        rememberGame(view.id);
        setRoleIntroGameId(null);
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
      const view = await createGameView({
        boardId,
        selectedBoardId,
        humanSeatMode,
        selectedHumanSeatId,
        selectedAiFriends,
      });
      rememberGame(view.id);
      setRoleIntroGameId(view.humanSeatId === null ? null : view.id);
      setGame(view);
    } catch {
      setError("创建对局失败。");
    } finally {
      setLoading(false);
    }
  }, [humanSeatMode, rememberGame, selectedAiFriends, selectedBoardId, selectedHumanSeatId]);

  const returnHome = useCallback(() => {
    setGame(null);
    setLoading(false);
    setError(null);
    setRoleIntroGameId(null);
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
    textFallbackAiSpeechKeysRef.current.clear();
    aiSpeechAudioAttemptCountsRef.current.clear();
    aiSpeechAudioGameIdRef.current = null;
    lastHostAudioKeyRef.current = null;
    lastAiSpeechAudioKeyRef.current = null;
    if (idiotRevealTimerRef.current !== null) {
      window.clearTimeout(idiotRevealTimerRef.current);
      idiotRevealTimerRef.current = null;
    }
    clearCurrentGameId();
  }, [stopAiSpeechAudio, stopHostAudio]);

  const submitCommand = useCallback(async (payload: CommandPayload) => {
    if (!game) return;
    setLoading(true);
    setError(null);
    setLiveAiSpeech(null);
    setPendingCommandType(payload.type);
    let streamingTts: ReturnType<typeof createStreamingAiSpeechTtsQueue> | undefined;
    try {
      if (payload.type === "continue") {
        const { previousSpeechKeys, streamingSpeaker, streamingSpeechKeyPrefix } = buildStreamingContinueContext(
          game,
          effectiveAiSpeechAudioEnabled,
        );
        if (streamingSpeaker && streamingSpeechKeyPrefix) {
          stopAiSpeechAudio();
          const runId = aiSpeechAudioRunRef.current;
          streamingTts = createStreamingAiSpeechTtsQueue({
            gameId: game.id,
            speechKeyPrefix: streamingSpeechKeyPrefix,
            speaker: streamingSpeaker,
            voicePersonaName: streamingSpeaker.personaName,
            ttsVoice: streamingSpeaker.ttsVoice,
            ttsConfig: getSeatTtsConfig(game, streamingSpeaker.seatId, runtimeAiTtsConfigs),
            runId,
            loadChunk: loadAiSpeechAudioElement,
            playLoadedChunk: playAiSpeechAudioElement,
            shouldContinue: () => aiSpeechAudioRunRef.current === runId,
            onError: (audioError) => {
              markAiSpeechAudioUnavailable(audioError);
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
            },
          });
        }

        const streamedView = await submitStreamingContinue(
          game,
          payload,
          runtimeAiLlmConfigs,
          aiRuntimeMode,
          setLiveAiSpeech,
          streamingTts?.push,
        );
        const streamedSpeech =
          streamingTts && streamingSpeaker ? findNewAiSpeech(streamedView, previousSpeechKeys, streamingSpeaker.seatId) : undefined;
        if (streamingTts && streamedSpeech) {
          const streamedSpeechKey = speechStreamKey(streamedView.id, streamedSpeech);
          streamingAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
          lastAiSpeechAudioKeyRef.current = streamedSpeechKey;
          void streamingTts
            .finish(streamedSpeech.message)
            .then(() => {
              completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
              aiSpeechAudioAttemptCountsRef.current.delete(streamedSpeechKey);
            })
            .catch((audioError) => {
              const unavailable = markAiSpeechAudioUnavailable(audioError);
              console.info(audioError instanceof Error ? audioError.message : "AI 发言流式音频播放失败。");
              if (streamingTts?.hasPlayedAny()) {
                completedAiSpeechAudioKeysRef.current.add(streamedSpeechKey);
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
        }
        setGame(streamedView);
        return;
      }

      const nextView = await submitGameCommand({
        gameId: game.id,
        payload,
        aiRuntimeMode,
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
    aiRuntimeMode,
    effectiveAiSpeechAudioEnabled,
    game,
    loadAiSpeechAudioElement,
    markAiSpeechAudioUnavailable,
    playAiSpeechAudioElement,
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

  useEffect(() => {
    if (!game || loading || error || game.result || roleIntroGameId === game.id || phaseCurtainActive || idiotRevealActive) return;
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
    if (effectiveAiSpeechAudioEnabled && pendingAiSpeechCue) {
      return;
    }

    if (hostAudioEnabled) {
      const cue = buildHostAudioCue(game, completedHostAudioKeysRef.current);
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
    effectiveAiSpeechAudioEnabled,
    error,
    game,
    hostAudioCompletionTick,
    hostAudioEnabled,
    idiotRevealActive,
    loading,
    phaseCurtainActive,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    submitCommand,
  ]);

  useEffect(() => {
    if (!game || roleIntroGameId === game.id) return;

    const curtainKey = `${game.id}:${game.day}:${game.phase}`;
    if (lastCurtainKeyRef.current === curtainKey) return;
    lastCurtainKeyRef.current = curtainKey;

    const cue = getPhaseCurtainCue(game);
    setPhaseCurtain(cue);
    const timer = window.setTimeout(() => setPhaseCurtain(null), cue.durationMs);
    return () => window.clearTimeout(timer);
  }, [game, roleIntroGameId]);

  useEffect(() => {
    if (!game) return;
    if (aiSpeechAudioGameIdRef.current === game.id) return;

    aiSpeechAudioGameIdRef.current = game.id;
    lastAiSpeechAudioKeyRef.current = null;
    textFallbackAiSpeechKeysRef.current.clear();
    for (const speech of game.tableSummary.recentSpeeches) {
      completedAiSpeechAudioKeysRef.current.add(speechStreamKey(game.id, speech));
    }
  }, [game]);

  useEffect(() => {
    if (!game || !hostAudioEnabled || roleIntroGameId === game.id) return;

    if (effectiveAiSpeechAudioEnabled && game.phase !== "DAY_ANNOUNCEMENT") {
      const pendingAiSpeechCue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
      if (pendingAiSpeechCue && !completedAiSpeechAudioKeysRef.current.has(pendingAiSpeechCue.key)) return;
    }

    const cue = buildHostAudioCue(game, completedHostAudioKeysRef.current);
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
    playHostAudioCue,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    stopHostAudio,
  ]);

  useEffect(() => {
    if (!game || !effectiveAiSpeechAudioEnabled || roleIntroGameId === game.id) return;

    const cue = buildAiSpeechAudioCue(game, completedAiSpeechAudioKeysRef.current, runtimeAiTtsConfigs);
    if (!cue) return;
    if (completedAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (streamingAiSpeechAudioKeysRef.current.has(cue.key)) return;
    if (lastAiSpeechAudioKeyRef.current === cue.key) return;

    lastAiSpeechAudioKeyRef.current = cue.key;
    stopAiSpeechAudio();
    const runId = aiSpeechAudioRunRef.current;

    const timer = window.setTimeout(() => {
      void playAiSpeechAudioCue(cue, runId)
        .then(() => {
          completedAiSpeechAudioKeysRef.current.add(cue.key);
          aiSpeechAudioAttemptCountsRef.current.delete(cue.key);
        })
        .catch((audioError) => {
          const unavailable = markAiSpeechAudioUnavailable(audioError);
          console.info(audioError instanceof Error ? audioError.message : "AI 发言音频播放失败。");
          const attempts = (aiSpeechAudioAttemptCountsRef.current.get(cue.key) ?? 0) + 1;
          aiSpeechAudioAttemptCountsRef.current.set(cue.key, attempts);
          if (!unavailable) {
            lastAiSpeechAudioKeyRef.current = null;
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
    effectiveAiSpeechAudioEnabled,
    game,
    markAiSpeechAudioUnavailable,
    playAiSpeechAudioCue,
    roleIntroGameId,
    runtimeAiTtsConfigs,
    stopAiSpeechAudio,
  ]);

  useEffect(() => {
    return () => {
      stopHostAudio();
      stopAiSpeechAudio();
    };
  }, [stopAiSpeechAudio, stopHostAudio]);

  const latestEvents = useMemo(() => buildTableEventFeed(game), [game]);
  const classTrialThemeActive = classTrialThemeMode === "class-trial" && Boolean(game);

  return (
    <main
      className="min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.88)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <div className={game ? "hidden sm:block" : ""}>
          <RoomHeader
            game={game}
            loading={loading}
            aiSpeechAudioEnabled={aiSpeechAudioEnabled}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            hostAudioEnabled={hostAudioEnabled}
            onNewGame={startGame}
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
            classTrialPackAvailable={classTrialPackStatus.available}
            classTrialPackMessage={classTrialPackStatus.message}
            onSelectClassTrialThemeMode={selectClassTrialThemeMode}
          />
        ) : (
          <div className="grid flex-1 gap-4">
            {classTrialThemeActive ? (
              <ClassTrialGameTable game={game} loading={loading} onReturnHome={returnHome} onSubmit={submitCommand} />
            ) : (
              <MobileGameTable
                game={game}
                loading={loading}
                pendingCommandType={pendingCommandType}
                liveAiSpeech={liveAiSpeech}
                hostAudioEnabled={hostAudioEnabled}
                aiSpeechAudioEnabled={aiSpeechAudioEnabled}
                hostAudioStatus={hostAudioStatus}
                aiSpeechAudioStatus={aiSpeechAudioStatus}
                aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
                events={latestEvents}
                onNewGame={() => startGame()}
                onReturnHome={returnHome}
                onSubmit={submitCommand}
                onOpenIdentityBook={() => setIdentityBookOpen(true)}
                onOpenGlossary={() => setGlossaryOpen(true)}
                onToggleAiSpeechAudio={toggleAiSpeechAudio}
                onToggleHostAudio={toggleHostAudio}
              />
            )}

            {!classTrialThemeActive && <div className="hidden gap-4 sm:grid">
              <PhaseRhythm game={game} />
              <HostStage game={game} />
              <FlowStatusBar
                game={game}
                loading={loading}
                pendingCommandType={pendingCommandType}
                liveAiSpeech={liveAiSpeech}
                hostAudioStatus={hostAudioStatus}
                aiSpeechAudioStatus={aiSpeechAudioStatus}
                aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
                onPauseAiSpeechAudio={pauseAiSpeechAudio}
                onResumeAiSpeechAudio={resumeAiSpeechAudio}
                onSkipAiSpeechAudio={skipAiSpeechAudio}
                onToggleAiSpeechAudio={toggleAiSpeechAudio}
              />
              <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,420px)]">
                <div className="grid content-start gap-4">
                  <SeatBoard game={game} liveAiSpeech={liveAiSpeech} aiSpeechAudioStatus={aiSpeechAudioStatus} />
                  {game.review && <ReviewPanel game={game} />}
                </div>

                <aside className="grid content-start gap-4">
                  <ActionPanel game={game} loading={loading} onNewGame={startGame} onReturnHome={returnHome} onSubmit={submitCommand} />
                  <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />
                  <AuxiliaryInfoPanel game={game} events={latestEvents} />
                </aside>
              </section>
            </div>}
          </div>
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
