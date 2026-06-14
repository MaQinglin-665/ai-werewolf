# 12p DeepSeek D3 Proof After Structural Attribution Fix

Date: 2026-06-14

Scope: one same-seed 12-player bounded D3 proof after switching the temporary
provider to DeepSeek. The run was used as hard-gate evidence for structured
public Seer-check attribution, not as a subjective style pass.

## Evidence

- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-preflight-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-preflight-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-report.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-cases.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-eval.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-hardscan.json`
- `tmp/12p-deepseek-chat-cross-seer-attribution-d3-after-fragmentguard-status.json`

## Run Result

- Preflight: 1 action call, fallback 0, error 0, validationFailure 0.
- Full run: completed 1/1 game, 85 calls, 30 speech, 55 action.
- Final state: day 3 `GAME_OVER`, stopReason `game_finished`.
- Provider/fallback: fallback 3, error 3, validationFailure 0.
- Local eval: 80 cases, averageScore 98.6, issueCount 6,
  highRiskCaseIds empty.
- Hard scan:
  - private leak hits: 0
  - accepted fragment hard-shape hits: 0
  - malformed output fragment issues: 0
  - non-Seer claimBoard checks: 0
  - claimed-Seer same-target contradictions: 0

## Readback

The old hard gates stayed clean in this DeepSeek-chat run. The latest exported
claim board kept non-Seer claims empty and did not contain same-target
contradictions:

- 2号 Claude claimed Seer with 9号 DeepSeek2 `WEREWOLF` and 8号 Kimi
  `WEREWOLF`.
- 5号 Mimo claimed Hunter with no checks.
- 8号 Kimi claimed Seer with 2号 Claude `WEREWOLF`.
- 10号 Claude2 claimed Witch with no checks.
- 11号 GPT2 claimed Seer with no checks.

The run did not reproduce the original dead-Seer old-check quote trigger:
`hasD3WolfFakeSeerQuotingDeadSeerOldCheck` was false. It did, however, expose a
new opposite-side extraction failure.

## New Hard Failure

At D3 `DAY_SPEECH`, 11号 GPT2 was an actual Werewolf and made a fake Seer claim:

`我这边拍个身份，我是预言家。1号DeepSeek，我昨晚验的你，查杀。`

This is a self-owned fake Seer check. It must enter 11号's structured checks as
11->1 `WEREWOLF`. The exported metadata instead recorded 11号 GPT2 as claimed
Seer with `checks: []` through the later D3 vote row.

This is not quote pollution. It is the reverse risk of the structural
attribution fix: legal self-owned check wording with the target addressed before
the pronoun result was being dropped.

## Local Follow-up

Added a regression in `src/game/claims.test.ts`:

- `parses self-owned seer checks when the addressed target appears before a pronoun result`

Updated `src/game/claims.ts` so target-before-pronoun self-owned check syntax
such as `1号DeepSeek，我昨晚验的你，查杀` is parsed as the speaker's own check,
while quote/report verb ownership rules still prevent `报/说/称/给/留` lines
from polluting the speaker's checks.

## Current Decision

This proof is useful as a live trigger sample but is not acceptance evidence for
the latest code. The pronoun self-check fix landed after the report and cases
were generated, so the DeepSeek-chat proof is stale for live acceptance.

Next proof, if the user supplies temporary provider input again, should be one
fresh same-seed bounded D3 run. Acceptance must check both sides:

- quoted or reported checks from another seat do not enter the speaker's own
  `checks`;
- real self-owned Seer/fake-Seer checks, including target-before-pronoun forms,
  do enter the speaker's own `checks`;
- old hard gates remain 0 for private leak, accepted fragments, non-Seer
  checks, and claimed-Seer same-target contradictions.
