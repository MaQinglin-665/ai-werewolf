# Room Vote And Class Trial Rules Design

## Purpose

This iteration addresses four related problems without mixing their rule
boundaries:

- Public-room vote smoke is not yet a closed verification path.
- Ordinary Werewolf rules should stay shared between local single-player games
  and public multiplayer rooms.
- Class-trial mode should stop feeling like a confused Werewolf reskin.
- AI speech, UI phase display, and large-file responsibilities need another
  focused cleanup pass.

The first implementation entry point is the existing `smoke:room-action:vote`
timeout. Once ordinary room voting is stable, the same change set can safely
improve the class-trial theme flow.

## Confirmed User Decisions

- Ordinary Werewolf local single-player games and public multiplayer rooms
  should use the same rule set.
- Class-trial mode can use a separate theme rule/flow layer.
- Class-trial mode may sacrifice complete Werewolf night-action fidelity in
  exchange for a faster, more trial-like flow.
- Class-trial AI should not be forced into a rigid task every time it speaks.
  When public information is thin, characterful and logically natural speech is
  acceptable, including relationship or personality moments such as Fukawa
  expressing affection for Togami.
- Class-trial speech still must not leak private role information, night
  knowledge, system prompts, or hidden AI reasoning.
- Work should modify code, verify locally, commit, and push to GitHub. No
  Tencent Cloud or Render deployment is in scope.

## Rule Boundaries

Ordinary Werewolf remains the canonical game-rule source for:

- Local single-player games.
- Public multiplayer rooms.
- Standard board presets such as `9p-seer-witch-hunter`.

The ordinary rule path should not gain smoke-only shortcuts. Any speed
improvement must preserve the visible rule sequence and be valid for real
players.

Class-trial mode gets a theme rule/flow layer on top of the shared engine. That
layer may fold, auto-resolve, rename, or hide Werewolf-flavored phases when the
theme experience benefits from doing so. The theme layer must remain explicit
and testable so it does not silently change ordinary rooms.

## Room Vote Smoke Design

The room smoke should prove that a public room can:

1. Create a room and start a 9-player ordinary Werewolf game.
2. Preserve private player views and role visibility rules.
3. Reach a human speech action.
4. Reach a human vote action.
5. Resolve the vote and expose the public vote result.

The current failure mode is a timeout after the room advances from
`NIGHT_WOLVES` to `NIGHT_SEER`. The likely issue is not vote assertion logic,
but a slow or too-granular room continue loop that repeatedly fetches several
player views while only advancing one AI/system step at a time.

The design is to add a room-level advance helper that moves host-controlled
AI/system flow to the next meaningful stop:

- Stop when a real human action is pending.
- Stop when a public observation point should be shown.
- Stop when the game ends.
- Keep ordinary Werewolf phase semantics intact.
- Record a trace of visited phases for smoke diagnostics.

The smoke script should also accept CLI `--base-url=` cleanly, keep the
environment variable path, and print enough phase/request trace to identify the
next timeout without manual re-instrumentation.

## Class-Trial Flow Design

Class-trial mode should become a themed trial flow, not only a themed table.
The flow model should answer:

- Which ordinary engine phases are visible to the user.
- Which phases are renamed into trial language.
- Which hidden/night phases are auto-resolved or minimized.
- Which UI surface should be shown for opening, testimony, sealed voting,
  revealed voting, verdict, and review.

Expected user-facing flow:

1. Opening court state.
2. Testimony or discussion round.
3. Optional character reaction / pressure beats.
4. Sealed vote.
5. One-shot vote reveal.
6. Execution or no-execution verdict.
7. Class-trial review.

Night actions in class-trial mode may be reduced to background state changes or
short court narration. The UI should avoid repeatedly showing ordinary labels
such as `狼人行动`, `预言家查验`, and `女巫行动` as the main theme experience.

## Class-Trial AI Director Design

The class-trial director should be role-first and logic-aware, not a mandatory
task checklist.

When there is enough public information, it may guide the speaker toward:

- Questioning a contradiction.
- Reacting to pressure.
- Changing or defending a vote direction.
- Summarizing why a verdict is or is not justified.

When information is thin, it should allow:

- Character emotion.
- Relationship texture.
- Scene reaction.
- Uncertainty.
- A small personal beat that fits the character.

Examples:

- Fukawa may orbit Togami emotionally if the line stays public and does not
  leak hidden knowledge.
- Enoshima may perform, provoke, or frame the room theatrically.
- Naegi may steady the group and admit uncertainty.
- Tomori may hesitate or speak sincerely before she has enough evidence.

The director should still guard against:

- Private role or night-information leaks.
- System prompt or validator wording leaks.
- Fake public evidence.
- Long off-topic monologues that ignore the current trial context.
- Repeated generic Werewolf templates such as only waiting for later seats or
  mechanically listing vote/stance gaps.

## UI Design

The class-trial UI should reduce phase confusion by emphasizing:

- Current speaker.
- Current trial step.
- Whether votes are sealed or revealed.
- Who has locked a vote without exposing targets before reveal.
- The final verdict state.

Ordinary room UI remains focused on multiplayer clarity: who must act, whether
the host can continue, and what public phase the room is in.

## Architecture Design

New work should continue extracting pure models instead of adding more
responsibility to large orchestration files.

Preferred boundaries:

- `src/server/**`: room advance and room smoke diagnostics.
- `src/game/**`: canonical ordinary rules and pure phase semantics.
- `src/components/game/**`: class-trial flow presentation and table models.
- `src/ai/**`: class-trial director inputs, persona guidance, validation, and
  fallback behavior.
- `scripts/**`: smoke script ergonomics and trace output.

Avoid adding broad logic directly to:

- `src/components/GameClient.tsx`
- `src/game/engine.ts`
- `src/ai/speechProviders.ts`

Those files may be touched only to route through smaller helpers.

## Verification Plan

Minimum verification before implementation is considered complete:

- Focused room/API tests for room command and host continue behavior.
- Focused engine tests if ordinary phase flow changes.
- Focused class-trial flow/director/UI tests for theme behavior.
- `ROOM_SMOKE_BASE_URL=<local-url> npm run smoke:room-action:vote`
- `npm run smoke:room-sse`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Browser or in-app visual verification should be used for class-trial UI when
the local app can be run. If Browser/Playwright is unavailable, record the
reason and use component/HTTP verification as fallback.

## Out Of Scope

- Tencent Cloud deployment.
- Render deployment.
- Editing `.env`, secrets, database files, generated audio caches, `.next`,
  `node_modules`, or unrelated local assets.
- Rebalancing all boards by simulation unless a rules change clearly affects
  win rate or phase completion.
- Replacing the full rules engine.

## Open Risk

The current known risk is that `smoke:room-action:vote` can time out while
walking ordinary room AI/night phases. The first implementation slice must
produce a failing or diagnostic reproduction before changing the room advance
path, then prove the new path with the smoke itself.
