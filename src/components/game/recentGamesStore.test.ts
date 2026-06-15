import { describe, expect, it, vi } from "vitest";
import {
  clearCurrentGameId,
  getRecentGameIdsServerSnapshot,
  readCurrentGameId,
  readRecentGameIds,
  rememberRecentGameId,
  subscribeRecentGameIds,
} from "./recentGamesStore";

describe("recentGamesStore", () => {
  it("keeps the newest five game ids and moves repeated games to the front", () => {
    withFakeWindow(() => {
      for (const gameId of ["game-1", "game-2", "game-3", "game-4", "game-5", "game-6", "game-3"]) {
        rememberRecentGameId(gameId);
      }

      expect(readRecentGameIds()).toEqual(["game-3", "game-6", "game-5", "game-4", "game-2"]);
    });
  });

  it("notifies subscribers when recent games change locally", () => {
    withFakeWindow((fakeWindow) => {
      const onStoreChange = vi.fn();
      const unsubscribe = subscribeRecentGameIds(onStoreChange);

      rememberRecentGameId("game-1");

      expect(onStoreChange).toHaveBeenCalledTimes(1);
      unsubscribe();
      fakeWindow.dispatchEvent({ type: "ai-werewolf-recent-games-changed" });
      expect(onStoreChange).toHaveBeenCalledTimes(1);
    });
  });

  it("returns an empty server snapshot and clears the current game id", () => {
    withFakeWindow((fakeWindow) => {
      rememberRecentGameId("game-1");

      expect(readCurrentGameId()).toBe("game-1");

      clearCurrentGameId();

      expect(getRecentGameIdsServerSnapshot()).toEqual([]);
      expect(readCurrentGameId()).toBe("");
      expect(fakeWindow.localStorage.getItem("ai-werewolf-game-id")).toBeNull();
    });
  });
});

type FakeWindow = {
  localStorage: Storage;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: { type: string; key?: string | null }) => boolean;
};

function withFakeWindow(run: (fakeWindow: FakeWindow) => void): void {
  const listeners = new Map<string, Set<EventListener>>();
  const storage = new Map<string, string>();
  const fakeWindow: FakeWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    },
    addEventListener: (type, listener) => {
      const nextListeners = listeners.get(type) ?? new Set<EventListener>();
      nextListeners.add(listener);
      listeners.set(type, nextListeners);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event as Event);
      }
      return true;
    },
  };

  vi.stubGlobal("window", fakeWindow);
  try {
    run(fakeWindow);
  } finally {
    vi.unstubAllGlobals();
  }
}
