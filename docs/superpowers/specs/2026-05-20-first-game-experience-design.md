# First-Game Experience Design

Date: 2026-05-20

## Goal

Improve the first playable loop for two audiences:

- New players should understand the current task and the consequence of each action during their first game.
- Experienced Werewolf players should find day-one AI speech, voting, and power-role behavior believable enough to keep playing.

This design does not make the homepage strongly recommend the 6-player beginner board. Board ordering and homepage promotion are out of scope for this pass.

## Evidence

A small current audit was run with:

```powershell
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/current-ux-audit-2026-05-20.json
```

Across 160 simulated games, there were 0 failed games, 0 blocking games, and 0 fallbacks. The main quality warnings were:

- `wolf_team_vote`: 239 warnings.
- `dead_seer_gold_pressure`: 235 warnings.
- `power_misfire_good`: 5 warnings.

The project is therefore not mainly blocked by basic playability. The highest-impact first pass is reducing confusion during human turns and reducing AI behavior that feels fake to experienced players.

## Scope

### 1. Current-Task Clarity

Update the in-game action and phase surfaces so the player can quickly answer:

- What is happening now?
- What can I do?
- What will happen after I click?
- Which information is private, public, or only available after the game?

Likely touch points:

- `src/components/game/ActionPanel.tsx`
- `src/components/game/GamePanels.tsx`
- `src/components/game/TablePanels.tsx`

The table layout should remain recognizable. This is a clarity pass on the action area, phase/status surfaces, and supporting text.

### 2. Day-One AI Table Feel

Improve mock/structured AI behavior for the most visible first-day problems:

- Wolves should not overuse teammate votes unless the reason looks like deliberate distancing.
- Dead seer gold-water targets should receive stronger protection from repeated public pressure.
- Strong actions such as knight duel should need clearer public evidence before firing.
- Repeated speech scaffolding should be reduced so different seats do not sound like the same template.

Likely touch points:

- `src/ai/**`
- `src/game/tableMemory.ts`
- `src/game/simulationStats.ts`
- `scripts/audit-ai-experience.mjs`

Rules engine changes are out of scope unless a verified rules bug is found while implementing the AI behavior.

### 3. Review Credibility

Improve the end-game review so experienced players can see why the game resolved the way it did:

- Identity claims and counterclaims.
- Check lines and gold-water / black-check consequences.
- Vote flow and exile outcomes.
- Strong-action result and whether it hit wolf or good.
- Win condition and decisive events.

Likely touch points:

- `src/components/game/ReviewPanel.tsx`
- `src/server/gameService.ts`
- Existing review/debug data in `HumanGameView`

This should expose already-available reasoning where possible before adding new persistence.

## Data Flow

The frontend remains driven by `HumanGameView`.

1. `gameService` creates, advances, and persists game state.
2. `buildHumanView` and review/debug construction project public/private/review data.
3. `GameClient` orchestrates requests and audio/auto-advance behavior.
4. `ActionPanel`, `HostStage`, `FlowStatusBar`, `AuxiliaryInfoPanel`, and `ReviewPanel` render the player-facing loop.
5. AI behavior changes should continue to emit decision logs and public fact basis so audit and review surfaces can explain the result.

## Error Handling

- Action copy must not hide backend failures. Existing error banners should remain visible.
- If AI speech audio or real-model calls degrade, the UI should still make the text path clear.
- Review enhancements should tolerate missing debug logs and fall back to existing public events.
- Audit-script additions should report warnings without making normal simulation runs fail.

## Validation

Use a focused validation stack:

```powershell
npx tsc --noEmit
npm run test -- src/game/engine.test.ts
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/first-game-experience-audit-after.json
```

For UI-visible changes, also run a browser playthrough:

- Start a local dev server or reuse an existing current checkout server.
- Create a game.
- Confirm the first human action is understandable without reading docs.
- Advance through day-one speech and vote.
- Finish or load a completed game and inspect the review panel.

## Out Of Scope

- Strong homepage recommendation for the 6-player beginner board.
- Public multiplayer operations, accounts, matchmaking, quotas, or deployment.
- A full redesign of the table layout.
- New roles or new board presets.
- Broad rules-engine rewrites unrelated to a verified bug.
