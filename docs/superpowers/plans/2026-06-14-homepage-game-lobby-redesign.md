# Homepage Game Lobby Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the desktop homepage as a cinematic AI Werewolf game lobby with four image-based recommended board cards, a central table preview, a compact right rail, and an all-board modal.

**Architecture:** Keep `LandingPanel` as the stateful composition boundary. Add pure board metadata helpers for testable recommendation/image mapping, then add desktop-only presentational components that reuse existing callbacks and data. Keep the current mobile markup available under mobile breakpoints so this slice does not rewrite the phone homepage.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 utilities, Vitest, `renderToStaticMarkup` component checks, built-in image generation for four PNG assets.

---

### Task 1: Board Lobby Metadata

**Files:**
- Create: `src/components/game/homepageBoardModel.ts`
- Create: `src/components/game/homepageBoardModel.test.ts`

- [ ] **Step 1: Write the failing metadata tests**

```ts
import { describe, expect, it } from "vitest";
import { getDefaultBoardOptions } from "./boardSelectionModel";
import {
  HOME_BOARD_ART_BY_ID,
  RECOMMENDED_HOME_BOARD_IDS,
  buildHomepageBoardCards,
} from "./homepageBoardModel";

describe("homepage board model", () => {
  it("keeps the four approved recommended boards in order", () => {
    expect(RECOMMENDED_HOME_BOARD_IDS).toEqual([
      "6p-beginner-seer",
      "9p-seer-witch-hunter",
      "12p-sheriff-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-knight",
    ]);
  });

  it("maps recommended boards to image assets and lobby labels", () => {
    const cards = buildHomepageBoardCards(getDefaultBoardOptions());

    expect(cards.map((card) => card.board.name)).toEqual([
      "6 人新手局",
      "9 人预女猎",
      "12 人标准警长局",
      "12 人白狼王骑士局",
    ]);
    expect(cards.map((card) => card.art.src)).toEqual([
      "/images/home-board-6p-beginner-seer.png",
      "/images/home-board-9p-seer-witch-hunter.png",
      "/images/home-board-12p-standard-sheriff.png",
      "/images/home-board-12p-white-wolf-king-knight.png",
    ]);
    expect(cards.map((card) => card.badge)).toEqual(["新手友好", "进阶标准", "平衡推荐", "高压进阶"]);
  });

  it("does not fail if an approved board is absent from a filtered board list", () => {
    const boards = getDefaultBoardOptions().filter((board) => board.id !== "9p-seer-witch-hunter");

    expect(buildHomepageBoardCards(boards).map((card) => card.board.id)).toEqual([
      "6p-beginner-seer",
      "12p-sheriff-seer-witch-hunter-guard",
      "12p-sheriff-white-wolf-king-knight",
    ]);
  });

  it("has art metadata for every approved recommended board", () => {
    for (const boardId of RECOMMENDED_HOME_BOARD_IDS) {
      expect(HOME_BOARD_ART_BY_ID[boardId]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test -- src/components/game/homepageBoardModel.test.ts`

Expected: FAIL because `homepageBoardModel.ts` does not exist.

- [ ] **Step 3: Implement the metadata helper**

```ts
import type { BoardOption } from "./clientTypes";

export const RECOMMENDED_HOME_BOARD_IDS = [
  "6p-beginner-seer",
  "9p-seer-witch-hunter",
  "12p-sheriff-seer-witch-hunter-guard",
  "12p-sheriff-white-wolf-king-knight",
] as const;

type RecommendedHomeBoardId = (typeof RECOMMENDED_HOME_BOARD_IDS)[number];

type BoardArt = {
  src: string;
  alt: string;
};

export type HomepageBoardCard = {
  board: BoardOption;
  badge: string;
  tone: "beginner" | "classic" | "standard" | "advanced";
  art: BoardArt;
};

export const HOME_BOARD_ART_BY_ID: Record<RecommendedHomeBoardId, BoardArt> = {
  "6p-beginner-seer": {
    src: "/images/home-board-6p-beginner-seer.png",
    alt: "月夜村庄新手狼人杀牌板场景",
  },
  "9p-seer-witch-hunter": {
    src: "/images/home-board-9p-seer-witch-hunter.png",
    alt: "阴森庄园九人预女猎牌板场景",
  },
  "12p-sheriff-seer-witch-hunter-guard": {
    src: "/images/home-board-12p-standard-sheriff.png",
    alt: "警长圆桌十二人标准局牌板场景",
  },
  "12p-sheriff-white-wolf-king-knight": {
    src: "/images/home-board-12p-white-wolf-king-knight.png",
    alt: "白狼王骑士高压进阶牌板场景",
  },
};

const HOME_BOARD_BADGES: Record<RecommendedHomeBoardId, Pick<HomepageBoardCard, "badge" | "tone">> = {
  "6p-beginner-seer": { badge: "新手友好", tone: "beginner" },
  "9p-seer-witch-hunter": { badge: "进阶标准", tone: "classic" },
  "12p-sheriff-seer-witch-hunter-guard": { badge: "平衡推荐", tone: "standard" },
  "12p-sheriff-white-wolf-king-knight": { badge: "高压进阶", tone: "advanced" },
};

export function buildHomepageBoardCards(boards: BoardOption[]): HomepageBoardCard[] {
  return RECOMMENDED_HOME_BOARD_IDS.flatMap((boardId) => {
    const board = boards.find((item) => item.id === boardId);
    if (!board) return [];
    return [
      {
        board,
        ...HOME_BOARD_BADGES[boardId],
        art: HOME_BOARD_ART_BY_ID[boardId],
      },
    ];
  });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm run test -- src/components/game/homepageBoardModel.test.ts`

Expected: PASS.

### Task 2: Image Assets

**Files:**
- Create: `public/images/home-board-6p-beginner-seer.png`
- Create: `public/images/home-board-9p-seer-witch-hunter.png`
- Create: `public/images/home-board-12p-standard-sheriff.png`
- Create: `public/images/home-board-12p-white-wolf-king-knight.png`

- [ ] **Step 1: Generate four board art images with image2**

Use built-in image generation once per asset. Generate images without text or UI labels.

Prompt core for all four:

```text
Dark cinematic werewolf board-game lobby illustration, vertical board card background, no text, no logo, no watermark, candlelight and moonlight, premium game art, high readability when dark overlay text is added later, no copyrighted characters.
```

Specific scene additions:

```text
6人新手局: moonlit village square, warm windows, small friendly werewolf mystery atmosphere.
9人预女猎: haunted manor or castle at night, tense but elegant, blue moonlight and candle glow.
12人标准警长局: grand round-table council hall, sheriff badge motif on table, many empty seats, gold candlelight.
12人白狼王骑士局: white wolf king silhouette and knightly standard in a dark forest courtyard, high pressure, crimson and moon gold accents.
```

- [ ] **Step 2: Copy selected outputs into `public/images`**

Copy, do not move, the selected generated images from `C:\Users\MQL\.codex\generated_images\...` into the exact file names listed above.

- [ ] **Step 3: Inspect the images**

Open each image and verify:

- no baked-in text,
- enough dark negative space for card labels,
- no copyrighted or unrelated characters,
- each image is visually distinct.

### Task 3: Desktop Lobby Component

**Files:**
- Create: `src/components/game/HomepageDesktopLobby.tsx`
- Modify: `src/components/game/LandingPanel.tsx`
- Test: `src/components/game/gamePanelsMobile.test.ts`

- [ ] **Step 1: Write failing static render assertions**

Add a new test to `src/components/game/gamePanelsMobile.test.ts`:

```ts
it("renders the desktop game lobby shell with recommended board cards and no fake economy navigation", () => {
  const boards = getDefaultBoardOptions();
  const html = renderToStaticMarkup(
    createElement(LandingPanel, {
      loading: false,
      boards,
      selectedBoardId: "6p-beginner-seer",
      onSelectBoard: () => undefined,
      humanSeatMode: "fixed",
      selectedHumanSeatId: 1,
      onSelectRandomHumanSeat: () => undefined,
      onSelectFixedHumanSeat: () => undefined,
      onSelectNoHumanSeat: () => undefined,
      selectedAiFriendCount: 8,
      customAiFriendCount: 0,
      aiLineupPreview: [],
      recentGameIds: [],
      onLoadGame: async () => undefined,
      onStartGame: async () => undefined,
    }),
  );

  expect(html).toContain("homepage-game-lobby");
  expect(html).toContain("homepage-board-card");
  expect(html).toContain("查看更多");
  expect(html).toContain("进入联机房间");
  expect(html).toContain("进入牌桌");
  expect(html).not.toContain("金币");
  expect(html).not.toContain("排行榜");
  expect(html).not.toContain("成就");
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test -- src/components/game/gamePanelsMobile.test.ts`

Expected: FAIL because the desktop lobby shell does not exist yet.

- [ ] **Step 3: Create `HomepageDesktopLobby.tsx`**

Implement a `"use client"` component that receives the same data/callbacks needed by desktop homepage sections. It must render:

- `.homepage-game-lobby`
- four `.homepage-board-card` buttons from `buildHomepageBoardCards(boards)`
- a “查看更多” button that opens a local modal state
- central `.homepage-table-preview`
- right rail with AI pool, seat preview, recent games
- all-board modal when open

The modal selection handler should call `onSelectBoard(board.id)` and then close the modal.

- [ ] **Step 4: Wire `LandingPanel`**

In `LandingPanel.tsx`:

- import `HomepageDesktopLobby`
- render the new component in a desktop-only wrapper such as `hidden xl:block`
- keep the existing mobile layout in an `xl:hidden` wrapper
- pass existing props and callbacks through unchanged

- [ ] **Step 5: Run tests**

Run:

```powershell
npm run test -- src/components/game/homepageBoardModel.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: PASS.

### Task 4: Styling And Motion

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add desktop lobby CSS classes**

Add CSS under the existing app CSS:

- `.homepage-game-lobby`
- `.homepage-lobby-topbar`
- `.homepage-board-card`
- `.homepage-board-card-selected`
- `.homepage-table-preview`
- `.homepage-seat-orbit`
- `.homepage-lobby-rail`
- `.homepage-board-modal`

Use dark tabletop colors, gold borders, crimson primary buttons, muted green AI states, and moon-blue secondary borders.

- [ ] **Step 2: Add reduced-motion protection**

Extend the existing `@media (prefers-reduced-motion: reduce)` block so new homepage classes have animations disabled.

- [ ] **Step 3: Run type and focused tests**

Run:

```powershell
npx tsc --noEmit
npm run test -- src/components/game/homepageBoardModel.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: both commands exit 0.

### Task 5: Browser Verification

**Files:**
- No source edits unless browser inspection finds a defect.

- [ ] **Step 1: Start local dev server**

Run: `npm run dev -- --port 3000`

If port 3000 is busy, use another available port and record it.

- [ ] **Step 2: Desktop browser pass**

Open the homepage at the local URL and verify:

- four image board cards render,
- clicking recommended boards updates selected state,
- “查看更多” opens the modal,
- selecting another board in the modal updates the current choice,
- `进入联机房间` points to `/rooms`,
- `进入牌桌` creates a game or reaches the expected loading/action path,
- no fake economy/navigation appears.

- [ ] **Step 3: Mobile guard pass**

Open a mobile viewport and verify the existing mobile homepage still renders a compact start flow.

- [ ] **Step 4: Final checks**

Run:

```powershell
git diff --check
npx tsc --noEmit
npm run test -- src/components/game/homepageBoardModel.test.ts src/components/game/gamePanelsMobile.test.ts
```

Expected: all commands exit 0.
