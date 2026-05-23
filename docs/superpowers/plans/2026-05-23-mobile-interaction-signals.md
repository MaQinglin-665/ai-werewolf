# Mobile Interaction Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve mobile-only action confirmation, drawer activity signals, and speech seat filtering without changing game rules or desktop UI.

**Architecture:** Keep behavior local to the existing mobile table components. Add small derivation helpers in `mobileTableModel.ts`, render richer attributes/classes in `MobileInfoDrawer.tsx` and `MobileSeatStage.tsx`, and polish only mobile CSS in `src/app/globals.css`.

**Tech Stack:** Next.js React components, TypeScript, Vitest static rendering tests, mobile CSS media rules.

---

## File Map

- Modify `src/components/game/mobileTableModel.ts`: add drawer activity label kind and unseen count helpers.
- Modify `src/components/game/MobileInfoDrawer.tsx`: render drawer activity classes, recommended label, unread count, and stronger speech-filter markup.
- Modify `src/components/game/MobileSeatStage.tsx`: render action feedback state text/classes and keep selected target semantics stable.
- Modify `src/app/globals.css`: mobile-only visual polish for selected seats, feedback strip, drawer dock, and speech filter chip.
- Modify `src/components/game/mobileTableModel.test.ts`: red-green tests for drawer activity and unseen count derivation.
- Modify `src/components/game/mobileGameTable.test.ts`: static render coverage for drawer signal markup and mobile filter/feedback classes.

## Task 1: Drawer Signal Derivation

**Files:**
- Modify: `src/components/game/mobileTableModel.ts`
- Test: `src/components/game/mobileTableModel.test.ts`

- [ ] **Step 1: Add failing tests for drawer signals**

Add tests near `getMobileDrawerSnapshot` / `MOBILE_INFO_TABS`:

```ts
expect(getMobileDrawerActivityMeta("speech", snapshot, seen)).toEqual({
  kind: "speaker",
  label: "4号 GPT",
  unreadCount: 1,
});
expect(getMobileDrawerActivityMeta("vote", snapshot, seen)).toEqual({
  kind: "count",
  label: "1",
  unreadCount: 1,
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts
```

Expected: fails because `getMobileDrawerActivityMeta` does not exist.

- [ ] **Step 3: Implement helper**

Add:

```ts
export type MobileDrawerActivityMeta = {
  kind: "none" | "role" | "speaker" | "count";
  label?: string;
  unreadCount: number;
};

export function getMobileDrawerActivityMeta(
  tab: MobileInfoTabKey,
  snapshot: MobileDrawerSnapshot,
  seen: MobileDrawerSeenState,
  roleLabel?: string,
): MobileDrawerActivityMeta {
  if (tab === "identity") return { kind: roleLabel ? "role" : "none", label: roleLabel, unreadCount: 0 };
  if (tab === "speech") {
    const unreadCount = snapshot.latestSpeechSeq > seen.latestSpeechSeq ? 1 : 0;
    return { kind: snapshot.latestSpeechLabel ? "speaker" : "none", label: snapshot.latestSpeechLabel, unreadCount };
  }
  if (tab === "vote") {
    const unreadCount = snapshot.voteMarker > seen.voteMarker ? snapshot.voteMarker - seen.voteMarker : 0;
    return { kind: snapshot.voteMarker > 0 ? "count" : "none", label: snapshot.voteMarker > 0 ? `${snapshot.voteMarker}` : undefined, unreadCount };
  }
  const unreadCount = snapshot.logMarker > seen.logMarker ? 1 : 0;
  return { kind: snapshot.logMarker > 0 ? "count" : "none", label: snapshot.logMarker > 0 ? `${snapshot.logMarker}` : undefined, unreadCount };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts
```

Expected: all tests pass.

## Task 2: Drawer Dock Markup

**Files:**
- Modify: `src/components/game/MobileInfoDrawer.tsx`
- Test: `src/components/game/mobileGameTable.test.ts`

- [ ] **Step 1: Add failing static-render expectations**

Add expectations that rendered tabs include:

```ts
expect(html).toContain("mobile-drawer-tab-has-activity");
expect(html).toContain("mobile-drawer-tab-unread");
expect(html).toContain("mobile-drawer-tab-recommendation");
expect(html).toContain('aria-label="打开票型，有新内容，当前阶段推荐"');
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: fails because the new classes/ARIA text are missing.

- [ ] **Step 3: Render richer tab state**

Update `MobileDrawerTabView` to include `activityKind`, `unreadCount`, and `ariaLabel`. Use `getMobileDrawerActivityMeta` in `buildMobileDrawerTabs`. Add tab classes:

```ts
tab.meta ? "mobile-drawer-tab-has-activity" : ""
tab.hasDot ? "mobile-drawer-tab-unread" : ""
tab.recommended ? "mobile-drawer-tab-recommended" : ""
```

Render a hidden/compact recommendation marker:

```tsx
{tab.recommended && <span className="mobile-drawer-tab-recommendation">推荐</span>}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: all tests pass.

## Task 3: Action Feedback Markup

**Files:**
- Modify: `src/components/game/MobileSeatStage.tsx`
- Test: `src/components/game/mobileGameTable.test.ts`

- [ ] **Step 1: Add failing static-render expectations**

Render with `loading=true` and `pendingCommandType="wolfKill"` so an active feedback strip can be present after implementation through component state is not directly testable. For static testable pieces, assert the component emits stable classes for actionable targets:

```ts
expect(html).toContain("mobile-seat-action-feedback-source");
expect(html).toContain("mobile-seat-action-label");
expect(html).toContain("mobile-seat-token-action-ready");
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: fails because `mobile-seat-action-label` / `mobile-seat-token-action-ready` are missing.

- [ ] **Step 3: Implement markup**

Add action-ready class on seats with target actions and wrap visible action labels:

```tsx
primarySeatAction ? "mobile-seat-token-action-ready" : ""
<span className="mobile-seat-action-badge mobile-seat-action-label">{primarySeatAction.label}</span>
```

Keep the existing payload submission unchanged.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: all tests pass.

## Task 4: Speech Filter Markup

**Files:**
- Modify: `src/components/game/MobileInfoDrawer.tsx`
- Test: `src/components/game/mobileGameTable.test.ts`

- [ ] **Step 1: Add failing expectations for filter chip hierarchy**

Render a game with a selected speech filter path where possible; if static state cannot open the drawer, cover the drawer component by exporting a focused test helper or by asserting existing drawer markup through static component render. Expected markup:

```ts
expect(html).toContain("mobile-speech-filter-chip-active");
expect(html).toContain("mobile-speech-filter-seat");
expect(html).toContain("mobile-speech-filter-clear");
expect(html).toContain("该玩家暂无最近发言");
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: fails because active filter classes are missing.

- [ ] **Step 3: Implement markup**

Update filter chip:

```tsx
<div className="mobile-speech-filter-chip mobile-speech-filter-chip-active">
  <span className="mobile-speech-filter-seat">...</span>
  <button className="mobile-speech-filter-clear">全部发言</button>
</div>
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm run test -- src/components/game/mobileGameTable.test.ts
```

Expected: all tests pass.

## Task 5: Mobile CSS Polish

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update CSS**

Polish only existing mobile selectors:

```css
.mobile-seat-token-action-ready .mobile-seat-card-art { box-shadow: ...; }
.mobile-seat-token-selected .mobile-seat-card-art { animation: mobile-seat-selected-pulse ...; }
.mobile-drawer-tab-unread .mobile-drawer-tab-dot { ... }
.mobile-drawer-tab-recommendation { ... }
.mobile-speech-filter-chip-active { ... }
```

- [ ] **Step 2: Verify CSS selectors exist**

Run:

```powershell
rg -n "mobile-seat-token-action-ready|mobile-drawer-tab-recommendation|mobile-speech-filter-chip-active" src/app/globals.css
```

Expected: all selectors are found.

## Task 6: Final Verification And Browser Check

**Files:**
- No new source files expected.

- [ ] **Step 1: Run focused tests**

```powershell
npm run test -- src/components/game/mobileTableModel.test.ts src/components/game/mobileGameTable.test.ts
```

- [ ] **Step 2: Run broader checks**

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 3: Run mobile browser verification**

Open a local production or dev server, use a phone viewport, and verify:

- tapping an actionable avatar gives visible confirmation;
- drawer tabs show recommendation and unread state;
- tapping a non-action seat opens speech drawer with filter chip;
- text does not overlap on a narrow phone viewport.

- [ ] **Step 4: Commit**

```powershell
git add src/components/game/mobileTableModel.ts src/components/game/MobileInfoDrawer.tsx src/components/game/MobileSeatStage.tsx src/components/game/mobileTableModel.test.ts src/components/game/mobileGameTable.test.ts src/app/globals.css
git commit -m "feat: polish mobile interaction signals"
```
