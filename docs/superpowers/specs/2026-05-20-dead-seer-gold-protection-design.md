# Dead Seer Gold Protection Design

Date: 2026-05-20

## Goal

Make AI players respect a night-dead seer claimant's public gold-water legacy more consistently in speech and voting.

This pass targets the current top audit issues after the wolf day vote discipline work:

- 160 simulated games
- 0 failed games
- 0 fallback decisions
- 42 `dead_seer_gold_pressure` warnings
- 24 `seer_gold_vote_target` warnings

The player-facing problem is that AI sometimes keeps treating a publicly reported dead-seer gold-water target as a normal focus. That makes the table feel as if it forgot a core Werewolf convention.

## Current Context

Existing code already has partial protection:

- `src/ai/tableRead.ts` lowers suspicion for dead-seer gold checks.
- `createVotePlan` filters protected public gold targets in several paths.
- `src/ai/speechProviders.ts` has fallback speech cleanup for public gold references.
- `scripts/audit-ai-experience.mjs` keeps separate warnings for speech pressure and vote targets.

The remaining warnings mean the protection is not yet applied uniformly. The likely leaks are:

- speech target selection still picks the gold target as a focus before final text cleanup
- public pressure phrases against the gold target still survive when framed as "focus" or "explain"
- action candidate ordering can still surface protected gold-water targets in LLM inputs
- hard counter-evidence is not clearly separated from weak single-pressure noise

## User Experience

After this pass, a player should see AI treat the dead seer's gold-water target as a protected public legacy:

- good-side AI should not casually push or vote that player
- wolf AI should not park weak pressure on that player unless there is strong public counter-evidence
- speech should mention the gold target as protected, not as today's main suspect
- if the table later challenges that target, AI should explain the public reason and call it a verification point instead of acting as if the protection never existed

The system must not convert a dead seer's public legacy into confirmed hidden truth. It is still public evidence, not engine-revealed role information.

## Approaches Considered

### A. Vote-Only Patch

Only increase the vote penalty in `createVotePlan`.

This is too narrow. It may reduce `seer_gold_vote_target`, but `dead_seer_gold_pressure` can remain high because speeches still push the same seat.

### B. Shared Protection Rule Across Vote And Speech

Create a small shared concept of protected dead-seer gold targets and use it in vote planning, action candidates, and speech target selection.

This is the recommended approach. It matches how players experience the issue: not only who gets voted, but also who keeps getting named as a suspect.

### C. Audit Suppression

Change audit rules to stop reporting some gold-water pressure.

This would hide the symptom without improving play. Audit should remain strict unless the speech is clearly protective.

## Recommended Design

Use approach B.

### 1. Protected Dead-Seer Gold Helper

Add or consolidate helper logic around:

- `findDeadSeerLegacyGoldCheckFor(tableRead, target)`
- `isProtectedDeadSeerLegacyGoldTarget(tableRead, target)`
- `hasOverridingEvidenceAgainstDeadSeerGold(tableRead, target)`

The helper should answer two questions:

1. Is this seat protected by a night-dead seer claimant's public GOOD check?
2. Is there enough public counter-evidence to override that protection?

Protected means:

- the table memory has a seer legacy
- the legacy includes a GOOD check on the target
- the target is alive and legal for the current action
- no hard override is present

Hard override means at least one high-quality public evidence loop exists:

- multiple independent public black checks against the target
- a counterclaim group plus repeated public pressure
- a dead-seer black legacy from a separate seer claimant
- a vote-leader/tie loop plus another hard public cue

Not enough:

- one weak question stance
- short speech
- "public focus" only
- a single reactive black check after the gold claim
- private wolf knowledge

### 2. Vote Planning

For good-side vote plans:

- remove protected dead-seer gold targets from `candidatePool` when alternatives exist
- keep them out of `alternatives`
- if only protected targets remain and abstain is legal, abstain with a protective reason
- if abstain is not legal, use the existing no-safe-vote reason instead of a pressure reason

For wolf vote plans:

- keep the fourth-round wolf discipline layer
- forbid weak parking votes on dead-seer gold targets
- allow votes only with hard override evidence
- keep vote reasons public-safe and framed around public contradictions

### 3. Action Candidate Inputs

The constrained LLM action input should not put protected dead-seer gold targets near the front of vote candidates.

If the target is present only because every legal vote target is protected, its `reasonHint` should say the vote is low-confidence or no-safe-vote, not "public suspicion."

Good-side LLM inputs must not include hidden role truth. They can include the public legacy as a public claim audit item.

### 4. Speech Planning And Fallback Speech

Speech target selection should avoid turning protected dead-seer gold targets into the next pressure target.

Expected behavior:

- if a protected gold target appears in table focus, choose the next non-protected focus where possible
- if speech must mention the gold target, use protective language
- fallback mock speech cleanup should protect both living unchallenged seer gold and night-dead seer gold
- LLM speech constraints should tell the model to treat night-dead seer gold as protected public legacy unless hard override evidence exists

Protective language examples:

- "that seat is dead-seer gold, do not rush the vote there"
- "keep that gold-water position protected unless a harder public contradiction appears"
- "today's pressure should move outside the protected gold-water slot"

Pressure language to avoid:

- "make them explain"
- "put them into the focus"
- "collect votes there"
- "they need to give a vote target" when the sentence context is negative pressure

### 5. Audit Remains Strict

Keep `dead_seer_gold_pressure` and `seer_gold_vote_target`.

Do not suppress warnings unless the output is clearly protective under the existing audit helper style. The implementation should improve behavior enough that the warning count drops naturally.

The audit output should remain useful for the next round. If warnings remain, sampled examples should identify true gaps rather than intentional protective references.

## Data Flow

1. `buildTableMemory(state)` records seer legacies after a seer claimant dies.
2. `buildAiTableRead(view)` converts that memory into per-seat trust, suspicion, and pressure notes.
3. Vote planning filters protected dead-seer gold targets before ranking.
4. Action candidate generation orders vote candidates from the cleaned vote plan.
5. Speech planning avoids protected gold targets when choosing pressure targets.
6. Fallback speech cleanup rewrites accidental pressure on protected gold targets.
7. Audit checks final AI logs and counts any remaining pressure or vote leaks.

## Error Handling

- If all legal targets are protected, prefer abstain when legal.
- If abstain is not legal, use a no-safe-vote reason and low confidence.
- If hard override evidence exists, allow targeting but require the reason to mention the public contradiction.
- If helper classification is uncertain, treat the target as protected.
- If audit examples show protective text being flagged, refine audit protective-language detection only for clearly protective phrases.

## Testing

Add or strengthen tests before implementation:

- `createVotePlan` keeps dead-seer gold out of `target` and `alternatives`.
- `createVotePlan` abstains or uses a no-safe-vote reason when only protected gold targets are legal.
- wolf vote planning cannot weakly park a vote on protected dead-seer gold.
- hard override evidence can target protected gold with a public contradiction reason.
- `buildConstrainedActionInput` does not rank protected dead-seer gold as the first ordinary vote candidate.
- `createSpeechPlan` does not choose protected dead-seer gold as pressure target when alternatives exist.
- fallback/mock speech does not pressure a protected dead-seer gold target.
- audit on 160 games reduces `dead_seer_gold_pressure` and `seer_gold_vote_target` without increasing fallback or blocking issues.

Validation commands:

```powershell
npm run test -- src/ai/tableRead.test.ts src/game/seerCheckStructureVoting.test.ts src/ai/actionProviders.test.ts src/ai/speechProviders.test.ts
npm run test -- src/game/engine.test.ts
npx tsc --noEmit
npm run audit:ai -- --games=20 --sample=1 --json --out=tmp/dead-seer-gold-protection-audit.json
npm run lint
npm run test
```

Expected audit direction:

- `fallbackCount` remains 0.
- `failedGames` remains 0.
- `seer_gold_vote_target` should drop materially.
- `dead_seer_gold_pressure` should drop materially.
- Any remaining examples should involve hard counter-evidence, ambiguous protective wording, or true gaps to handle in a later pass.

## Out Of Scope

- Changing hidden role truth or revealing the true seer.
- Making all seer gold checks permanently untouchable.
- Reworking the full claim system.
- UI changes.
- New roles or board presets.
- Solving all seer counterclaim strategy issues in this pass.

## Spec Self-Review

- Placeholder scan: no placeholders or open implementation blanks.
- Internal consistency: the design treats dead-seer gold as public legacy, not confirmed truth.
- Scope check: the work is focused on AI speech, AI action planning, and audit verification.
- Ambiguity check: weak pressure is explicitly insufficient; hard override evidence is explicitly required.
