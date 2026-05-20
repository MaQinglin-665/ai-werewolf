# Wolf Day Vote Discipline Design

Date: 2026-05-20

## Goal

Make wolf day voting feel coordinated and intentional after the first-night wolf strategy note.

This pass should reduce meaningless wolf-on-wolf votes while keeping advanced wolf tactics such as planned distancing, counterclaim pressure, and public-safe teammate sacrifice.

## Context

The third-round work added `WolfTeamPlan.nightStrategy` and exposed the private plan to wolf AI and human wolf seats only.

The latest audit still reports `wolf_team_vote` as the largest warning group:

- 160 simulated games
- 0 failed games
- 0 fallback decisions
- 55 `wolf_team_vote` warnings

Not every wolf vote on a teammate is bad. In high-level Werewolf, a wolf may distance from a teammate when that teammate is publicly compromised. The current problem is that audit and vote planning do not clearly separate:

- planned public-safe distancing
- emergency sacrifice under hard public pressure
- accidental or low-value teammate votes

## Player Experience

From the player perspective, wolf teams should feel like they have a shared daytime plan:

- one wolf can visibly push the agreed day target
- one wolf can stay hidden and avoid over-coordinated voting
- one wolf can distance only when the table already has public reasons
- public vote reasons should sound like normal table logic, not private wolf coordination

The result should be fewer moments where wolves appear to randomly vote teammates for no believable reason.

## Scope

### 1. Wolf Vote Discipline Layer

Keep `createVotePlan(view, tableRead)` as the main vote-planning entry point.

Add a small internal discipline layer for wolf votes:

- `PUSH_MISLYNCH`: prefer `WolfTeamPlan` target when legal and public-safe.
- `HIDE`: prefer non-teammate public targets; do not teammate-vote unless there is hard public evidence.
- `DISTANCE`: may vote a teammate only when assigned to distance and the target has hard public pressure.
- `COUNTERCLAIM_SEER`: vote should align with the counterclaim story instead of casually cutting a teammate.

The layer should not expose private role or teammate information in `VotePlan.reason`.

### 2. Public Evidence Gate For Teammate Votes

Define a public evidence gate for wolf-on-wolf votes.

A teammate vote is allowed only when at least one strong public reason exists:

- teammate is in a public role counterclaim group
- teammate has a public black check or dead-seer legacy pressure
- teammate has multiple public pressure or question stances
- teammate is already a top vote leader or tied vote focus
- teammate is the assigned distance support seat and the acting wolf is `DISTANCE`

Single weak pressure, short speech, or private wolf-team knowledge should not be enough.

### 3. Planned Distance Metadata

Add enough internal metadata for audits to tell planned distancing apart from accidental teammate votes.

Preferred shape:

- extend `VotePlan` with optional `wolfVoteTactic`
- values: `team_target`, `planned_distance`, `emergency_cut`, `avoid_teammate`
- keep this field internal to AI logs and audit output; do not show it in public UI or vote reasons

If adding a field creates too much type churn, an equivalent audit-only helper can classify the vote from `AgentView`, `VotePlan`, and public table memory. The important requirement is that audit can distinguish planned distance from suspicious accidental teammate votes.

### 4. Audit Refinement

Update `scripts/audit-ai-experience.mjs` so `wolf_team_vote` remains useful.

When a wolf votes a teammate:

- if `wolfVoteTactic` is `planned_distance` or `emergency_cut`, record it as a lower-severity note or exclude it from the warning count
- otherwise keep `wolf_team_vote` as a warning
- include examples of remaining warnings so future rounds can target real bad behavior

Do not remove the audit check entirely.

## Data Flow

1. `buildWolfTeamPlan(state)` assigns wolf tasks and strategy targets.
2. `buildAgentView(state, seatId)` exposes that plan only to wolf seats.
3. `buildAiTableRead(view)` marks teammate seats privately for wolf AI.
4. `createVotePlan(view, tableRead)` evaluates legal public vote candidates.
5. The wolf vote discipline layer chooses between team target, planned distance, emergency cut, or ordinary public focus.
6. `createMockCommand` and LLM action providers consume `VotePlan` as they do today.
7. Audit reads AI logs and classifies teammate votes using the new tactic metadata or helper.

Good-side views and public contexts must not include `wolfVoteTactic`, teammate labels, `WolfTeamPlan`, or private strategy text.

## Error Handling

- If the assigned team target is no longer legal, fall back to existing ranked public candidates.
- If all non-teammate targets are protected or unavailable, abstain when allowed or use the safest public reason fallback.
- If public evidence for teammate distancing is weak, prefer a non-teammate target even for `DISTANCE`.
- If audit cannot classify a teammate vote, keep it as a warning rather than silently accepting it.

## Testing

Add focused tests before implementation:

- `PUSH_MISLYNCH` wolf votes the assigned non-teammate day target when legal.
- `HIDE` wolf does not vote a teammate with only weak public pressure.
- `DISTANCE` wolf can vote the assigned teammate only under hard public pressure.
- teammate vote reasons do not contain `队友`, `狼队`, `WEREWOLF`, `private`, or strategy terms.
- good-side vote plans and LLM inputs do not include wolf tactic metadata.
- audit classifies planned distancing separately from suspicious teammate votes.

Validation commands:

```powershell
npm run test -- src/ai/tableRead.test.ts src/ai/wolfVoting.test.ts src/game/engine.test.ts
npm run test -- src/ai/actionProviders.test.ts
npx tsc --noEmit
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/wolf-day-vote-discipline-audit.json
```

Expected audit direction:

- `fallbackCount` remains 0.
- `wolf_team_vote` warning count should drop or become more meaningful.
- Any remaining `wolf_team_vote` examples should be cases without strong public evidence or without a planned distance tactic.

## Out Of Scope

- Full private wolf chat.
- New UI for day tactics.
- Changing core rules, vote resolution, or board presets.
- Removing all wolf-on-wolf votes.
- Solving `dead_seer_gold_pressure` and `seer_gold_vote_target` in the same pass.
- Changing public event payloads or revealing wolf tactics to players.

## Spec Self-Review

- Placeholder scan: no TBD or open implementation blanks.
- Internal consistency: vote discipline builds on `WolfTeamPlan` and remains private.
- Scope check: focused on AI vote planning and audit classification only.
- Ambiguity check: planned distance requires hard public evidence; weak single pressure is explicitly insufficient.
