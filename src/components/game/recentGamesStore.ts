const CURRENT_GAME_KEY = "ai-werewolf-game-id";
const RECENT_GAMES_KEY = "ai-werewolf-recent-game-ids";
const RECENT_GAMES_CHANGED_EVENT = "ai-werewolf-recent-games-changed";
const EMPTY_RECENT_GAME_IDS: string[] = [];

let recentGameIdsRawCache: string | null = null;
let recentGameIdsSnapshotCache: string[] = EMPTY_RECENT_GAME_IDS;

export function readRecentGameIds(): string[] {
  if (typeof window === "undefined") {
    return EMPTY_RECENT_GAME_IDS;
  }

  try {
    const raw = window.localStorage.getItem(RECENT_GAMES_KEY);
    if (raw === recentGameIdsRawCache) {
      return recentGameIdsSnapshotCache;
    }

    recentGameIdsRawCache = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    recentGameIdsSnapshotCache = Array.isArray(parsed)
      ? parsed.filter((gameId): gameId is string => typeof gameId === "string").slice(0, 5)
      : EMPTY_RECENT_GAME_IDS;
    return recentGameIdsSnapshotCache;
  } catch {
    resetRecentGameIdsCache();
    return EMPTY_RECENT_GAME_IDS;
  }
}

export function getRecentGameIdsServerSnapshot(): string[] {
  return EMPTY_RECENT_GAME_IDS;
}

export function subscribeRecentGameIds(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== CURRENT_GAME_KEY && event.key !== RECENT_GAMES_KEY) return;
    resetRecentGameIdsCache();
    onStoreChange();
  };
  const handleLocalChange = () => {
    resetRecentGameIdsCache();
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(RECENT_GAMES_CHANGED_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(RECENT_GAMES_CHANGED_EVENT, handleLocalChange);
  };
}

export function rememberRecentGameId(gameId: string): void {
  try {
    const nextIds = [gameId, ...readRecentGameIds().filter((id) => id !== gameId)].slice(0, 5);
    window.localStorage.setItem(CURRENT_GAME_KEY, gameId);
    window.localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(nextIds));
  } catch {
    resetRecentGameIdsCache();
  }
  dispatchRecentGamesChanged();
}

export function clearCurrentGameId(): void {
  try {
    window.localStorage.removeItem(CURRENT_GAME_KEY);
  } catch {
    // Returning home is a UI transition; storage cleanup should not block it.
  }
  dispatchRecentGamesChanged();
}

function resetRecentGameIdsCache(): void {
  recentGameIdsRawCache = null;
  recentGameIdsSnapshotCache = EMPTY_RECENT_GAME_IDS;
}

function dispatchRecentGamesChanged(): void {
  try {
    window.dispatchEvent(new Event(RECENT_GAMES_CHANGED_EVENT));
  } catch {
    // Recent-game history is a convenience; it must not block game flow.
  }
}
