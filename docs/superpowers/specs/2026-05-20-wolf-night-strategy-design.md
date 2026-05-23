# Wolf Night Strategy Design

Date: 2026-05-20

## Goal

Add a first-night private wolf-team strategy note so wolf players and wolf AI feel coordinated from the start of the game.

This pass implements a compact tactical summary, not full chat. The design keeps an upgrade path for later replacing the summary source with complete wolf-team night chat.

## Player Experience

When the human player is on the wolf team, the first night should show a private wolf-team plan near the wolf action surface:

- tonight's preferred kill target and the public-safe reason
- tomorrow's likely pressure target
- each wolf's task: counterclaim, push, distance, or hide
- a short team summary in natural Chinese

When the human player is not on the wolf team, none of this plan should be visible in the game view, public events, table memory, review public reasoning, or model input for good-side seats.

The note should feel like the wolves had a short pre-game huddle. It should not expose hidden roles beyond what wolves legally know.

## Scope

### 1. Private Strategy Model

Extend the existing `WolfTeamPlan` structure rather than creating a separate strategy system.

The plan should gain a first-night tactical note with fields such as:

- `nightTarget`: selected kill target
- `dayPressureTarget`: planned day-one pressure target
- `summary`: one or two sentences for UI and AI use
- `discussion`: short private lines that read like a tactical meeting summary
- `assignments`: existing per-wolf tasks remain the main execution contract

The note may be computed from current game state on projection. It does not need database persistence in this pass because the game engine already records the actual night kill and AI decisions. If later full chat is added, chat messages can be persisted as private events and summarized back into the same strategy shape.

### 2. AI Behavior Use

Wolf AI should use the strategy note to make day-one behavior more coherent:

- wolves should avoid all independently choosing unrelated public targets
- only the wolf assigned to push should strongly pressure the day target
- the distance wolf may question a teammate only when the plan says to distance
- the hidden wolf should prefer cautious closed-eye-good language
- fake seer or counterclaim behavior should align with the assigned counterclaim wolf

The plan should influence mock AI and LLM candidate context. Public reasons must remain public-safe and must not mention "wolf team", "teammate", hidden roles, or the private plan.

### 3. Private UI Surface

Add a small private wolf strategy panel in the game action area or adjacent private-info area.

Display only for wolf-team human seats:

- title such as `狼队首夜战术`
- kill target
- day pressure direction
- assignment chips or short rows for each wolf
- the summary line

Do not build full chat UI in this pass. The panel should be compact enough to fit the current game layout without redesigning the table.

### 4. Future Chat Upgrade Path

The full-chat version can later add:

- private wolf chat messages during `NIGHT_WOLVES`
- per-wolf AI generated chat lines
- a "summarize chat into WolfTeamPlan" step
- optional human wolf input before confirming the kill

This pass should leave room for that by treating the tactical note as the consumed plan, not as the only possible source of wolf strategy.

## Data Flow

1. `buildWolfTeamPlan(state)` computes a private wolf strategy from live wolves, current day, public table memory, and wolf-known teammate information.
2. `buildAgentView(state, seatId)` attaches the plan only for wolf-team seats in `privateKnowledge.wolfTeamPlan`.
3. Mock AI and routed LLM action/speech inputs use `wolfTeamPlan` for wolf seats only.
4. `buildHumanView(state, seatId)` or the existing projected game view exposes a sanitized private wolf plan only when the human seat is a wolf.
5. UI renders the private panel from the human-visible private strategy data.

Good-side views and public summaries must not include wolf assignments, strategy text, or private discussion lines.

## Error Handling

- If no wolf team plan can be computed, the UI should hide the panel instead of showing empty scaffolding.
- If the kill target is no longer legal, AI should fall back to the existing kill target ranking.
- If the game has a one-wolf board, the summary should read as solo wolf planning rather than team chat.
- If later LLM strategy generation fails, this pass should still use deterministic local strategy.

## Testing

Add focused tests before implementation:

- wolf `AgentView` includes the first-night strategy note; good `AgentView` does not
- human wolf view can see the private wolf strategy; human good view cannot
- public table memory and good-side model inputs do not contain wolf strategy text
- mock wolf day vote/speech follows the assigned day pressure or hide task
- action LLM input includes strategy context only for wolf seats
- existing engine tests still pass

Validation commands:

```powershell
npm run test -- src/game/engine.test.ts
npm run test -- src/ai/tableRead.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
npx tsc --noEmit
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/wolf-night-strategy-audit.json
```

For UI-visible work, also run a browser check on a wolf-seat game when feasible and confirm that:

- wolf human sees the strategy panel during night one
- good human does not see it
- no public event reveals the plan

## Out Of Scope

- Full wolf chat transcript UI.
- Human-authored wolf chat input.
- Database persistence for private wolf chat messages.
- Multiplayer room chat.
- Changing core Werewolf rules, board presets, or win conditions.
- Tuning all remaining `wolf_team_vote` audit warnings in one pass.
