# Shared Render Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing private Render metrics dashboard safe to use as the shared historical analytics dashboard for both Render and Tencent Cloud.

**Architecture:** Keep the existing `/admin/metrics` dashboard and `roomAnalytics` event store. Do not add a new data pipeline. The implementation only clarifies UI scope, documents the shared analytics database configuration, and preserves best-effort anonymous aggregate collection.

**Tech Stack:** Next.js App Router, React server components, Vitest, PostgreSQL via `pg`, Markdown deployment runbooks.

---

## File Structure

- Modify: `src/app/admin/metrics/page.tsx`
  - Add dashboard copy that distinguishes shared historical analytics from local live room state.
  - Rename live room labels so they do not imply cross-server totals.
  - Add metric definitions for shared history and local live state.
- Create: `src/app/admin/metrics/page.test.tsx`
  - Static-render the admin dashboard with mocked metrics.
  - Assert the shared-history and local-live caveat copy is present.
- Modify: `.env.example`
  - Document `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` as the optional dedicated shared analytics database URL.
- Modify: `docs/render-deploy.md`
  - Document how Render remains the owner dashboard and how Tencent Cloud can write anonymous events to the same Render PostgreSQL analytics store.
- Modify: `docs/tencent-cloud-deploy.md`
  - Add the Tencent Cloud environment-variable step for shared analytics, using placeholders only.

No implementation task should add accounts, IP tracking, public dashboards, personal timelines, cross-server live room federation, or real secret values.

---

### Task 1: Add Admin Dashboard Scope Test

**Files:**
- Create: `src/app/admin/metrics/page.test.tsx`
- Run: `npm run test -- src/app/admin/metrics/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/admin/metrics/page.test.tsx` with this content:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetricsPage from "./page";
import { checkRoomMetricsAccess } from "@/server/roomMetricsAccess";
import type { RoomMetricsSnapshot } from "@/server/roomService";
import { getRoomMetricsSnapshot } from "@/server/roomService";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/server/roomMetricsAccess", () => ({
  checkRoomMetricsAccess: vi.fn(),
}));

vi.mock("@/server/roomService", () => ({
  getRoomMetricsSnapshot: vi.fn(),
}));

const mockCheckRoomMetricsAccess = vi.mocked(checkRoomMetricsAccess);
const mockGetRoomMetricsSnapshot = vi.mocked(getRoomMetricsSnapshot);

describe("AdminMetricsPage", () => {
  beforeEach(() => {
    mockCheckRoomMetricsAccess.mockReturnValue({ allowed: true, mode: "token" });
    mockGetRoomMetricsSnapshot.mockResolvedValue(createMetricsSnapshot());
  });

  it("labels shared historical analytics separately from local live room state", async () => {
    const element = await AdminMetricsPage({
      searchParams: Promise.resolve({ token: "test-owner-token" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("共享历史指标");
    expect(html).toContain("打开、开局、完局和趋势会按同一个 PostgreSQL 指标库合计");
    expect(html).toContain("本机实时状态");
    expect(html).toContain("不代表腾讯云实时房间总量");
    expect(html).toContain("本机实时房间光谱");
    expect(html).toContain("本机房间状态和风险");
  });
});

function createMetricsSnapshot(): RoomMetricsSnapshot {
  return {
    checkedAt: "2026-05-23T03:00:00.000Z",
    current: {
      humanPlayers: 2,
      onlineConnections: 0,
      onlinePlayers: 0,
      rooms: {
        activeInGame: 1,
        finished: 0,
        inactiveInGame: 1,
        lobby: 1,
        total: 2,
      },
    },
    history: {
      activeRoomGameMinutes: 2.5,
      adapter: "postgres",
      averageFinishedGameMinutes: 12,
      averageMainGameMinutes: 8,
      averageSiteGameMinutes: 10,
      gamesFinished: 1,
      gamesStarted: 2,
      homeViews: 9,
      mainCompletionRate: 50,
      mainGamesFinished: 1,
      mainGamesStarted: 2,
      recentDays: [
        {
          date: "2026-05-23",
          gamesFinished: 1,
          gamesStarted: 2,
          homeViews: 9,
          mainGamesFinished: 1,
          mainGamesStarted: 2,
          playersJoined: 2,
          roomsCreated: 1,
        },
      ],
      roomCompletionRate: 50,
      siteCompletionRate: 50,
      totalFinishedGameMinutes: 12,
      totalMainGameMinutes: 8,
      totalPlayersEver: 2,
      totalRoomGameMinutes: 12,
      totalRoomsEver: 1,
      totalSiteGameMinutes: 20,
      trackedSince: "2026-05-23T02:00:00.000Z",
    },
  };
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test -- src/app/admin/metrics/page.test.tsx
```

Expected: FAIL because the current dashboard does not contain `共享历史指标`, `本机实时房间光谱`, or `本机房间状态和风险`.

---

### Task 2: Update Dashboard Scope Copy

**Files:**
- Modify: `src/app/admin/metrics/page.tsx`
- Test: `src/app/admin/metrics/page.test.tsx`

- [ ] **Step 1: Add scope copy constants near the existing derived metrics**

Inside `AdminMetricsPage`, after `roomStatusSignals`, add:

```tsx
  const historicalScopeCopy =
    metrics.history.adapter === "postgres"
      ? "共享历史指标：打开、开局、完局和趋势会按同一个 PostgreSQL 指标库合计，可用于汇总 Render 和腾讯云的匿名使用情况。"
      : "本进程历史指标：当前未连接 PostgreSQL 指标库，统计只来自本服务进程，重启后内存统计会清空。";
  const liveScopeCopy =
    "本机实时状态：大厅、进行中、疑似流失和待清理房间来自当前服务实例，不代表腾讯云实时房间总量。";
```

- [ ] **Step 2: Update the header paragraph**

Replace the existing header paragraph text under `AI 狼人杀运营驾驶舱` with:

```tsx
              私有数据面板，统计主界面打开、主界面开局/完局、联机房间创建/加入/开局/完局、完局时长和开局后流失；不记录 IP。{historicalScopeCopy}
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#8f9a90]">{liveScopeCopy}</p>
```

The surrounding JSX should still have the original `<p className="mt-3 max-w-3xl text-sm leading-6 text-[#aeb8ad]">` opening tag.

- [ ] **Step 3: Rename live header stats**

Replace the four `MiniHeaderStat` labels in the `Live Snapshot` card with:

```tsx
              <MiniHeaderStat label="本机大厅" value={metrics.current.rooms.lobby} />
              <MiniHeaderStat label="本机进行中" value={metrics.current.rooms.activeInGame} />
              <MiniHeaderStat label="本机疑似流失" value={metrics.current.rooms.inactiveInGame} />
              <MiniHeaderStat label="本机待清理" value={metrics.current.rooms.finished} />
```

- [ ] **Step 4: Rename the live room panels**

Change:

```tsx
          <GlassPanel title="实时房间光谱" kicker="Room Spectrum">
```

to:

```tsx
          <GlassPanel title="本机实时房间光谱" kicker="Local Room Spectrum">
```

Change:

```tsx
          <GlassPanel title="房间状态和风险" kicker="Current Rooms">
```

to:

```tsx
          <GlassPanel title="本机房间状态和风险" kicker="Local Current Rooms">
```

- [ ] **Step 5: Add scope definitions**

At the start of the `<GlassPanel title="数据口径" kicker="Definitions">` definitions grid, before the existing `首页打开` definition, add:

```tsx
              <MetricDefinition label="共享历史指标" text={historicalScopeCopy} />
              <MetricDefinition label="本机实时状态" text={liveScopeCopy} />
```

- [ ] **Step 6: Run the focused test**

Run:

```powershell
npm run test -- src/app/admin/metrics/page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the dashboard test and copy change**

Run:

```powershell
git add src/app/admin/metrics/page.tsx src/app/admin/metrics/page.test.tsx
git commit -m "fix: clarify shared analytics dashboard scope"
```

---

### Task 3: Document Shared Analytics Configuration

**Files:**
- Modify: `.env.example`
- Modify: `docs/render-deploy.md`
- Modify: `docs/tencent-cloud-deploy.md`

- [ ] **Step 1: Add the analytics database variable to `.env.example`**

In `.env.example`, directly after `AI_WEREWOLF_ROOM_DATABASE_URL=""`, add:

```dotenv
# Optional dedicated analytics database. Set this when multiple deployments should send anonymous aggregate metrics to one owner dashboard.
# For the first shared-dashboard setup, Tencent Cloud can point this to the Render PostgreSQL external connection string.
AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL=""
```

- [ ] **Step 2: Add shared-dashboard docs to `docs/render-deploy.md`**

In `docs/render-deploy.md`, after the existing private metrics bullet list that ends with `They do not track raw IP addresses, browser fingerprints, or model/API keys.`, add:

```markdown
### Shared Render Analytics Dashboard

For the first two-server public Alpha, keep Render as the owner dashboard and use the Render PostgreSQL analytics table as the shared historical metrics store.

Configuration shape:

- Render continues to serve `/admin/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>`.
- Render writes analytics through its existing PostgreSQL-backed room analytics configuration.
- Tencent Cloud sets `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` to the Render PostgreSQL external connection string.
- The connection string is a secret environment variable and must not be committed or copied into public docs.

With this setup, historical counters such as homepage opens, starts, finishes, durations, completion rates, and recent-day trends can include events from both Render and Tencent Cloud. Current live room state remains local to the service instance serving the dashboard unless room state is also shared, so do not read the live room panels as cross-server totals.

If Render PostgreSQL external access is unavailable or unreliable from Tencent Cloud, use a neutral hosted PostgreSQL database for `AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL` on both servers instead.
```

- [ ] **Step 3: Add Tencent Cloud runbook docs**

In `docs/tencent-cloud-deploy.md`, directly after the `Minimum checklist after each public-facing update:` numbered list and before `## Safe Deploy Shape`, add:

````markdown
## Optional Shared Analytics

The public Alpha can report anonymous aggregate usage to the existing Render owner dashboard without sharing gameplay state.

When this is enabled, set this secret on the Tencent Cloud app environment:

```text
AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL=<Render PostgreSQL external connection string>
```

Keep the value out of source control, shell transcripts, screenshots, and chat summaries. Restart the app container after changing it. If the variable is absent or the database cannot be reached, analytics should fail softly and gameplay should continue.

The Render dashboard then shows shared historical usage totals. Its current live room panels remain local to the dashboard service instance, not a two-server live room total.
````

- [ ] **Step 4: Run doc whitespace checks**

Run:

```powershell
git diff --check -- .env.example docs/render-deploy.md docs/tencent-cloud-deploy.md
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit documentation**

Run:

```powershell
git add .env.example docs/render-deploy.md docs/tencent-cloud-deploy.md
git commit -m "docs: describe shared analytics setup"
```

---

### Task 4: Full Verification

**Files:**
- Read: `src/app/admin/metrics/page.tsx`
- Read: `src/app/admin/metrics/page.test.tsx`
- Read: `.env.example`
- Read: `docs/render-deploy.md`
- Read: `docs/tencent-cloud-deploy.md`

- [ ] **Step 1: Run the focused test set**

Run:

```powershell
npm run test -- src/app/admin/metrics/page.test.tsx src/app/api/rooms/api.test.ts src/app/api/games/api.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

Run:

```powershell
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: no lint errors.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: build succeeds. If the known Turbopack NFT trace warning appears for `next.config.ts -> roomService.ts -> /api/rooms/[roomId]/view/route.ts`, record it as an existing warning, not a failure.

- [ ] **Step 5: Confirm final git status**

Run:

```powershell
git status --short --branch
```

Expected: branch contains the new implementation commits. The pre-existing untracked `docs/promotion/captures/` directory may still appear and should remain untouched.

---

### Task 5: Deployment Handoff

**Files:**
- No source files changed in this task unless deployment notes are updated after real deployment.

- [ ] **Step 1: Push the current source branch**

Run:

```powershell
git push
```

Expected: the branch containing the dashboard and docs commits is pushed.

- [ ] **Step 2: Configure Tencent Cloud analytics secret**

On the Tencent Cloud host, set the app environment variable:

```text
AI_WEREWOLF_ROOM_ANALYTICS_DATABASE_URL=<Render PostgreSQL external connection string>
```

Do not print the real connection string in logs or summaries. Restart the app container after the secret is applied.

- [ ] **Step 3: Verify both public services still pass production checks**

Run locally:

```powershell
npm run preflight:production -- --base-url=https://ai-werewolf-free.onrender.com
$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run smoke:room-sse
npm run preflight:production -- --base-url=https://175.178.199.245
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
```

Expected: all checks pass.

- [ ] **Step 4: Verify shared historical metrics manually**

Open the private Render dashboard:

```text
https://ai-werewolf-free.onrender.com/admin/metrics?token=<AI_WEREWOLF_METRICS_TOKEN>
```

Trigger one homepage open or game start on Render, then one homepage open or game start on Tencent Cloud. Refresh the Render dashboard and confirm the relevant historical counters increase. Do not share the token or database URL in the final summary.

---

## Self-Review

- Spec coverage: Tasks cover the existing dashboard, shared Render PostgreSQL analytics configuration, Tencent Cloud environment setup, privacy boundaries, local-live room caveat, tests, docs, and deployment verification.
- Scope check: The plan does not introduce accounts, IP capture, public dashboards, individual timelines, detailed gameplay diagnostics, or cross-server live room federation.
- Type consistency: `RoomMetricsSnapshot`, `checkRoomMetricsAccess`, and `getRoomMetricsSnapshot` match existing exported names. The UI changes use existing `MetricDefinition`, `GlassPanel`, and `MiniHeaderStat` components.
- Secret safety: All database URL and token examples use placeholders only.
