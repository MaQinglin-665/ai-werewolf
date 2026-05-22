"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionPanel,
  AuxiliaryInfoPanel,
  FlowStatusBar,
  HostStage,
  IdiotRevealOverlay,
  PhaseCurtain,
  PhaseRhythm,
  ReviewPanel,
  SeatBoard,
  VoteTable,
  buildIdiotRevealCue,
  getPhaseCurtainCue,
  type PhaseCurtainCue,
  type IdiotRevealCue,
} from "@/components/game/GamePanels";
import type { CommandPayload, HostAudioStatus } from "@/components/game/clientTypes";
import type { HumanCommandInput } from "@/game/commandSchemas";
import type { HumanGameView } from "@/game/types";
import type { RoomPlayerView, RoomSeatView, RoomView } from "@/server/roomService";

const ROOM_SESSION_STORAGE_KEY = "ai-werewolf-room-session";
const ROOM_HOST_AUDIO_BASE_PATH = "/audio/host";
const ROOM_FAST_POLL_LOBBY_MS = 1500;
const ROOM_FAST_POLL_IN_GAME_MS = 1000;
const ROOM_SSE_FALLBACK_POLL_MS = 1500;
const ROOM_SSE_STALE_MS = 8000;
const ROOM_VIEW_REQUEST_TIMEOUT_MS = 6000;
const ROOM_WRITE_REQUEST_TIMEOUT_MS = 20000;
const IDIOT_REVEAL_EVENT_TYPES = new Set(["IDIOT_REVEALED"]);

const BOARD_OPTIONS = [
  { id: "6p-beginner-seer", label: "6人新手局" },
  { id: "9p-seer-witch-hunter", label: "9人预女猎" },
  { id: "12p-sheriff-seer-witch-hunter-guard", label: "12人标准警长局" },
  { id: "12p-sheriff-seer-witch-hunter-idiot", label: "12人预女猎白" },
  { id: "12p-sheriff-wolf-king-seer-witch-hunter-guard", label: "12人狼王守卫局" },
  { id: "12p-sheriff-white-wolf-king-seer-witch-hunter-guard", label: "12人白狼王守卫局" },
  { id: "12p-sheriff-white-wolf-king-knight", label: "12人白狼王骑士局" },
  { id: "12p-sheriff-wolf-beauty-knight", label: "12人狼美人骑士局" },
];

type StoredRoomSession = {
  roomId: string;
  playerId: string;
  playerToken?: string;
  roomCode?: string;
};

type UrlRoomSession = StoredRoomSession & {
  source: "url";
};

type RoomClientCredential = {
  playerId?: string;
  playerToken?: string;
};

type RoomClientWriteCredentialBody = {
  expectedRevision?: number;
  playerId: string;
  playerToken?: string;
};

type RoomNetworkOrigin = {
  address: string;
  origin: string;
};

type RoomHealthStatus = {
  cleanup?: {
    enabled?: boolean;
    lastRunAt?: string;
    policy?: {
      finishedIdleMs?: number;
      inGameIdleMs?: number;
      lobbyIdleMs?: number;
    };
    removedLastRun?: number;
    roomCodesLastRun?: string[];
  };
  ok: boolean;
  deployment?: {
    multiInstanceSafe?: boolean;
    onlineReady?: boolean;
    publicOrigin?: string;
    publicOriginConfigured?: boolean;
    requirements?: {
      atomicRoomWrites?: boolean;
      httpsPublicOrigin?: boolean;
      persistentRoomStore?: boolean;
      singleNodeProcess?: boolean;
      sseRealtime?: boolean;
    };
    target?: string;
  };
  realtime?: {
    mode?: string;
    subscriberCount?: number;
  };
  rooms?: {
    inGame?: number;
    lobby?: number;
    maxRevision?: number;
    total?: number;
  };
  storage?: {
    adapter?: string;
    atomicWrites?: boolean;
    enabled?: boolean;
    mode?: string;
    revisioned?: boolean;
    revisionMode?: string;
    writeMode?: string;
  };
};

type RoomDebugCleanupResult = {
  ok: boolean;
  removed: number;
  rooms?: {
    inGame?: number;
    lobby?: number;
    maxRevision?: number;
    total?: number;
  };
};

type InvalidRoomSession = {
  detail: string;
  roomCode?: string;
  title: string;
};

type PendingKind = "command" | "create" | "debugCleanup" | "join" | "refresh" | "remove" | "seat" | "start" | null;

type RoomHostAudioClip =
  | string
  | {
      src: string;
      playbackRate?: number;
      volume?: number;
      preDelayMs?: number;
    };

type RoomHostAudioCue = {
  key: string;
  clips: RoomHostAudioClip[];
};

const AlphaPreflightPanel = AlphaPreflightPanelImpl;

function roomHostClip(name: string, options?: Omit<Extract<RoomHostAudioClip, { src: string }>, "src">): RoomHostAudioClip {
  const src = `${ROOM_HOST_AUDIO_BASE_PATH}/${name}.mp3`;
  return options ? { src, ...options } : src;
}

function roomSeatClip(seatId: number): RoomHostAudioClip {
  return roomHostClip(`seat-${seatId}`);
}

function roomHostClipSrc(clip: RoomHostAudioClip): string {
  return typeof clip === "string" ? clip : clip.src;
}

function roomHostClipPreDelayMs(clip: RoomHostAudioClip): number {
  return typeof clip === "string" ? 0 : (clip.preDelayMs ?? 0);
}

function latestRoomPublicEvent(game: HumanGameView): HumanGameView["publicEvents"][number] | undefined {
  return game.publicEvents.at(-1);
}

function findLatestUnplayedRoomPublicEvent(
  game: HumanGameView,
  completedKeys: ReadonlySet<string>,
  types: ReadonlySet<string>,
): HumanGameView["publicEvents"][number] | undefined {
  return [...game.publicEvents]
    .reverse()
    .find((event) => {
      const canCrossDayBoundary = event.type === "IDIOT_REVEALED";
      return (
        (event.day === game.day || canCrossDayBoundary) &&
        types.has(event.type) &&
        !completedKeys.has(`${game.id}:${event.seq}:${event.type}`)
      );
    });
}

function buildRoomHostAudioCue(game: HumanGameView, completedKeys: ReadonlySet<string> = new Set()): RoomHostAudioCue {
  const currentSpeaker = game.currentSpeakerSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentSpeakerSeatId)
    : undefined;
  const currentActor = game.currentActorSeatId
    ? game.seats.find((seat) => seat.seatId === game.currentActorSeatId)
    : undefined;
  const pendingIdiotEvent = findLatestUnplayedRoomPublicEvent(game, completedKeys, IDIOT_REVEAL_EVENT_TYPES);
  if (pendingIdiotEvent) {
    const seatId = typeof pendingIdiotEvent.payload.seatId === "number" ? pendingIdiotEvent.payload.seatId : pendingIdiotEvent.actorSeatId;
    return {
      key: `${game.id}:${pendingIdiotEvent.seq}:idiot-revealed`,
      clips: [...(seatId ? [roomSeatClip(seatId)] : []), roomHostClip("idiot-revealed")],
    };
  }

  if (game.phase === "DAY_SPEECH") {
    if (currentSpeaker?.isHuman) {
      return { key: `${game.id}:${game.day}:speech:human`, clips: [roomHostClip("your-turn-speak")] };
    }
    if (currentSpeaker) {
      return {
        key: `${game.id}:${game.day}:speech:${currentSpeaker.seatId}`,
        clips: [roomSeatClip(currentSpeaker.seatId), roomHostClip("please-speak", { playbackRate: 1.16, volume: 0.88 })],
      };
    }
    return { key: `${game.id}:${game.day}:speech:complete`, clips: [] };
  }

  if (game.phase === "DAY_VOTE") {
    if (currentActor?.isHuman) {
      return { key: `${game.id}:${game.day}:vote:human`, clips: [roomHostClip("your-turn-vote")] };
    }
    if (currentActor) {
      return {
        key: `${game.id}:${game.day}:vote:${currentActor.seatId}`,
        clips: [roomHostClip("please"), roomSeatClip(currentActor.seatId), roomHostClip("vote")],
      };
    }
    return { key: `${game.id}:${game.day}:vote:start`, clips: [roomHostClip("day-vote-start")] };
  }

  if (game.phase === "DAY_ANNOUNCEMENT") {
    return {
      key: `${game.id}:${game.day}:dawn:${latestRoomPublicEvent(game)?.seq ?? 0}`,
      clips: [roomHostClip("dawn-report")],
    };
  }

  if (game.phase === "EXILE_RESOLUTION") {
    return {
      key: `${game.id}:${game.day}:exile:${latestRoomPublicEvent(game)?.seq ?? 0}`,
      clips: [roomHostClip("vote-revealed")],
    };
  }

  if (game.phase === "LAST_WORDS") {
    return {
      key: `${game.id}:${game.day}:last-words:${game.currentActorSeatId ?? "host"}`,
      clips: [roomHostClip("last-words", { playbackRate: 1.08, volume: 0.9 })],
    };
  }

  if (game.phase === "HUNTER_REVEAL") {
    return {
      key: `${game.id}:${game.day}:hunter-reveal:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [],
    };
  }

  if (game.phase === "HUNTER_SHOT") {
    return {
      key: `${game.id}:${game.day}:hunter:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [roomHostClip(currentActor?.isHuman ? "hunter-shot-human" : "hunter-shot")],
    };
  }

  if (game.phase === "WOLF_KING_SHOT") {
    return {
      key: `${game.id}:${game.day}:wolf-king:${currentActor?.isHuman ? "human" : "ai"}`,
      clips: [roomHostClip(currentActor?.isHuman ? "wolf-king-shot-human" : "wolf-king-shot")],
    };
  }

  if (game.phase === "GAME_OVER") {
    return {
      key: `${game.id}:game-over:${game.result?.winner ?? "unknown"}`,
      clips: [roomHostClip(game.result?.winner === "GOOD" ? "game-over-good" : "game-over-wolves")],
    };
  }

  const phaseClips: Partial<Record<HumanGameView["phase"], string>> = {
    NIGHT_WOLVES: "night-wolves",
    NIGHT_GUARD: "night-guard",
    NIGHT_SEER: "night-seer",
    NIGHT_WITCH: "night-witch",
    SHERIFF_NOMINATION: "sheriff-nomination-start",
    SHERIFF_SPEECH: "sheriff-speech-start",
    SHERIFF_WITHDRAWAL: "sheriff-withdrawal-start",
    SHERIFF_VOTE: "sheriff-vote-start",
    SHERIFF_PK_SPEECH: "sheriff-pk-speech-start",
    SHERIFF_PK_VOTE: "sheriff-pk-vote-start",
    SHERIFF_HANDOFF: "sheriff-handoff-start",
  };
  return {
    key: `${game.id}:${game.day}:${game.phase}:${game.currentActorSeatId ?? game.currentSpeakerSeatId ?? latestRoomPublicEvent(game)?.seq ?? 0}`,
    clips: [roomHostClip(phaseClips[game.phase] ?? "flow-next")],
  };
}

function waitForRoomAudioReady(audio: HTMLAudioElement, timeoutMs = 700): Promise<void> {
  if (audio.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const done = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("loadeddata", done);
      audio.removeEventListener("canplay", done);
      window.clearTimeout(timer);
      resolve();
    };
    timer = window.setTimeout(done, timeoutMs);
    audio.addEventListener("loadeddata", done, { once: true });
    audio.addEventListener("canplay", done, { once: true });
  });
}

async function playRoomHostClip(audio: HTMLAudioElement, source: string): Promise<void> {
  audio.src = source;
  audio.load();
  await waitForRoomAudioReady(audio);
  await audio.play();
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error(`房间主持音频加载失败：${audio.currentSrc || audio.src}`));
  });
}

export function RoomClient() {
  const [roomView, setRoomView] = useState<RoomView | null>(null);
  const [hostName, setHostName] = useState("房主");
  const [playerName, setPlayerName] = useState("玩家");
  const [roomCode, setRoomCode] = useState("");
  const [boardId, setBoardId] = useState(BOARD_OPTIONS[0].id);
  const [preferredSeatId, setPreferredSeatId] = useState(1);
  const [pending, setPending] = useState<PendingKind>(null);
  const [pendingCommandType, setPendingCommandType] = useState<CommandPayload["type"] | null>(null);
  const [hostAudioStatus, setHostAudioStatus] = useState<HostAudioStatus | null>(null);
  const [idiotReveal, setIdiotReveal] = useState<IdiotRevealCue | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [activeSseSyncKey, setActiveSseSyncKey] = useState<string | null>(null);
  const [lastSseEventAt, setLastSseEventAt] = useState<number | null>(null);
  const [networkOrigins, setNetworkOrigins] = useState<RoomNetworkOrigin[]>([]);
  const [roomHealth, setRoomHealth] = useState<RoomHealthStatus | null>(null);
  const [pageOrigin, setPageOrigin] = useState("");
  const [invalidSession, setInvalidSession] = useState<InvalidRoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hostAudioRef = useRef<HTMLAudioElement | null>(null);
  const hostAudioRunRef = useRef(0);
  const lastHostAudioKeyRef = useRef<string | null>(null);
  const completedHostAudioKeysRef = useRef<Set<string>>(new Set());
  const activeIdiotRevealKeyRef = useRef<string | null>(null);
  const completedIdiotRevealKeysRef = useRef<Set<string>>(new Set());
  const idiotRevealTimerRef = useRef<number | null>(null);
  const commandRequestKeyRef = useRef<string | null>(null);
  const silentRefreshInFlightRef = useRef(false);

  const activeRoomId = roomView?.room.id;
  const activePlayerId = roomView?.playerId;
  const activePlayerToken = roomView?.playerToken;
  const activeRoomSyncKey = activeRoomId && activePlayerId ? roomSyncKey(activeRoomId, activePlayerId) : null;
  const isRoomSseSynced = Boolean(activeRoomSyncKey && activeSseSyncKey === activeRoomSyncKey);
  const isHost = Boolean(roomView?.playerId && roomView.playerId === roomView.room.hostPlayerId);
  const selfPlayer = roomView?.room.players.find((player) => player.playerId === roomView.playerId);
  const activeGame = roomView?.room.status === "in_game" ? roomView.game : null;
  const shareOrigin = useMemo(
    () => roomHealth?.deployment?.publicOrigin ?? selectRoomShareOrigin(networkOrigins),
    [networkOrigins, roomHealth?.deployment?.publicOrigin],
  );
  const phaseCurtainKey = activeGame ? `${activeGame.id}:${activeGame.day}:${activeGame.phase}` : null;
  const phaseCurtainCue = activeGame ? getPhaseCurtainCue(activeGame) : null;
  const boardSeatIds = useMemo(() => {
    const count = roomView?.room.board.seatCount ?? 9;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [roomView?.room.board.seatCount]);

  const saveRoomSession = useCallback((view: RoomView) => {
    if (!view.playerId) return;
    const stored: StoredRoomSession = {
      roomId: view.room.id,
      playerId: view.playerId,
      playerToken: view.playerToken,
      roomCode: view.room.code,
    };
    window.localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(stored));
  }, []);

  const applyRoomView = useCallback(
    (view: RoomView) => {
      setInvalidSession(null);
      setRoomView(view);
      saveRoomSession(view);
      if (view.room.code) setRoomCode(view.room.code);
      if (view.playerSeatId) setPreferredSeatId(view.playerSeatId);
    },
    [saveRoomSession],
  );

  const stopRoomHostAudio = useCallback(() => {
    hostAudioRunRef.current += 1;
    if (hostAudioRef.current) {
      hostAudioRef.current.pause();
      hostAudioRef.current.src = "";
      hostAudioRef.current = null;
    }
    setHostAudioStatus(null);
  }, []);

  const invalidateRoomSession = useCallback(
    (message: string, options: { roomCode?: string } = {}) => {
      const cleanRoomCode = (options.roomCode ?? roomView?.room.code ?? roomCode).trim().toUpperCase();
      window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
      stopRoomHostAudio();
      setRoomView(null);
      setActiveSseSyncKey(null);
      setLastSseEventAt(null);
      setPending(null);
      setPendingCommandType(null);
      setError(null);
      setNotice(null);
      if (cleanRoomCode) setRoomCode(cleanRoomCode);
      setInvalidSession({
        detail: buildInvalidRoomSessionDetail(message),
        roomCode: cleanRoomCode || undefined,
        title: buildInvalidRoomSessionTitle(message),
      });
    },
    [roomCode, roomView?.room.code, stopRoomHostAudio],
  );

  const refreshView = useCallback(
    async (silent = false) => {
      if (!activeRoomId || !activePlayerId) return;
      if (silent && silentRefreshInFlightRef.current) return;
      if (silent) silentRefreshInFlightRef.current = true;
      if (!silent) setPending("refresh");
      if (!silent) setError(null);
      try {
        const view = await getRoomView(activeRoomId, { playerId: activePlayerId, playerToken: activePlayerToken });
        applyRoomView(view);
        setError(null);
        if (!silent) setNotice("房间视图已刷新。");
      } catch (err) {
        const message = readErrorMessage(err);
        if (isInvalidRoomSessionError(err)) {
          invalidateRoomSession(message);
          return;
        }
        setError(silent ? `连接暂时中断：${message}。已保留当前牌桌，并会继续尝试恢复。` : message);
      } finally {
        if (silent) silentRefreshInFlightRef.current = false;
        if (!silent) setPending(null);
      }
    },
    [activePlayerId, activePlayerToken, activeRoomId, applyRoomView, invalidateRoomSession],
  );

  useEffect(() => {
    if (!activeRoomId || !activePlayerId || typeof EventSource === "undefined") return;
    const syncKey = roomSyncKey(activeRoomId, activePlayerId);
    let terminalSyncError = false;
    const streamParams = new URLSearchParams();
    if (activePlayerToken) {
      streamParams.set("playerToken", activePlayerToken);
      streamParams.set("playerId", activePlayerId);
    } else {
      streamParams.set("playerId", activePlayerId);
    }

    const markSseAlive = (nextSyncKey = syncKey) => {
      setActiveSseSyncKey(nextSyncKey);
      setLastSseEventAt(Date.now());
      setError((current) => (isTransientRoomSyncError(current) ? null : current));
    };

    const source = new EventSource(`/api/rooms/${encodeURIComponent(activeRoomId)}/stream?${streamParams.toString()}`);
    const handleRoomEvent = (event: Event) => {
      const view = parseRoomSseEvent(event);
      if (!view) {
        setError("实时同步数据异常，已保留当前牌桌，并继续使用轮询。");
        return;
      }

      applyRoomView(view);
      if (!view.playerId) return;
      markSseAlive(roomSyncKey(view.room.id, view.playerId));
    };
    const handleHeartbeatEvent = () => {
      markSseAlive(syncKey);
    };
    const handleSyncError = (event: Event) => {
      const serverMessage = parseRoomSseErrorEvent(event);
      if (serverMessage && isInvalidRoomSessionMessage(serverMessage)) {
        terminalSyncError = true;
        invalidateRoomSession(serverMessage);
        return;
      }
      if (terminalSyncError) return;

      setActiveSseSyncKey((current) => (current === syncKey ? null : current));
      setLastSseEventAt(null);
      setError((current) => current ?? "实时同步暂时断开，已保留当前牌桌，并继续使用轮询。");
    };

    source.addEventListener("room", handleRoomEvent);
    source.addEventListener("heartbeat", handleHeartbeatEvent);
    source.addEventListener("error", handleSyncError);

    return () => {
      source.removeEventListener("room", handleRoomEvent);
      source.removeEventListener("heartbeat", handleHeartbeatEvent);
      source.removeEventListener("error", handleSyncError);
      source.close();
    };
  }, [activePlayerId, activePlayerToken, activeRoomId, applyRoomView, invalidateRoomSession]);

  const playRoomHostAudioCue = useCallback(async (cue: RoomHostAudioCue, runId: number) => {
    setHostAudioStatus({ key: cue.key });
    for (const clip of cue.clips) {
      if (hostAudioRunRef.current !== runId) return;
      const preDelayMs = roomHostClipPreDelayMs(clip);
      if (preDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, preDelayMs));
        if (hostAudioRunRef.current !== runId) return;
      }

      const source = roomHostClipSrc(clip);
      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = typeof clip === "string" ? 0.92 : (clip.volume ?? 0.92);
      audio.playbackRate = typeof clip === "string" ? 1 : (clip.playbackRate ?? 1);
      hostAudioRef.current = audio;

      try {
        await playRoomHostClip(audio, source);
      } catch {
        console.info(`房间主持音频未找到或被浏览器拦截：${source}`);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPageOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let canceled = false;
    loadRoomNetworkOrigins()
      .then((origins) => {
        if (!canceled) setNetworkOrigins(origins);
      })
      .catch(() => {
        if (!canceled) setNetworkOrigins([]);
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    loadRoomHealthStatus()
      .then((health) => {
        if (!canceled) setRoomHealth(health);
      })
      .catch(() => {
        if (!canceled) setRoomHealth(null);
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const timer = window.setTimeout(() => {
      const urlSession = readUrlRoomSession();
      const urlRoomHint = readUrlRoomHint();
      const stored = readStoredSession();
      const sessionToRestore =
        urlSession ?? (urlRoomHint && stored && !storedMatchesRoomHint(stored, urlRoomHint) ? null : stored);

      if (urlRoomHint) {
        setRoomCode(urlRoomHint.toUpperCase());
      }

      if (!sessionToRestore || canceled) {
        if (urlRoomHint) {
          setNotice("已填入邀请房间码，请输入昵称加入。");
        }
        return;
      }

      setIsRestoringSession(true);
      setNotice(urlSession ? "正在通过链接恢复房间..." : "正在恢复上次房间...");
      getRoomView(sessionToRestore.roomId, sessionToRestore)
        .then((view) => {
          if (canceled) return;
          applyRoomView(view);
          setNotice(urlSession ? "已通过链接恢复房间。" : "已恢复上次房间。");
        })
        .catch((err) => {
          if (canceled) return;
          window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
          const message = readErrorMessage(err);
          const cleanRoomCode = (sessionToRestore.roomCode ?? sessionToRestore.roomId).toUpperCase();
          setRoomCode(cleanRoomCode);
          setNotice(null);
          setError(null);
          setInvalidSession({
            detail: buildInvalidRoomSessionDetail(message),
            roomCode: cleanRoomCode,
            title: urlSession ? "恢复链接已失效" : buildInvalidRoomSessionTitle(message),
          });
        })
        .finally(() => {
          if (!canceled) setIsRestoringSession(false);
        });
    }, 0);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [applyRoomView]);

  useEffect(() => {
    return () => stopRoomHostAudio();
  }, [stopRoomHostAudio]);

  useEffect(() => {
    if (!roomView?.room.id || !roomView.playerId) return;
    const intervalMs = isRoomSseSynced
      ? ROOM_SSE_FALLBACK_POLL_MS
      : roomView.room.status === "in_game"
        ? ROOM_FAST_POLL_IN_GAME_MS
        : ROOM_FAST_POLL_LOBBY_MS;
    const timer = window.setInterval(() => {
      void refreshView(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isRoomSseSynced, refreshView, roomView?.playerId, roomView?.room.id, roomView?.room.status]);

  useEffect(() => {
    if (!activeRoomSyncKey || activeSseSyncKey !== activeRoomSyncKey || !lastSseEventAt) return;
    const timeoutMs = Math.max(0, ROOM_SSE_STALE_MS - (Date.now() - lastSseEventAt));
    const timer = window.setTimeout(() => {
      setActiveSseSyncKey((current) => (current === activeRoomSyncKey ? null : current));
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [activeRoomSyncKey, activeSseSyncKey, lastSseEventAt]);

  useEffect(() => {
    if (!roomView?.room.id || !roomView.playerId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshView(true);
    };
    const refreshWhenActive = () => void refreshView(true);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
  }, [refreshView, roomView?.playerId, roomView?.room.id]);

  useEffect(() => {
    if (!activeGame) return;

    const cue = buildRoomHostAudioCue(activeGame, completedHostAudioKeysRef.current);
    if (completedHostAudioKeysRef.current.has(cue.key)) return;
    if (cue.clips.length === 0) {
      completedHostAudioKeysRef.current.add(cue.key);
      return;
    }
    if (lastHostAudioKeyRef.current === cue.key) return;

    lastHostAudioKeyRef.current = cue.key;
    stopRoomHostAudio();
    const runId = hostAudioRunRef.current;
    const delayMs = activeGame.phase === "DAY_ANNOUNCEMENT" ? 0 : 260;
    const timer = window.setTimeout(() => {
      void playRoomHostAudioCue(cue, runId).finally(() => {
        if (hostAudioRunRef.current === runId) {
          setHostAudioStatus(null);
          completedHostAudioKeysRef.current.add(cue.key);
        }
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeGame, playRoomHostAudioCue, stopRoomHostAudio]);

  useEffect(() => {
    if (!activeGame) {
      if (idiotRevealTimerRef.current !== null) {
        window.clearTimeout(idiotRevealTimerRef.current);
        idiotRevealTimerRef.current = null;
      }
      activeIdiotRevealKeyRef.current = null;
      window.setTimeout(() => setIdiotReveal(null), 0);
      return;
    }

    const event = findLatestUnplayedRoomPublicEvent(activeGame, completedIdiotRevealKeysRef.current, IDIOT_REVEAL_EVENT_TYPES);
    if (!event) return;

    const cue = buildIdiotRevealCue(activeGame, event);
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
  }, [activeGame]);

  useEffect(() => {
    return () => {
      if (idiotRevealTimerRef.current !== null) window.clearTimeout(idiotRevealTimerRef.current);
    };
  }, []);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("create");
    setInvalidSession(null);
    setError(null);
    setNotice(null);
    try {
      const view = await postRoomView("/api/rooms", {
        boardId,
        hostName,
        hostSeatId: preferredSeatId,
      });
      applyRoomView(view);
      setNotice(`房间已创建：${view.room.code}`);
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanRoomCode = roomCode.trim();
    if (!cleanRoomCode) {
      setError("请输入房间码。");
      return;
    }
    setPending("join");
    setInvalidSession(null);
    setError(null);
    setNotice(null);
    try {
      const stored = readStoredSession();
      if (stored && storedMatchesRoomHint(stored, cleanRoomCode)) {
        try {
          const restored = await getRoomView(stored.roomId, stored);
          applyRoomView(restored);
          setNotice(`已恢复房间：${restored.room.code}`);
          return;
        } catch (err) {
          if (!isInvalidRoomSessionError(err)) throw err;
          window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
        }
      }

      const view = await postRoomView(`/api/rooms/${encodeURIComponent(cleanRoomCode)}/join`, {
        playerName,
        seatId: preferredSeatId,
      });
      applyRoomView(view);
      setNotice(view.room.status === "in_game" ? `已恢复房间：${view.room.code}` : `已加入房间：${view.room.code}`);
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleSeatChange(seatId: number | null) {
    if (!roomView?.room.id || !roomView.playerId) return;
    setPending("seat");
    setError(null);
    setNotice(null);
    try {
      const view = await postRoomView(`/api/rooms/${roomView.room.id}/seats`, {
        ...buildCurrentRoomCredentialBody(roomView),
        seatId,
      });
      applyRoomView(view);
      setNotice(seatId ? `已入座 ${seatId} 号位。` : "已离开座位。");
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleLeaveRoom() {
    if (!roomView?.room.id || !roomView.playerId) {
      clearSession({ forgetStoredSession: true });
      return;
    }

    if (roomView.room.status !== "lobby") {
      clearSession();
      return;
    }

    setPending("seat");
    setError(null);
    setNotice(null);
    try {
      await postRoomView(`/api/rooms/${roomView.room.id}/leave`, {
        ...buildCurrentRoomCredentialBody(roomView),
      });
      clearSession({ forgetStoredSession: true });
      setNotice("已离开房间并释放座位。");
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleRemovePlayer(targetPlayerId: string) {
    if (!roomView?.room.id || !roomView.playerId) return;
    setPending("remove");
    setError(null);
    setNotice(null);
    try {
      const view = await postRoomView(`/api/rooms/${roomView.room.id}/remove`, {
        expectedRevision: roomView.room.revision,
        requesterPlayerId: roomView.playerId,
        requesterPlayerToken: roomView.playerToken,
        targetPlayerId,
      });
      applyRoomView(view);
      setNotice("已移除玩家并释放座位。");
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleStartRoom() {
    if (!roomView?.room.id || !roomView.playerId) return;
    setPending("start");
    setError(null);
    setNotice(null);
    try {
      const view = await postRoomView(`/api/rooms/${roomView.room.id}/start`, {
        ...buildCurrentRoomCredentialBody(roomView),
      });
      applyRoomView(view);
      setNotice("游戏已开始。");
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function handleCopyInviteLink() {
    if (!roomView) return;
    const link = buildRoomLink(roomView.room.code, undefined, shareOrigin);
    await copyRoomLink(link, buildCopyNotice("邀请链接已复制，朋友打开后输入昵称即可加入。", shareOrigin), setNotice, setError);
  }

  async function handleCopyRecoveryLink() {
    if (!roomView?.playerId) return;
    await copyRoomLink(
      buildRoomLink(roomView.room.code, roomView.playerToken ? { playerToken: roomView.playerToken } : { playerId: roomView.playerId }, shareOrigin),
      buildCopyNotice("我的恢复链接已复制，只能自己保存使用，不要发给其他玩家。", shareOrigin),
      setNotice,
      setError,
    );
  }

  async function handleCopyPlayerRecoveryLink(player: RoomPlayerView) {
    if (!roomView) return;
    const playerLabel = `${player.seatId ? `${player.seatId}号 ` : ""}${player.name}`;
    await copyRoomLink(
      buildRoomLink(roomView.room.code, player.playerToken ? { playerToken: player.playerToken } : { playerId: player.playerId }, shareOrigin),
      buildCopyNotice(`${playerLabel} 的恢复链接已复制，请只发给本人。`, shareOrigin),
      setNotice,
      setError,
    );
  }

  async function handleSubmitCommand(command: HumanCommandInput) {
    if (!roomView?.room.id || !roomView.playerId || commandRequestKeyRef.current) return;
    const idempotencyKey = createRoomIdempotencyKey();
    commandRequestKeyRef.current = idempotencyKey;
    setPending("command");
    setPendingCommandType(command.type as CommandPayload["type"]);
    setError(null);
    setNotice(null);
    try {
      const view = await postRoomView(`/api/rooms/${roomView.room.id}/commands`, {
        ...buildCurrentRoomCredentialBody(roomView),
        idempotencyKey,
        ...command,
      });
      applyRoomView(view);
      setNotice("动作已提交。");
    } catch (err) {
      setError(readErrorMessage(err));
    } finally {
      if (commandRequestKeyRef.current === idempotencyKey) {
        commandRequestKeyRef.current = null;
      }
      setPending(null);
      setPendingCommandType(null);
    }
  }

  function clearSession(options: { forgetStoredSession?: boolean } = {}) {
    const previousRoomCode = roomView?.room.code;
    if (options.forgetStoredSession) {
      window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
    }
    setInvalidSession(null);
    setRoomView(null);
    setRoomCode(options.forgetStoredSession ? "" : (previousRoomCode ?? ""));
    setIsRestoringSession(false);
    setError(null);
    setNotice(
      options.forgetStoredSession
        ? null
        : previousRoomCode
          ? `已退出当前视图。输入房间码 ${previousRoomCode} 可恢复你的座位。`
          : null,
    );
  }

  if (activeGame && roomView) {
    return (
      <RoomGameShell
        error={error}
        game={activeGame}
        isHost={isHost}
        isSubmitting={pending === "command"}
        onExitRoom={async () => clearSession()}
        onNewGame={async () => clearSession()}
        onCopyPlayerRecoveryLink={(player) => void handleCopyPlayerRecoveryLink(player)}
        onSubmit={handleSubmitCommand}
        hostAudioStatus={hostAudioStatus}
        idiotReveal={idiotReveal}
        pendingCommandType={pendingCommandType}
        phaseCurtain={phaseCurtainCue && phaseCurtainKey ? { cue: phaseCurtainCue, key: phaseCurtainKey } : null}
        playerSeatId={roomView.playerSeatId}
        roomCode={roomView.room.code}
        roomPlayers={roomView.room.players}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0a07] text-[#f7ecd2]">
      <div
        className="min-h-screen bg-[linear-gradient(180deg,rgba(11,7,5,0.76),rgba(11,7,5,0.96)),url('/images/werewolf-table-bg.jpg')] bg-cover bg-center px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <header className="rounded-[28px] border border-[#7b5a28]/50 bg-[#160f0b]/90 px-5 py-5 shadow-2xl shadow-black/45 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#f0cf79]">
                  <span className="rounded-full border border-[#7b5a28]/60 bg-black/25 px-3 py-1">MULTIPLAYER ROOM</span>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-950/50 px-3 py-1 text-emerald-200">
                    本地房间 MVP
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-normal text-[#fff7df] sm:text-4xl">多人房间</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d9c9a8]">
                  多个真人入座，AI 自动补齐空位。当前房间保存在本机开发进程内。
                </p>
              </div>
              {roomView ? (
                <div className="flex flex-wrap gap-2 text-sm">
                  <StatusPill label="房间码" value={roomView.room.code} tone="gold" />
                  <StatusPill label="状态" value={roomStatusLabel(roomView.room.status)} tone="green" />
                  <StatusPill label="在线" value={roomOnlineSummary(roomView.room.players)} tone="green" />
                  {selfPlayer ? <StatusPill label="我" value={`${selfPlayer.name}${roomView.playerSeatId ? ` · ${roomView.playerSeatId}号` : ""}`} tone="blue" /> : null}
                </div>
              ) : null}
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-[24px] border border-[#7b5a28]/45 bg-[#140c09]/88 p-4 shadow-xl shadow-black/35">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-[#fff1c2]">房间入口</h2>
                {roomView ? (
                  <button
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#d9c9a8] transition hover:border-[#f0cf79]/40 hover:text-[#fff1c2]"
                    disabled={pending !== null}
                    onClick={() => void handleLeaveRoom()}
                    type="button"
                  >
                    {pending === "seat" ? "离开中..." : roomView.room.status === "lobby" ? "离开房间" : "退出本地会话"}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <form className="space-y-3 rounded-2xl border border-[#7b5a28]/35 bg-black/20 p-3" onSubmit={handleCreateRoom}>
                  <FormField label="昵称">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
                      maxLength={16}
                      onChange={(event) => setHostName(event.target.value)}
                      value={hostName}
                    />
                  </FormField>
                  <FormField label="板子">
                    <select
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
                      onChange={(event) => setBoardId(event.target.value)}
                      value={boardId}
                    >
                      {BOARD_OPTIONS.map((board) => (
                        <option className="bg-[#160f0b]" key={board.id} value={board.id}>
                          {board.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <SeatPicker maxSeat={boardId.startsWith("9p") ? 9 : 12} onChange={setPreferredSeatId} value={preferredSeatId} />
                  <button
                    className="w-full rounded-xl border border-[#f0cf79]/45 bg-[#f0cf79] px-4 py-2.5 text-sm font-black text-[#1c1208] transition hover:bg-[#ffe29a] disabled:opacity-55"
                    disabled={pending !== null || isRestoringSession}
                    type="submit"
                  >
                    {isRestoringSession ? "恢复中..." : pending === "create" ? "创建中..." : "创建房间"}
                  </button>
                </form>

                <form className="space-y-3 rounded-2xl border border-[#7b5a28]/35 bg-black/20 p-3" onSubmit={handleJoinRoom}>
                  <FormField label="房间码">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm uppercase text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
                      maxLength={12}
                      onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                      value={roomCode}
                    />
                  </FormField>
                  <FormField label="昵称">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-[#fff7df] outline-none transition focus:border-[#f0cf79]/60"
                      maxLength={16}
                      onChange={(event) => setPlayerName(event.target.value)}
                      value={playerName}
                    />
                  </FormField>
                  <SeatPicker maxSeat={12} onChange={setPreferredSeatId} value={preferredSeatId} />
                  <button
                    className="w-full rounded-xl border border-emerald-400/35 bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#04140a] transition hover:bg-emerald-300 disabled:opacity-55"
                    disabled={pending !== null || isRestoringSession}
                    type="submit"
                  >
                    {isRestoringSession ? "恢复中..." : pending === "join" ? "加入中..." : "加入房间"}
                  </button>
                </form>
              </div>

              <Feedback error={error} notice={notice} />
              <AlphaPreflightPanel
                activeRoomId={roomView?.room.id}
                pageOrigin={pageOrigin}
                roomHealth={roomHealth}
                setError={setError}
                setPending={setPending}
                setRoomHealth={setRoomHealth}
                setNotice={setNotice}
                shareOrigin={shareOrigin}
              />
            </section>

            <section className="min-h-[620px] rounded-[28px] border border-[#7b5a28]/45 bg-[#120c09]/88 p-4 shadow-xl shadow-black/35 sm:p-5">
              {roomView ? (
                <div className="flex h-full flex-col gap-5">
                  <RoomToolbar
                    isHost={isHost}
                    onCopyInviteLink={() => void handleCopyInviteLink()}
                    onCopyRecoveryLink={() => void handleCopyRecoveryLink()}
                    onRefresh={() => void refreshView(false)}
                    onStart={() => void handleStartRoom()}
                    pending={pending}
                    roomView={roomView}
                    shareOrigin={shareOrigin}
                  />
                  {roomView.room.status === "lobby" ? (
                    <LobbyView
                      isHost={isHost}
                      onCopyPlayerRecoveryLink={(player) => void handleCopyPlayerRecoveryLink(player)}
                      onRemovePlayer={(playerId) => void handleRemovePlayer(playerId)}
                      onSeatChange={(seatId) => void handleSeatChange(seatId)}
                      pending={pending}
                      roomView={roomView}
                      seatIds={boardSeatIds}
                    />
                  ) : roomView.game ? (
                    <GameRoomView
                      game={roomView.game}
                      hostAudioStatus={null}
                      isSubmitting={pending === "command"}
                      onNewGame={async () => clearSession()}
                      pendingCommandType={pendingCommandType}
                      onSubmit={handleSubmitCommand}
                    />
                  ) : (
                    <EmptyRoomState title="等待私有视图" detail="刷新房间后会显示当前玩家视角。" />
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  <Feedback error={error} notice={notice} />
                  {invalidSession ? (
                    <InvalidRoomSessionState session={invalidSession} />
                  ) : (
                    <EmptyRoomState title="未进入房间" detail="创建房间或输入房间码加入后，这里会显示大厅和对局视图。" />
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function RoomToolbar({
  isHost,
  onCopyInviteLink,
  onCopyRecoveryLink,
  onRefresh,
  onStart,
  pending,
  roomView,
  shareOrigin,
}: {
  isHost: boolean;
  onCopyInviteLink: () => void;
  onCopyRecoveryLink: () => void;
  onRefresh: () => void;
  onStart: () => void;
  pending: PendingKind;
  roomView: RoomView;
  shareOrigin?: string;
}) {
  const humanCount = roomView.room.seats.filter((seat) => seat.controller === "human").length;
  const onlineCount = roomView.room.players.filter((player) => player.online).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/22 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-sm font-bold text-[#f0cf79]">{roomView.room.board.name}</div>
        <div className="mt-1 text-xs text-[#bba98a]">
          {roomView.room.board.roleSummary} · 真人 {humanCount} / {roomView.room.board.seatCount}
        </div>
        <div className="mt-2 text-xs font-bold text-emerald-200">
          真人在线 {onlineCount} / {roomView.room.players.length}
        </div>
        {shareOrigin ? <div className="mt-2 text-xs text-emerald-200">手机链接将使用：{shareOrigin}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl border border-[#f0cf79]/30 bg-[#2a1d10] px-4 py-2 text-sm font-bold text-[#f8e9c2] transition hover:border-[#f0cf79]/65 disabled:opacity-55"
          disabled={pending !== null}
          onClick={onCopyInviteLink}
          type="button"
        >
          复制邀请链接
        </button>
        <button
          className="rounded-xl border border-sky-300/25 bg-sky-950/35 px-4 py-2 text-sm font-bold text-sky-100 transition hover:border-sky-200/45 disabled:opacity-55"
          disabled={pending !== null || !roomView.playerId}
          onClick={onCopyRecoveryLink}
          type="button"
        >
          复制我的恢复链接
        </button>
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#f8e9c2] transition hover:border-[#f0cf79]/45 disabled:opacity-55"
          disabled={pending !== null}
          onClick={onRefresh}
          type="button"
        >
          {pending === "refresh" ? "刷新中..." : "刷新视图"}
        </button>
        {roomView.room.status === "lobby" && isHost ? (
          <button
            className="rounded-xl border border-[#f0cf79]/45 bg-[#f0cf79] px-4 py-2 text-sm font-black text-[#1c1208] transition hover:bg-[#ffe29a] disabled:opacity-55"
            disabled={pending !== null || humanCount === 0}
            onClick={onStart}
            type="button"
          >
            {pending === "start" ? "开局中..." : "开始游戏"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RoomGameShell({
  error,
  game,
  hostAudioStatus,
  idiotReveal,
  isHost,
  isSubmitting,
  onCopyPlayerRecoveryLink,
  onExitRoom,
  onNewGame,
  onSubmit,
  pendingCommandType,
  phaseCurtain,
  playerSeatId,
  roomCode,
  roomPlayers,
}: {
  error: string | null;
  game: HumanGameView;
  hostAudioStatus: HostAudioStatus | null;
  idiotReveal: IdiotRevealCue | null;
  isHost: boolean;
  isSubmitting: boolean;
  onCopyPlayerRecoveryLink: (player: RoomPlayerView) => void;
  onExitRoom: () => Promise<void>;
  onNewGame: () => Promise<void>;
  onSubmit: (command: HumanCommandInput) => Promise<void>;
  pendingCommandType: CommandPayload["type"] | null;
  phaseCurtain: { cue: PhaseCurtainCue; key: string } | null;
  playerSeatId?: number;
  roomCode: string;
  roomPlayers: RoomPlayerView[];
}) {
  const onlineCount = roomPlayers.filter((player) => player.online).length;

  return (
    <main
      className="min-h-screen bg-[#100b0a] bg-cover bg-center bg-fixed text-[#f7ead5]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(7,9,12,0.72), rgba(16,11,10,0.88)), url('/images/werewolf-table-bg.jpg')",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-3 py-3 sm:px-5 lg:px-7">
        <div className="sticky top-3 z-40 rounded-2xl border border-[#7b5a28]/45 bg-[#130d0b]/92 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#d9c9a8]">
              <span className="rounded-full border border-[#f0cf79]/35 bg-[#f0cf79]/10 px-3 py-1 text-[#f0cf79]">
                房间 {roomCode}
              </span>
              {playerSeatId ? (
                <span className="rounded-full border border-sky-300/25 bg-sky-950/35 px-3 py-1 text-sky-100">
                  我是 {playerSeatId}号
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[#c9b895]">
                当前对局中
              </span>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-950/35 px-3 py-1 text-emerald-100">
                在线 {onlineCount}/{roomPlayers.length}
              </span>
            </div>
            <button
              className="min-h-10 rounded-xl border border-red-300/30 bg-red-950/45 px-4 py-2 text-sm font-black text-red-100 transition hover:border-red-200/60 hover:bg-red-900/70 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isSubmitting}
              onClick={() => void onExitRoom()}
              type="button"
            >
              {isSubmitting ? "动作提交中..." : "退出当前房间"}
            </button>
          </div>
          {roomPlayers.some((player) => !player.online) ? (
            <div className="mt-2 text-xs text-[#bba98a]">
              断线提示：
              {roomPlayers
                .filter((player) => !player.online)
                .map((player) => `${player.seatId ? `${player.seatId}号 ` : ""}${player.name}（${formatPlayerPresence(player)}）`)
                .join("、")}
            </div>
          ) : null}
          {isHost ? (
            <HostPlayerRecoveryPanel
              disabled={isSubmitting}
              onCopyPlayerRecoveryLink={onCopyPlayerRecoveryLink}
              players={roomPlayers}
            />
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-[#e46d55]/45 bg-[#381511]/90 px-4 py-3 text-sm text-[#ffd8cf] shadow-lg">
            {error}
          </div>
        ) : null}

        <GameRoomView
          game={game}
          hostAudioStatus={hostAudioStatus}
          isSubmitting={isSubmitting}
          onNewGame={onNewGame}
          onSubmit={onSubmit}
          pendingCommandType={pendingCommandType}
        />
      </div>

      {phaseCurtain ? <PhaseCurtain key={phaseCurtain.key} cue={phaseCurtain.cue} /> : null}
      {idiotReveal ? <IdiotRevealOverlay key={idiotReveal.key} cue={idiotReveal} /> : null}
    </main>
  );
}

function HostPlayerRecoveryPanel({
  disabled,
  onCopyPlayerRecoveryLink,
  players,
}: {
  disabled: boolean;
  onCopyPlayerRecoveryLink: (player: RoomPlayerView) => void;
  players: RoomPlayerView[];
}) {
  return (
    <details className="mt-3 rounded-xl border border-sky-300/15 bg-black/20">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 marker:hidden">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-100/70">HOST CONTROL</div>
          <div className="mt-0.5 text-sm font-black text-[#fff7df]">房主控制：玩家恢复链接</div>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[#d9c9a8]">
          {players.length} 名真人
        </span>
      </summary>
      <div className="grid gap-2 border-t border-white/10 px-3 py-3 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => (
          <div
            className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#090604]/55 px-3 py-2"
            key={player.playerId}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-[#fff7df]">
                {player.seatId ? `${player.seatId}号 · ` : ""}
                {player.name}
              </div>
              <div className="mt-1">
                <PlayerPresencePill player={player} />
              </div>
            </div>
            <button
              className="shrink-0 rounded-full border border-sky-300/25 bg-sky-950/35 px-2.5 py-1 text-[11px] font-black text-sky-100 transition hover:border-sky-200/55 disabled:opacity-55"
              disabled={disabled}
              onClick={() => onCopyPlayerRecoveryLink(player)}
              type="button"
            >
            复制恢复
          </button>
        </div>
      ))}
      </div>
    </details>
  );
}

function LobbyView({
  isHost,
  onCopyPlayerRecoveryLink,
  onRemovePlayer,
  onSeatChange,
  pending,
  roomView,
  seatIds,
}: {
  isHost: boolean;
  onCopyPlayerRecoveryLink: (player: RoomPlayerView) => void;
  onRemovePlayer: (playerId: string) => void;
  onSeatChange: (seatId: number | null) => void;
  pending: PendingKind;
  roomView: RoomView;
  seatIds: number[];
}) {
  const occupiedBySelf = roomView.playerSeatId;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-[#fff1c2]">选座大厅</h2>
          {occupiedBySelf ? (
            <button
              className="rounded-full border border-red-300/25 bg-red-950/35 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:border-red-200/45 disabled:opacity-55"
              disabled={pending !== null}
              onClick={() => onSeatChange(null)}
              type="button"
            >
              离开座位
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {seatIds.map((seatId) => {
            const seat = roomView.room.seats.find((item) => item.seatId === seatId);
            const isSelf = seat?.playerId === roomView.playerId;
            const isOpen = !seat || seat.controller === "open";
            return (
              <button
                className={[
                  "min-h-[116px] rounded-2xl border p-3 text-left transition",
                  isSelf
                    ? "border-[#f0cf79]/75 bg-[#2b1a0d]/85 shadow-lg shadow-[#f0cf79]/10"
                    : isOpen
                      ? "border-white/10 bg-white/[0.04] hover:border-[#f0cf79]/45 hover:bg-[#22160d]"
                      : "border-[#7b5a28]/35 bg-black/30 opacity-70",
                ].join(" ")}
                disabled={pending !== null || !isOpen || isSelf}
                key={seatId}
                onClick={() => onSeatChange(seatId)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-black text-[#f0cf79]">{seatId}号</span>
                  <span className="text-xs text-[#bba98a]">{seatStatusLabel(seat)}</span>
                </div>
                <div className="mt-5 text-lg font-black text-[#fff7df]">{seatName(seat)}</div>
                {seat?.playerId ? (
                  <div className="mt-2">
                    <PlayerPresencePill player={roomView.room.players.find((player) => player.playerId === seat.playerId)} />
                  </div>
                ) : null}
                {isSelf ? <div className="mt-2 text-xs font-bold text-emerald-200">当前玩家</div> : null}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h2 className="text-lg font-black text-[#fff1c2]">玩家</h2>
        <div className="mt-3 space-y-2">
          {roomView.room.players.map((player) => (
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2" key={player.playerId}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#fff7df]">{player.name}</span>
                <div className="flex items-center gap-2">
                  {player.isHost ? (
                    <span className="rounded-full bg-[#f0cf79] px-2 py-0.5 text-[11px] font-black text-[#1c1208]">房主</span>
                  ) : null}
                  {isHost ? (
                    <button
                      className="rounded-full border border-sky-300/25 bg-sky-950/35 px-2 py-0.5 text-[11px] font-black text-sky-100 transition hover:border-sky-200/55 disabled:opacity-55"
                      disabled={pending !== null}
                      onClick={() => onCopyPlayerRecoveryLink(player)}
                      type="button"
                    >
                      复制恢复
                    </button>
                  ) : null}
                  {isHost && player.playerId !== roomView.playerId ? (
                    <button
                      className="rounded-full border border-red-300/25 bg-red-950/45 px-2 py-0.5 text-[11px] font-black text-red-100 transition hover:border-red-200/55 disabled:opacity-55"
                      disabled={pending !== null}
                      onClick={() => onRemovePlayer(player.playerId)}
                      type="button"
                    >
                      {pending === "remove" ? "移除中" : "移除"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-1 text-xs text-[#bba98a]">{player.seatId ? `${player.seatId}号位` : "未入座"}</div>
              <div className="mt-2">
                <PlayerPresencePill player={player} />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function GameRoomView({
  game,
  hostAudioStatus,
  isSubmitting,
  onNewGame,
  onSubmit,
  pendingCommandType,
}: {
  game: HumanGameView;
  hostAudioStatus: HostAudioStatus | null;
  isSubmitting: boolean;
  onNewGame: () => Promise<void>;
  onSubmit: (command: HumanCommandInput) => Promise<void>;
  pendingCommandType: CommandPayload["type"] | null;
}) {
  const submitCommand = async (command: CommandPayload) => {
    await onSubmit(command as HumanCommandInput);
  };
  const noop = () => undefined;

  return (
    <div className="grid flex-1 gap-4">
      <PhaseRhythm game={game} />
      <HostStage game={game} />
      <FlowStatusBar
        aiSpeechAudioStatus={null}
        aiSpeechAudioUnavailable={false}
        game={game}
        hostAudioStatus={hostAudioStatus}
        liveAiSpeech={null}
        loading={isSubmitting}
        onPauseAiSpeechAudio={noop}
        onResumeAiSpeechAudio={noop}
        onSkipAiSpeechAudio={noop}
        onToggleAiSpeechAudio={noop}
        pendingCommandType={pendingCommandType}
      />
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,420px)]">
        <div className="order-2 grid content-start gap-4 xl:order-1 xl:row-span-2">
          <SeatBoard aiSpeechAudioStatus={null} game={game} liveAiSpeech={null} />
          {game.review ? <ReviewPanel game={game} /> : null}
        </div>
        <aside className="order-1 grid content-start gap-4 xl:order-2 xl:sticky xl:top-24">
          <ActionPanel
            game={game}
            loading={isSubmitting}
            onNewGame={onNewGame}
            onSubmit={submitCommand}
            voiceInputEnabled={false}
          />
        </aside>
        <aside className="order-3 grid content-start gap-4 xl:order-3 xl:col-start-2">
          <VoteTable game={game} loading={isSubmitting} pendingCommandType={pendingCommandType} />
          <AuxiliaryInfoPanel events={game.publicEvents} game={game} />
        </aside>
      </section>
    </div>
  );
}

function SeatPicker({ maxSeat, onChange, value }: { maxSeat: number; onChange: (seatId: number) => void; value: number }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold text-[#bba98a]">座位</div>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: maxSeat }, (_, index) => index + 1).map((seatId) => (
          <button
            className={[
              "rounded-lg border px-2 py-1.5 text-xs font-black transition",
              value === seatId
                ? "border-[#f0cf79] bg-[#f0cf79] text-[#1c1208]"
                : "border-white/10 bg-black/25 text-[#d9c9a8] hover:border-[#f0cf79]/45",
            ].join(" ")}
            key={seatId}
            onClick={() => onChange(seatId)}
            type="button"
          >
            {seatId}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#bba98a]">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ label, tone, value }: { label: string; tone: "blue" | "gold" | "green"; value: string }) {
  const toneClass =
    tone === "gold"
      ? "border-[#f0cf79]/35 bg-[#f0cf79]/10 text-[#ffe5a0]"
      : tone === "green"
        ? "border-emerald-300/25 bg-emerald-950/40 text-emerald-100"
        : "border-sky-300/25 bg-sky-950/40 text-sky-100";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${toneClass}`}>
      <span className="mr-1.5 opacity-70">{label}</span>
      {value}
    </span>
  );
}

function PlayerPresencePill({ player }: { player?: RoomPlayerView }) {
  if (!player) return null;
  const toneClass = player.online
    ? "border-emerald-300/25 bg-emerald-950/35 text-emerald-100"
    : "border-white/10 bg-black/30 text-[#bba98a]";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClass}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${player.online ? "bg-emerald-300" : "bg-[#8f8068]"}`} />
      <span className="truncate">{formatPlayerPresence(player)}</span>
    </span>
  );
}

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  return (
    <div className="mt-4 space-y-2">
      {error ? <div className="rounded-xl border border-red-300/25 bg-red-950/45 px-3 py-2 text-sm font-bold text-red-100">{error}</div> : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-300/25 bg-emerald-950/45 px-3 py-2 text-sm font-bold text-emerald-100">{notice}</div>
      ) : null}
    </div>
  );
}

function AlphaPreflightPanelImpl({
  activeRoomId,
  pageOrigin,
  roomHealth,
  setError,
  setPending,
  setRoomHealth,
  setNotice,
  shareOrigin,
}: {
  activeRoomId?: string;
  pageOrigin: string;
  roomHealth: RoomHealthStatus | null;
  setError: (message: string | null) => void;
  setPending: (value: PendingKind) => void;
  setRoomHealth: (value: RoomHealthStatus | null) => void;
  setNotice: (message: string | null) => void;
  shareOrigin?: string;
}) {
  const [isDebugCleanupPending, setIsDebugCleanupPending] = useState(false);
  const smokeOrigin = shareOrigin ?? pageOrigin;
  const smokeScript = selectRoomSmokeScript(smokeOrigin, roomHealth);
  const smokeCommand = smokeOrigin ? `$env:ROOM_SMOKE_BASE_URL="${smokeOrigin}"; npm run ${smokeScript}` : "npm run smoke:alpha";
  const healthTone = roomHealth?.ok ? "text-emerald-200" : "text-[#bba98a]";
  const showDebugCleanup = process.env.NODE_ENV !== "production";

  async function handleDebugCleanup() {
    setIsDebugCleanupPending(true);
    setPending("debugCleanup");
    setError(null);
    setNotice(null);
    try {
      const result = await runRoomDebugCleanup(activeRoomId);
      const nextHealth = await loadRoomHealthStatus();
      setRoomHealth(nextHealth);
      setNotice(`已清理 ${result.removed} 个无连接测试房间。当前剩余 ${result.rooms?.total ?? 0} 间。`);
    } catch (error) {
      setError(readErrorMessage(error));
    } finally {
      setIsDebugCleanupPending(false);
      setPending(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#7b5a28]/35 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-[#fff1c2]">Alpha 预检</h2>
        <span className={`rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-black ${healthTone}`}>
          {roomHealth?.ok ? "READY" : "CHECK"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#d9c9a8]">
        <PreflightRow
          label="部署模式"
          value={
            roomHealth?.deployment
              ? `${roomHealth.deployment.target ?? "single-node"} · ${roomHealth.deployment.onlineReady ? "online ready" : "local alpha"}`
              : "读取中"
          }
          valueClassName={roomHealth?.deployment?.onlineReady ? "text-emerald-200" : "text-[#f1c76e]"}
        />
        <PreflightRow
          label="公网入口"
          value={roomHealth?.deployment?.publicOrigin ?? "未配置 AI_WEREWOLF_PUBLIC_ORIGIN"}
          valueClassName={roomHealth?.deployment?.publicOrigin ? "text-emerald-200" : "text-[#f1c76e]"}
        />
        <PreflightRow label="本机入口" value={pageOrigin || "读取中"} />
        <PreflightRow label="手机入口" value={shareOrigin ?? "未发现局域网地址"} valueClassName={shareOrigin ? "text-emerald-200" : "text-[#f1c76e]"} />
        <PreflightRow label="房间存储" value={roomHealth?.storage?.mode ?? "读取中"} />
        <PreflightRow
          label="状态版本"
          value={
            roomHealth?.storage?.revisioned
              ? `${roomHealth.storage.revisionMode ?? "revision"} · max ${roomHealth.rooms?.maxRevision ?? 0}`
              : "未启用"
          }
          valueClassName={roomHealth?.storage?.revisioned ? "text-emerald-200" : "text-[#f1c76e]"}
        />
        <PreflightRow
          label="实时通道"
          value={roomHealth?.realtime?.mode ? `${roomHealth.realtime.mode} · ${roomHealth.realtime.subscriberCount ?? 0}` : "读取中"}
        />
        <PreflightRow
          label="房间数"
          value={
            roomHealth?.rooms
              ? `${roomHealth.rooms.total ?? 0} 总 · ${roomHealth.rooms.lobby ?? 0} 大厅 · ${roomHealth.rooms.inGame ?? 0} 游戏中`
              : "读取中"
          }
        />
        <PreflightRow label="过期清理" value={formatRoomCleanupStatus(roomHealth)} valueClassName="text-emerald-200" />
      </div>
      <button
        className="mt-3 w-full rounded-xl border border-sky-300/25 bg-sky-950/35 px-3 py-2 text-left text-xs font-bold text-sky-100 transition hover:border-sky-200/45 disabled:opacity-55"
        disabled={!smokeOrigin}
        onClick={() => void copyPreflightCommand(smokeCommand, setNotice, setError)}
        type="button"
      >
        复制 {smokeScript.replace("smoke:", "")} smoke 命令
      </button>
      {showDebugCleanup ? (
        <button
          className="mt-2 w-full rounded-xl border border-red-300/20 bg-red-950/25 px-3 py-2 text-left text-xs font-bold text-red-100 transition hover:border-red-200/45 disabled:opacity-55"
          disabled={isDebugCleanupPending}
          onClick={() => void handleDebugCleanup()}
          type="button"
        >
          {isDebugCleanupPending ? "清理中..." : "清理无连接测试房间"}
        </button>
      ) : null}
      <div className="mt-2 break-all rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[11px] leading-5 text-[#bba98a]">{smokeCommand}</div>
    </div>
  );
}

function PreflightRow({
  label,
  value,
  valueClassName = "text-[#fff7df]",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/24 px-3 py-2">
      <span className="shrink-0 text-[#9f8e72]">{label}</span>
      <span className={`min-w-0 truncate text-right font-bold ${valueClassName}`}>{value}</span>
    </div>
  );
}

function selectRoomSmokeScript(origin: string | undefined, roomHealth: RoomHealthStatus | null): "smoke:alpha" | "smoke:online" | "smoke:tunnel" {
  const deployment = roomHealth?.deployment;
  if (deployment?.target === "single-node-online" && deployment.onlineReady) {
    return "smoke:online";
  }
  if (origin && isPublicHttpsOrigin(origin)) {
    return "smoke:tunnel";
  }
  return "smoke:alpha";
}

function isPublicHttpsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;

    const parts = hostname.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [first, second] = parts;
    return !(first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168));
  } catch {
    return false;
  }
}

function EmptyRoomState({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex min-h-[540px] items-center justify-center rounded-2xl border border-dashed border-[#7b5a28]/45 bg-black/20 px-6 text-center">
      <div>
        <div className="text-2xl font-black text-[#fff1c2]">{title}</div>
        <div className="mt-3 max-w-md text-sm leading-6 text-[#bba98a]">{detail}</div>
      </div>
    </div>
  );
}

function InvalidRoomSessionState({ session }: { session: InvalidRoomSession }) {
  return (
    <div className="flex min-h-[540px] items-center justify-center rounded-2xl border border-red-300/25 bg-red-950/20 px-6 text-center shadow-inner shadow-red-950/20">
      <div className="max-w-lg">
        <div className="mx-auto mb-4 inline-flex rounded-full border border-red-200/25 bg-red-950/55 px-3 py-1 text-xs font-black tracking-[0.24em] text-red-100">
          SESSION RESET
        </div>
        <div className="text-2xl font-black text-[#fff1c2]">{session.title}</div>
        <div className="mt-3 text-sm leading-6 text-[#e5c9bd]">{session.detail}</div>
        {session.roomCode ? (
          <div className="mt-5 rounded-2xl border border-[#f0cf79]/25 bg-black/25 px-4 py-3 text-sm text-[#f8e9c2]">
            房间码已保留：<span className="font-black text-[#f0cf79]">{session.roomCode}</span>
            <div className="mt-1 text-xs text-[#bba98a]">在左侧输入昵称后可以重新加入，或让房主重新发送邀请链接。</div>
          </div>
        ) : (
          <div className="mt-5 text-xs text-[#bba98a]">可以在左侧重新创建房间，或输入新的房间码加入。</div>
        )}
      </div>
    </div>
  );
}

class RoomClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RoomClientError";
    this.status = status;
  }
}

async function postRoomView(path: string, body: Record<string, unknown>): Promise<RoomView> {
  const response = await fetchRoomWithTimeout(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    ROOM_WRITE_REQUEST_TIMEOUT_MS,
  );
  return parseRoomResponse(response);
}

async function getRoomView(roomId: string, credential: RoomClientCredential): Promise<RoomView> {
  const params = new URLSearchParams();
  appendRoomCredentialSearchParams(params, credential);
  const response = await fetchRoomWithTimeout(
    `/api/rooms/${encodeURIComponent(roomId)}/view?${params.toString()}`,
    { cache: "no-store" },
    ROOM_VIEW_REQUEST_TIMEOUT_MS,
  );
  return parseRoomResponse(response);
}

async function fetchRoomWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RoomClientError("请求超时，请稍后重试。", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function parseRoomResponse(response: Response): Promise<RoomView> {
  const data = (await response.json().catch(() => null)) as RoomView | { error?: string } | null;
  if (!response.ok) {
    throw new RoomClientError((data && "error" in data && data.error) || `请求失败：${response.status}`, response.status);
  }
  return data as RoomView;
}

function parseRoomSseEvent(event: Event): RoomView | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;
  try {
    const data = JSON.parse(event.data) as unknown;
    return isRoomView(data) ? data : null;
  } catch {
    return null;
  }
}

function parseRoomSseErrorEvent(event: Event): string | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") return null;
  try {
    const data = JSON.parse(event.data) as { error?: unknown };
    return typeof data.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}

function isRoomView(value: unknown): value is RoomView {
  if (!value || typeof value !== "object") return false;
  const view = value as Partial<RoomView>;
  return (
    typeof view.playerId === "string" &&
    typeof view.room === "object" &&
    view.room !== null &&
    typeof view.room.id === "string" &&
    typeof view.room.code === "string" &&
    (view.room.status === "lobby" || view.room.status === "in_game" || view.room.status === "finished")
  );
}

function buildCurrentRoomCredentialBody(roomView: RoomView): RoomClientWriteCredentialBody {
  return {
    expectedRevision: roomView.room.revision,
    playerId: roomView.playerId ?? "",
    playerToken: roomView.playerToken,
  };
}

function createRoomIdempotencyKey(): string {
  return `cmd-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function isTransientRoomSyncError(value: string | null): boolean {
  return Boolean(value?.startsWith("连接暂时中断") || value?.startsWith("实时同步"));
}

function isInvalidRoomSessionError(error: unknown): boolean {
  const message = readErrorMessage(error);
  if (error instanceof RoomClientError) {
    return (error.status === 400 || error.status === 403 || error.status === 404) && isInvalidRoomSessionMessage(message);
  }
  return isInvalidRoomSessionMessage(message);
}

function isInvalidRoomSessionMessage(message: string): boolean {
  return (
    message.includes("玩家不在该房间") ||
    message.includes("房间不存在") ||
    message.includes("缺少玩家凭据") ||
    message.includes("玩家凭据无效") ||
    message.includes("玩家凭据和玩家身份不匹配")
  );
}

function buildInvalidRoomSessionTitle(message: string): string {
  if (message.includes("房间不存在")) return "房间不存在或已关闭";
  if (message.includes("缺少玩家凭据")) return "缺少玩家凭据";
  if (message.includes("玩家凭据")) return "恢复链接已失效";
  return "你已不在这个房间";
}

function buildInvalidRoomSessionDetail(message: string): string {
  if (message.includes("房间不存在")) {
    return "这个房间已经不存在，可能是开发服务重启、房间被清理，或房间码输入错误。";
  }
  if (message.includes("缺少玩家凭据")) {
    return "当前链接缺少玩家身份，不能直接恢复视角。请使用邀请链接重新加入，或使用自己的恢复链接。";
  }
  if (message.includes("玩家凭据")) {
    return "当前恢复链接里的玩家凭据已经失效。请让房主重新发送恢复链接，或使用邀请链接重新加入。";
  }
  return "你的房间身份已失效，可能是被房主移出、自己在其他设备离开，或本地房间状态被重置。";
}

function roomSyncKey(roomId: string, playerId: string): string {
  return `${roomId}:${playerId}`;
}

function buildRoomLink(roomCode: string, credential?: RoomClientCredential, baseOrigin?: string): string {
  const path = "/rooms";
  const params = new URLSearchParams({ room: roomCode });
  if (credential) appendRoomCredentialSearchParams(params, credential);

  if (typeof window === "undefined") {
    return `${path}?${params.toString()}`;
  }

  const url = new URL(path, baseOrigin ?? window.location.origin);
  url.search = params.toString();
  return url.toString();
}

function appendRoomCredentialSearchParams(params: URLSearchParams, credential: RoomClientCredential): void {
  if (credential.playerToken) {
    params.set("playerToken", credential.playerToken);
    return;
  }
  if (credential.playerId) {
    params.set("player", credential.playerId);
  }
}

function buildCopyNotice(message: string, shareOrigin?: string): string {
  if (!shareOrigin) return message;
  return `${message} 已自动使用手机可访问的局域网地址：${shareOrigin}`;
}

async function loadRoomNetworkOrigins(): Promise<RoomNetworkOrigin[]> {
  const response = await fetch("/api/rooms/network");
  if (!response.ok) return [];
  const data = (await response.json().catch(() => null)) as { origins?: unknown } | null;
  if (!Array.isArray(data?.origins)) return [];
  return data.origins.filter(isRoomNetworkOrigin);
}

async function loadRoomHealthStatus(): Promise<RoomHealthStatus | null> {
  const response = await fetch("/api/rooms/health");
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as unknown;
  return isRoomHealthStatus(data) ? data : null;
}

async function runRoomDebugCleanup(activeRoomId: string | undefined): Promise<RoomDebugCleanupResult> {
  const response = await fetch("/api/rooms/debug-cleanup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ excludeRoomId: activeRoomId }),
  });
  const data = (await response.json().catch(() => null)) as RoomDebugCleanupResult | { error?: string } | null;
  if (!response.ok) {
    throw new RoomClientError((data && "error" in data && data.error) || `清理失败：${response.status}`, response.status);
  }
  return isRoomDebugCleanupResult(data) ? data : { ok: true, removed: 0 };
}

function isRoomNetworkOrigin(value: unknown): value is RoomNetworkOrigin {
  if (!value || typeof value !== "object") return false;
  const origin = value as Partial<RoomNetworkOrigin>;
  return typeof origin.address === "string" && typeof origin.origin === "string";
}

function isRoomHealthStatus(value: unknown): value is RoomHealthStatus {
  if (!value || typeof value !== "object") return false;
  const health = value as Partial<RoomHealthStatus>;
  return typeof health.ok === "boolean";
}

function isRoomDebugCleanupResult(value: unknown): value is RoomDebugCleanupResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<RoomDebugCleanupResult>;
  return typeof result.ok === "boolean" && typeof result.removed === "number";
}

function formatRoomCleanupStatus(roomHealth: RoomHealthStatus | null): string {
  const cleanup = roomHealth?.cleanup;
  if (!cleanup) return "读取中";
  if (!cleanup.enabled) return "已关闭";
  const removed = cleanup.removedLastRun ?? 0;
  return `启用 · 本次清理 ${removed} 间 · 大厅 ${formatDuration(cleanup.policy?.lobbyIdleMs)}`;
}

function formatDuration(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return "默认";
  if (milliseconds < 60 * 1000) return `${Math.round(milliseconds / 1000)}秒`;
  if (milliseconds < 60 * 60 * 1000) return `${Math.round(milliseconds / (60 * 1000))}分钟`;
  if (milliseconds < 24 * 60 * 60 * 1000) return `${Math.round(milliseconds / (60 * 60 * 1000))}小时`;
  return `${Math.round(milliseconds / (24 * 60 * 60 * 1000))}天`;
}

function selectRoomShareOrigin(origins: RoomNetworkOrigin[]): string | undefined {
  if (typeof window === "undefined" || origins.length === 0) return undefined;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return origins[0].origin;
  }
  return undefined;
}

async function copyPreflightCommand(
  command: string,
  setNotice: (message: string | null) => void,
  setError: (message: string | null) => void,
): Promise<void> {
  try {
    await window.navigator.clipboard.writeText(command);
    setError(null);
    setNotice("Alpha smoke 命令已复制。");
  } catch {
    setNotice(null);
    setError(`复制失败，请手动复制：${command}`);
  }
}

async function copyRoomLink(
  link: string,
  successMessage: string,
  setNotice: (message: string | null) => void,
  setError: (message: string | null) => void,
): Promise<void> {
  try {
    await window.navigator.clipboard.writeText(link);
    setError(null);
    setNotice(successMessage);
  } catch {
    setNotice(null);
    setError(`复制失败，请手动复制：${link}`);
  }
}

function readUrlRoomHint(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("room") ?? params.get("code");
  const clean = value?.trim().slice(0, 80);
  return clean || null;
}

function readUrlRoomSession(): UrlRoomSession | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const roomId = readUrlRoomHint();
  const playerId = (params.get("player") ?? params.get("playerId"))?.trim().slice(0, 120);
  const playerToken = (params.get("playerToken") ?? params.get("token"))?.trim().slice(0, 180);
  if (!roomId || (!playerId && !playerToken)) return null;
  return {
    source: "url",
    roomId,
    playerId: playerId ?? "",
    playerToken,
    roomCode: roomId,
  };
}

function storedMatchesRoomHint(stored: StoredRoomSession, roomHint: string): boolean {
  const cleanHint = roomHint.trim().toUpperCase();
  return stored.roomId.toUpperCase() === cleanHint || stored.roomCode?.toUpperCase() === cleanHint;
}

function readStoredSession(): StoredRoomSession | null {
  try {
    const raw = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRoomSession>;
    if (!parsed.roomId || (!parsed.playerId && !parsed.playerToken)) return null;
    return {
      roomId: parsed.roomId,
      playerId: parsed.playerId ?? "",
      playerToken: typeof parsed.playerToken === "string" ? parsed.playerToken : undefined,
      roomCode: typeof parsed.roomCode === "string" ? parsed.roomCode : undefined,
    };
  } catch {
    return null;
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败。";
}

function roomOnlineSummary(players: RoomPlayerView[]): string {
  return `${players.filter((player) => player.online).length}/${players.length}`;
}

function formatPlayerPresence(player: RoomPlayerView): string {
  if (player.online) return "实时在线";
  if (!player.lastSeenAt) return "未同步";
  return `最近同步 ${formatRelativeTime(player.lastSeenAt)}`;
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "未知";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 20) return "刚刚";
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function roomStatusLabel(status: RoomView["room"]["status"]): string {
  if (status === "lobby") return "大厅";
  if (status === "in_game") return "游戏中";
  return "已结束";
}

function seatStatusLabel(seat: RoomSeatView | undefined): string {
  if (!seat || seat.controller === "open") return "空位";
  if (seat.controller === "human") return "真人";
  return "AI";
}

function seatName(seat: RoomSeatView | undefined): string {
  if (!seat || seat.controller === "open") return "可入座";
  return seat.playerName ?? seat.aiName ?? "已占用";
}
