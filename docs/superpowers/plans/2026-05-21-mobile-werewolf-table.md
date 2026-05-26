# Mobile Werewolf Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped mobile in-game card stack with a phone-only, native Werewolf-style table shell while preserving desktop behavior.

**Architecture:** Add a mobile-only composition component that reuses existing game state, action submission, and information panels. Keep `GameClient.tsx` as the orchestration layer: desktop renders the current layout, phone widths render `MobileGameTable`. Add small pure helper functions for testable mobile status derivation, then verify layout with mobile browser screenshots.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind utility classes, `src/app/globals.css`, Vitest for pure helper tests, Browser/Playwright manual verification.

---

## File Structure

- Create `src/components/game/mobileTableModel.ts`: pure helper functions for mobile seat counts, focus seat, action mode, and tab metadata.
- Create `src/components/game/mobileTableModel.test.ts`: Vitest coverage for helper behavior.
- Create `src/components/game/MobileGameTable.tsx`: mobile-only game table shell, top strip, circular seat table, bottom tabs, and bottom action sheet.
- Modify `src/components/game/TablePanels.tsx`: export embedded panel primitives already defined in the file so mobile tabs can reuse private info, notes, and public log without duplicating logic.
- Modify `src/components/GameClient.tsx`: import and render `MobileGameTable` for `sm:hidden`; keep existing desktop composition in `hidden sm:grid`.
- Modify `src/app/globals.css`: add mobile viewport, table orbit, bottom sheet, safe-area, and reduced-motion styling.

## Task 1: Mobile Table Model Helpers

**Files:**
- Create: `src/components/game/mobileTableModel.ts`
- Create: `src/components/game/mobileTableModel.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/components/game/mobileTableModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HumanGameView } from "@/game/types";
import {
  MOBILE_INFO_TABS,
  getMobileActionMode,
  getMobileFocusSeat,
  getMobileSeatCounts,
} from "./mobileTableModel";

describe("mobile table model", () => {
  it("counts alive and dead seats", () => {
    const game = gameView({
      seats: [
        seat(1, { alive: true }),
        seat(2, { alive: false }),
        seat(3, { alive: true }),
      ],
    });

    expect(getMobileSeatCounts(game)).toEqual({ aliveCount: 2, deadCount: 1 });
  });

  it("prioritizes the current actor over the current speaker", () => {
    const game = gameView({
      currentActorSeatId: 3,
      currentSpeakerSeatId: 2,
      seats: [seat(1), seat(2, { name: "Speaker" }), seat(3, { name: "Actor" })],
    });

    expect(getMobileFocusSeat(game)).toEqual({
      kind: "actor",
      label: "行动中",
      seat: expect.objectContaining({ seatId: 3, name: "Actor" }),
    });
  });

  it("falls back to current speaker when no actor exists", () => {
    const game = gameView({
      currentSpeakerSeatId: 2,
      seats: [seat(1), seat(2, { name: "Speaker" })],
    });

    expect(getMobileFocusSeat(game)).toEqual({
      kind: "speaker",
      label: "发言中",
      seat: expect.objectContaining({ seatId: 2, name: "Speaker" }),
    });
  });

  it("classifies player action, auto playback, loading, and game-over modes", () => {
    expect(getMobileActionMode(gameView({ availableActions: [{ type: "seerCheck", targets: [] }] }))).toMatchObject({
      kind: "player",
      label: "轮到你行动",
    });
    expect(getMobileActionMode(gameView({ availableActions: [{ type: "continue", label: "继续", description: "继续流程" }] }))).toMatchObject({
      kind: "auto",
      label: "自动播放",
    });
    expect(getMobileActionMode(gameView({ availableActions: [] }), true)).toMatchObject({
      kind: "loading",
      label: "结算中",
    });
    expect(getMobileActionMode(gameView({ result: { winner: "GOOD", reason: "所有狼人出局" } }))).toMatchObject({
      kind: "gameOver",
      label: "终局",
    });
  });

  it("keeps the expected mobile info tab order", () => {
    expect(MOBILE_INFO_TABS.map((tab) => tab.key)).toEqual(["identity", "speech", "vote", "log"]);
    expect(MOBILE_INFO_TABS.map((tab) => tab.label)).toEqual(["身份", "发言", "票型", "记录"]);
  });
});

function seat(seatId: number, overrides: Partial<HumanGameView["seats"][number]> = {}): HumanGameView["seats"][number] {
  return {
    seatId,
    name: `${seatId}号玩家`,
    alive: true,
    isHuman: seatId === 1,
    isAi: seatId !== 1,
    role: undefined,
    roleLabel: undefined,
    deathReason: undefined,
    ...overrides,
  } as HumanGameView["seats"][number];
}

function gameView(overrides: Partial<HumanGameView> = {}): HumanGameView {
  return {
    id: "mobile-test",
    day: 1,
    phase: "NIGHT_SEER",
    phaseLabel: "第 1 夜",
    board: { id: "test-board", name: "测试板子", seatCount: 3 },
    seats: [seat(1), seat(2), seat(3)],
    humanSeatId: 1,
    myRole: "SEER",
    myRoleLabel: "预言家",
    availableActions: [],
    publicEvents: [],
    privateEvents: [],
    tableSummary: {
      recentSpeeches: [],
      voteSnapshot: { votes: [], tally: [], leaders: [], revealed: false },
      sheriffVoteSnapshot: undefined,
      aiReasonHighlights: [],
      tableMemory: {
        day: 1,
        claimBoard: [],
        stanceBoard: [],
        stanceShifts: [],
        seerLegacies: [],
        speechInfluence: [],
        reasoningCues: [],
        counterclaims: [],
        focus: [],
        seats: [],
        voteHistory: [],
        deathAnnouncements: [],
        publicSignals: [],
      },
    },
    wolfTeammates: [],
    seerChecks: [],
    result: undefined,
    currentActorSeatId: undefined,
    currentSpeakerSeatId: undefined,
    ...overrides,
  } as HumanGameView;
}
```

- [ ] **Step 2: Run the helper tests red**

Run:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts
```

Expected: FAIL because `src/components/game/mobileTableModel.ts` does not exist.

- [ ] **Step 3: Add the mobile table model helper**

Create `src/components/game/mobileTableModel.ts`:

```ts
import type { AvailableHumanAction, HumanGameView } from "@/game/types";

export type MobileInfoTabKey = "identity" | "speech" | "vote" | "log";

export const MOBILE_INFO_TABS: Array<{ key: MobileInfoTabKey; label: string }> = [
  { key: "identity", label: "身份" },
  { key: "speech", label: "发言" },
  { key: "vote", label: "票型" },
  { key: "log", label: "记录" },
];

export function getMobileSeatCounts(game: HumanGameView): { aliveCount: number; deadCount: number } {
  const aliveCount = game.seats.filter((seat) => seat.alive).length;
  return { aliveCount, deadCount: game.seats.length - aliveCount };
}

export function getMobileFocusSeat(game: HumanGameView):
  | { kind: "actor" | "speaker"; label: string; seat: HumanGameView["seats"][number] }
  | { kind: "none"; label: string; seat: undefined } {
  if (game.currentActorSeatId) {
    const seat = game.seats.find((item) => item.seatId === game.currentActorSeatId);
    if (seat) return { kind: "actor", label: "行动中", seat };
  }
  if (game.currentSpeakerSeatId) {
    const seat = game.seats.find((item) => item.seatId === game.currentSpeakerSeatId);
    if (seat) return { kind: "speaker", label: "发言中", seat };
  }
  return { kind: "none", label: game.phase.startsWith("NIGHT") ? "夜晚流程" : "桌面等待", seat: undefined };
}

export function getMobileActionMode(
  game: HumanGameView,
  loading = false,
): { kind: "player" | "auto" | "waiting" | "loading" | "gameOver"; label: string; action?: AvailableHumanAction } {
  if (game.result) return { kind: "gameOver", label: "终局" };
  if (loading) return { kind: "loading", label: "结算中", action: game.availableActions[0] };
  const action = game.availableActions[0];
  if (!action) return { kind: "waiting", label: "等待 AI 行动" };
  if (game.availableActions.every((item) => item.type === "continue")) {
    return { kind: "auto", label: "自动播放", action };
  }
  return { kind: "player", label: "轮到你行动", action };
}
```

- [ ] **Step 4: Run the helper tests green**

Run:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper task**

Run:

```powershell
git add src/components/game/mobileTableModel.ts src/components/game/mobileTableModel.test.ts
git commit -m "feat: add mobile table model helpers"
```

Expected: commit succeeds.

## Task 2: Export Embedded Information Panels

**Files:**
- Modify: `src/components/game/TablePanels.tsx`

- [ ] **Step 1: Add exports for existing embedded panel functions**

Modify these function declarations in `src/components/game/TablePanels.tsx`:

```ts
export function TableNotesPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
```

```ts
export function InfoPanel({ game, embedded = false }: { game: HumanGameView; embedded?: boolean }) {
```

```ts
export function PublicLog({
  game,
  events,
  embedded = false,
}: {
  game: HumanGameView;
  events: HumanGameView["publicEvents"];
  embedded?: boolean;
}) {
```

No JSX body changes are needed in this task.

- [ ] **Step 2: Run TypeScript check**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS. If TypeScript reports duplicate exports, confirm only the three function declarations received `export` and there is no separate export block for the same names.

- [ ] **Step 3: Commit panel exports**

Run:

```powershell
git add src/components/game/TablePanels.tsx
git commit -m "refactor: export embedded table panels"
```

Expected: commit succeeds.

## Task 3: Build The Mobile Game Table Shell

**Files:**
- Create: `src/components/game/MobileGameTable.tsx`

- [ ] **Step 1: Create the mobile shell component**

Create `src/components/game/MobileGameTable.tsx` with this structure:

```tsx
"use client";

import { useMemo, useState } from "react";
import type * as React from "react";
import type { HumanGameView } from "@/game/types";
import { ActionPanel } from "./ActionPanel";
import type { AiSpeechAudioStatus, CommandPayload, HostAudioStatus, LiveAiSpeech } from "./clientTypes";
import { StatusPill } from "./PanelPrimitives";
import { InfoPanel, PublicLog, SpeechFeed, TableNotesPanel, VoteTable } from "./TablePanels";
import { seatNumber } from "./viewHelpers";
import {
  MOBILE_INFO_TABS,
  getMobileActionMode,
  getMobileFocusSeat,
  getMobileSeatCounts,
  type MobileInfoTabKey,
} from "./mobileTableModel";

export function MobileGameTable({
  game,
  loading,
  pendingCommandType,
  liveAiSpeech,
  hostAudioStatus,
  aiSpeechAudioStatus,
  aiSpeechAudioUnavailable,
  events,
  onNewGame,
  onSubmit,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
  liveAiSpeech: LiveAiSpeech | null;
  hostAudioStatus: HostAudioStatus | null;
  aiSpeechAudioStatus: AiSpeechAudioStatus | null;
  aiSpeechAudioUnavailable: boolean;
  events: HumanGameView["publicEvents"];
  onNewGame: () => Promise<void>;
  onSubmit: (payload: CommandPayload) => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  const [activeTab, setActiveTab] = useState<MobileInfoTabKey>("identity");
  const counts = getMobileSeatCounts(game);
  const focusSeat = getMobileFocusSeat(game);
  const actionMode = getMobileActionMode(game, loading);
  const actionStatus = useMemo(() => {
    if (liveAiSpeech) return `AI 发言生成中：${seatNumber(liveAiSpeech.speaker)}`;
    if (aiSpeechAudioStatus) return `${seatNumber(aiSpeechAudioStatus.speaker)}语音${aiSpeechAudioStatus.state === "paused" ? "已暂停" : "播放中"}`;
    if (hostAudioStatus) return "主持人播报中";
    if (aiSpeechAudioUnavailable && game.phase === "DAY_SPEECH") return "AI 语音已转文字";
    return actionMode.label;
  }, [actionMode.label, aiSpeechAudioStatus, aiSpeechAudioUnavailable, game.phase, hostAudioStatus, liveAiSpeech]);

  return (
    <section className="mobile-game-table sm:hidden" aria-label="手机版狼人杀牌桌">
      <MobileTopStrip
        game={game}
        aliveCount={counts.aliveCount}
        deadCount={counts.deadCount}
        actionStatus={actionStatus}
        onNewGame={onNewGame}
        onOpenIdentityBook={onOpenIdentityBook}
        onOpenGlossary={onOpenGlossary}
        onToggleAiSpeechAudio={onToggleAiSpeechAudio}
        onToggleHostAudio={onToggleHostAudio}
      />
      <MobileSeatTable game={game} focusSeat={focusSeat} />
      <MobileInfoTabs activeTab={activeTab} onSelectTab={setActiveTab} />
      <MobileInfoSheet
        activeTab={activeTab}
        game={game}
        events={events}
        liveAiSpeech={liveAiSpeech}
        loading={loading}
        pendingCommandType={pendingCommandType}
      />
      <div className="mobile-action-sheet">
        <div className="mobile-action-grip" aria-hidden="true" />
        <ActionPanel game={game} loading={loading} onNewGame={onNewGame} onSubmit={onSubmit} />
      </div>
    </section>
  );
}

function MobileTopStrip({
  game,
  aliveCount,
  deadCount,
  actionStatus,
  onNewGame,
  onOpenIdentityBook,
  onOpenGlossary,
  onToggleAiSpeechAudio,
  onToggleHostAudio,
}: {
  game: HumanGameView;
  aliveCount: number;
  deadCount: number;
  actionStatus: string;
  onNewGame: () => Promise<void>;
  onOpenIdentityBook: () => void;
  onOpenGlossary: () => void;
  onToggleAiSpeechAudio: () => void;
  onToggleHostAudio: () => void;
}) {
  return (
    <header className="mobile-table-top-strip">
      <div className="min-w-0">
        <div className="mobile-table-kicker">单人 AI 狼人杀</div>
        <div className="mobile-table-phase-row">
          <StatusPill tone="gold">第 {game.day} 天</StatusPill>
          <StatusPill tone={game.phase.startsWith("NIGHT") ? "blue" : "green"}>{game.phaseLabel}</StatusPill>
        </div>
        <div className="mobile-table-status-line">{actionStatus}</div>
      </div>
      <div className="mobile-table-quick-actions" aria-label="牌桌快捷操作">
        <button type="button" onClick={onOpenIdentityBook}>身份</button>
        <button type="button" onClick={onOpenGlossary}>术语</button>
        <button type="button" onClick={onToggleHostAudio}>主持</button>
        <button type="button" onClick={onToggleAiSpeechAudio}>语音</button>
        <button type="button" onClick={() => void onNewGame()}>新局</button>
      </div>
      <div className="mobile-table-counts" aria-label={`存活 ${aliveCount}，出局 ${deadCount}`}>
        <span>存活 {aliveCount}</span>
        <span>出局 {deadCount}</span>
      </div>
    </header>
  );
}

function MobileSeatTable({
  game,
  focusSeat,
}: {
  game: HumanGameView;
  focusSeat: ReturnType<typeof getMobileFocusSeat>;
}) {
  return (
    <section className="mobile-seat-table" aria-label="玩家座位">
      <div className="mobile-seat-core">
        <div className="mobile-seat-core-label">{focusSeat.label}</div>
        <div className="mobile-seat-core-title">{focusSeat.seat ? seatNumber(focusSeat.seat) : `第 ${game.day} 天`}</div>
        <div className="mobile-seat-core-detail">{focusSeat.seat?.name ?? game.phaseLabel}</div>
      </div>
      {game.seats.map((seat, index) => {
        const angle = (index / Math.max(1, game.seats.length)) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 39;
        const y = 50 + Math.sin(angle) * 41;
        const isFocus = focusSeat.seat?.seatId === seat.seatId;
        return (
          <div
            key={seat.seatId}
            className={[
              "mobile-seat-chip",
              seat.alive ? "mobile-seat-alive" : "mobile-seat-dead",
              seat.isHuman ? "mobile-seat-self" : "",
              isFocus ? "mobile-seat-focus" : "",
            ].join(" ")}
            style={{ left: `${x}%`, top: `${y}%`, "--seat-index": index } as React.CSSProperties}
          >
            <span className="mobile-seat-number">{seat.seatId}号</span>
            <span className="mobile-seat-name">{seat.isHuman ? "我" : seat.name}</span>
            <span className="mobile-seat-state">{seat.alive ? "存活" : "出局"}</span>
          </div>
        );
      })}
    </section>
  );
}

function MobileInfoTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: MobileInfoTabKey;
  onSelectTab: (tab: MobileInfoTabKey) => void;
}) {
  return (
    <nav className="mobile-info-tabs" aria-label="局内信息">
      {MOBILE_INFO_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={activeTab === tab.key}
          onClick={() => onSelectTab(tab.key)}
          className={activeTab === tab.key ? "mobile-info-tab-active" : ""}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function MobileInfoSheet({
  activeTab,
  game,
  events,
  liveAiSpeech,
  loading,
  pendingCommandType,
}: {
  activeTab: MobileInfoTabKey;
  game: HumanGameView;
  events: HumanGameView["publicEvents"];
  liveAiSpeech: LiveAiSpeech | null;
  loading: boolean;
  pendingCommandType: CommandPayload["type"] | null;
}) {
  return (
    <section className="mobile-info-sheet" aria-label={`${MOBILE_INFO_TABS.find((tab) => tab.key === activeTab)?.label ?? "信息"}面板`}>
      {activeTab === "identity" && <InfoPanel game={game} embedded />}
      {activeTab === "speech" && <SpeechFeed game={game} liveAiSpeech={liveAiSpeech} variant="sidebar" />}
      {activeTab === "vote" && <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />}
      {activeTab === "log" && (
        <div className="grid gap-4">
          <TableNotesPanel game={game} embedded />
          <PublicLog game={game} events={events} embedded />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript for the new component**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit mobile component**

Run:

```powershell
git add src/components/game/MobileGameTable.tsx
git commit -m "feat: add mobile game table shell"
```

Expected: commit succeeds.

## Task 4: Wire Mobile Shell Into GameClient

**Files:**
- Modify: `src/components/GameClient.tsx`

- [ ] **Step 1: Import the mobile component**

In `src/components/GameClient.tsx`, add:

```ts
import { MobileGameTable } from "./game/MobileGameTable";
```

- [ ] **Step 2: Hide the desktop header after mobile game start**

Replace the current `RoomHeader` render with:

```tsx
        <div className={game ? "hidden sm:block" : ""}>
          <RoomHeader
            game={game}
            loading={loading}
            aiSpeechAudioEnabled={aiSpeechAudioEnabled}
            aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
            hostAudioEnabled={hostAudioEnabled}
            onNewGame={startGame}
            onOpenIdentityBook={() => setIdentityBookOpen(true)}
            onOpenGlossary={() => setGlossaryOpen(true)}
            onToggleAiSpeechAudio={toggleAiSpeechAudio}
            onToggleHostAudio={toggleHostAudio}
          />
        </div>
```

This keeps the landing header unchanged and lets `MobileGameTable` own the in-game phone controls.

- [ ] **Step 3: Render mobile and desktop compositions separately**

Replace the started-game branch:

```tsx
        ) : (
          <div className="grid flex-1 gap-4">
            <PhaseRhythm game={game} />
            <HostStage game={game} />
            <FlowStatusBar
```

through the matching closing `</div>` for that branch with:

```tsx
        ) : (
          <div className="grid flex-1 gap-4">
            <MobileGameTable
              game={game}
              loading={loading}
              pendingCommandType={pendingCommandType}
              liveAiSpeech={liveAiSpeech}
              hostAudioStatus={hostAudioStatus}
              aiSpeechAudioStatus={aiSpeechAudioStatus}
              aiSpeechAudioUnavailable={aiSpeechAudioUnavailable}
              events={latestEvents}
              onNewGame={startGame}
              onSubmit={submitCommand}
              onOpenIdentityBook={() => setIdentityBookOpen(true)}
              onOpenGlossary={() => setGlossaryOpen(true)}
              onToggleAiSpeechAudio={toggleAiSpeechAudio}
              onToggleHostAudio={toggleHostAudio}
            />

            <div className="hidden gap-4 sm:grid">
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
                  <ActionPanel game={game} loading={loading} onNewGame={startGame} onSubmit={submitCommand} />
                  <VoteTable game={game} loading={loading} pendingCommandType={pendingCommandType} />
                  <AuxiliaryInfoPanel game={game} events={latestEvents} />
                </aside>
              </section>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit GameClient wiring**

Run:

```powershell
git add src/components/GameClient.tsx
git commit -m "feat: render mobile table in game client"
```

Expected: commit succeeds.

## Task 5: Add Mobile Table Styling

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add mobile shell CSS before the existing reduced-motion block**

Add this block before `@media (prefers-reduced-motion: reduce)`:

```css
@media (max-width: 639px) {
  .mobile-game-table {
    display: grid;
    gap: 10px;
    min-height: calc(100svh - 24px);
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  .mobile-table-top-strip {
    align-items: start;
    background: rgba(19, 13, 11, 0.88);
    border: 1px solid rgba(241, 199, 110, 0.22);
    border-radius: 20px;
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr);
    padding: 10px;
  }

  .mobile-table-kicker {
    color: rgba(241, 215, 150, 0.72);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .mobile-table-phase-row,
  .mobile-table-quick-actions,
  .mobile-table-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mobile-table-status-line {
    color: rgba(247, 234, 213, 0.74);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 4px;
  }

  .mobile-table-quick-actions button,
  .mobile-info-tabs button {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.2);
    color: rgba(220, 201, 167, 0.9);
    font-size: 11px;
    font-weight: 700;
    min-height: 32px;
    padding: 6px 10px;
  }

  .mobile-table-counts span {
    border: 1px solid rgba(119, 216, 152, 0.18);
    border-radius: 999px;
    background: rgba(15, 33, 24, 0.58);
    color: #a8f0b6;
    font-size: 11px;
    padding: 5px 8px;
  }

  .mobile-seat-table {
    background:
      radial-gradient(circle at 50% 44%, rgba(241, 199, 110, 0.2), transparent 38%),
      linear-gradient(180deg, rgba(18, 11, 9, 0.72), rgba(8, 6, 5, 0.86));
    border: 1px solid rgba(241, 199, 110, 0.24);
    border-radius: 28px;
    box-shadow: 0 20px 42px rgba(0, 0, 0, 0.42);
    min-height: clamp(320px, 48svh, 390px);
    overflow: hidden;
    position: relative;
  }

  .mobile-seat-core {
    align-items: center;
    background: rgba(19, 13, 11, 0.78);
    border: 1px solid rgba(241, 199, 110, 0.28);
    border-radius: 999px;
    display: grid;
    height: 128px;
    justify-items: center;
    left: 50%;
    padding: 16px;
    position: absolute;
    text-align: center;
    top: 48%;
    transform: translate(-50%, -50%);
    width: 128px;
    z-index: 1;
  }

  .mobile-seat-core-label {
    color: rgba(173, 156, 125, 0.9);
    font-size: 10px;
    font-weight: 700;
  }

  .mobile-seat-core-title {
    color: #f1d796;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.1;
  }

  .mobile-seat-core-detail {
    color: rgba(247, 234, 213, 0.72);
    font-size: 12px;
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-seat-chip {
    animation: seat-token-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--seat-index, 0) * 28ms);
    background: rgba(24, 15, 12, 0.9);
    border: 1px solid rgba(241, 199, 110, 0.22);
    border-radius: 14px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
    display: grid;
    min-height: 58px;
    padding: 6px;
    position: absolute;
    text-align: center;
    transform: translate(-50%, -50%);
    width: 66px;
  }

  .mobile-seat-focus {
    border-color: rgba(119, 216, 152, 0.78);
    box-shadow: 0 0 0 2px rgba(119, 216, 152, 0.18), 0 14px 28px rgba(0, 0, 0, 0.34);
  }

  .mobile-seat-self {
    background: rgba(37, 19, 15, 0.94);
    border-color: rgba(241, 199, 110, 0.42);
  }

  .mobile-seat-dead {
    border-color: rgba(139, 74, 61, 0.55);
    opacity: 0.7;
  }

  .mobile-seat-number,
  .mobile-seat-name,
  .mobile-seat-state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-seat-number {
    color: #f1d796;
    font-size: 11px;
    font-weight: 800;
  }

  .mobile-seat-name {
    color: #f7ead5;
    font-size: 10px;
    font-weight: 700;
  }

  .mobile-seat-state {
    color: #9fe0a4;
    font-size: 10px;
  }

  .mobile-seat-dead .mobile-seat-state {
    color: #ffb1a4;
  }

  .mobile-info-tabs {
    background: rgba(19, 13, 11, 0.82);
    border: 1px solid rgba(241, 199, 110, 0.16);
    border-radius: 999px;
    display: grid;
    gap: 4px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: 4px;
  }

  .mobile-info-tabs .mobile-info-tab-active {
    background: rgba(241, 199, 110, 0.16);
    border-color: rgba(241, 199, 110, 0.34);
    color: #f1d796;
  }

  .mobile-info-sheet {
    background: rgba(9, 6, 5, 0.62);
    border: 1px solid rgba(241, 199, 110, 0.12);
    border-radius: 20px;
    max-height: 24svh;
    overflow-y: auto;
    padding: 8px;
  }

  .mobile-info-sheet > section,
  .mobile-action-sheet > section {
    border-radius: 18px;
  }

  .mobile-action-sheet {
    background: rgba(19, 13, 11, 0.94);
    border: 1px solid rgba(241, 199, 110, 0.24);
    border-radius: 24px;
    box-shadow: 0 -14px 36px rgba(0, 0, 0, 0.36);
    max-height: 38svh;
    overflow-y: auto;
    padding: 8px;
  }

  .mobile-action-grip {
    background: rgba(241, 199, 110, 0.32);
    border-radius: 999px;
    height: 4px;
    margin: 0 auto 8px;
    width: 44px;
  }

  .mobile-action-sheet .rounded-\[24px\],
  .mobile-info-sheet .rounded-\[24px\] {
    border-radius: 18px;
  }

  .mobile-action-sheet textarea {
    min-height: 96px;
  }
}
```

- [ ] **Step 2: Add reduced-motion coverage**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add `.mobile-seat-chip` beside other animated seat elements:

```css
  .mobile-seat-chip,
```

Expected: mobile seat entry animations stop for reduced-motion users.

- [ ] **Step 3: Run lint and typecheck**

Run:

```powershell
npm run lint
npx tsc --noEmit
```

Expected: PASS for both.

- [ ] **Step 4: Commit mobile CSS**

Run:

```powershell
git add src/app/globals.css
git commit -m "style: add mobile werewolf table layout"
```

Expected: commit succeeds.

## Task 6: Mobile Browser Verification

**Files:**
- Verify: mobile UI in browser
- Possible fixes: `src/components/game/MobileGameTable.tsx`, `src/components/GameClient.tsx`, `src/app/globals.css`

- [ ] **Step 1: Start the dev server**

Run:

```powershell
$env:AI_SPEECH_PROVIDER='mock'; $env:AI_ACTION_PROVIDER='mock'; npm run dev -- --hostname 127.0.0.1 --port 3003
```

Expected: Next.js starts on `http://127.0.0.1:3003`. If port 3003 is busy, use 3004 and record the chosen port.

- [ ] **Step 2: Open mobile viewport in Browser**

Use Browser with a 390px-wide viewport and open:

```text
http://127.0.0.1:3003
```

Expected: landing page still works. Start a game, dismiss role intro, and observe the mobile table.

- [ ] **Step 3: Capture a started-game mobile screenshot**

Expected visual requirements:

- top strip visible without desktop header crowding it
- circular seat table visible in the first viewport
- current phase and current actor/speaker visible
- bottom tabs visible
- action sheet visible with primary controls
- no incoherent text overlap
- no need to scroll to discover the primary action

Save screenshot under:

```text
tmp/mobile-werewolf-table-started.png
```

- [ ] **Step 4: Exercise info tabs**

Click `身份`, `发言`, `票型`, and `记录`.

Expected:

- each tab changes the information sheet
- speech feed remains readable in its sheet
- vote table is accessible
- private info and public log remain reachable
- action sheet remains reachable after tab changes

Save one tab screenshot under:

```text
tmp/mobile-werewolf-table-tabs.png
```

- [ ] **Step 5: Exercise at least one action state**

If the first state is a human night action, click a legal target. If it is auto-continue, click the immediate continue/skip button. Continue until one additional phase is visible.

Expected:

- command succeeds
- mobile table refreshes without returning to the desktop stacked layout
- action sheet still describes the next action

Save screenshot under:

```text
tmp/mobile-werewolf-table-action.png
```

- [ ] **Step 6: Fix visual defects if needed**

Only fix defects inside:

```text
src/components/game/MobileGameTable.tsx
src/components/GameClient.tsx
src/app/globals.css
```

After each fix, reload the browser and repeat the affected screenshot check.

- [ ] **Step 7: Commit verification fixes**

If code changed during verification, run:

```powershell
git add src/components/game/MobileGameTable.tsx src/components/GameClient.tsx src/app/globals.css
git commit -m "fix: polish mobile table verification"
```

Expected: commit succeeds if changes were made. If no changes were made, skip this step.

## Task 7: Final Validation

**Files:**
- Verify all modified frontend files.

- [ ] **Step 1: Run focused component tests**

Run:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts src/components/game/actionGuidance.test.ts src/components/game/viewHelpers.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run broader test suite**

Run:

```powershell
npm run test
```

Expected: PASS. If unrelated tests fail because of existing dirty worktree changes, capture the failing file names and error messages before deciding whether the failure is in scope.

- [ ] **Step 5: Inspect git state**

Run:

```powershell
git status --short --untracked-files=all
git diff --check
git log --oneline -5
```

Expected:

- only intended tracked files are modified or committed
- untracked `.superpowers/`, `promo-ai-werewolf/`, and `tmp/` artifacts may remain unrelated
- `git diff --check` reports no whitespace errors
- recent commits show the mobile table plan and implementation commits

## Self-Review

- Spec coverage: the plan includes mobile-only composition, first-viewport status/table/action priority, information tabs, desktop preservation, CSS responsive rules, and browser screenshot validation.
- Scope control: no task modifies `src/game/**`, `src/ai/**`, `src/server/**`, `src/app/api/**`, persistence, or room storage.
- Test strategy: helper state is covered by Vitest before production code; layout and visual density are verified by mobile browser screenshots because the repo does not currently include a React component testing framework.
- Type consistency: `MobileInfoTabKey`, `MOBILE_INFO_TABS`, `getMobileSeatCounts`, `getMobileFocusSeat`, and `getMobileActionMode` are defined in Task 1 and reused in Task 3.
