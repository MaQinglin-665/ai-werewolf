# Ordinary Mimo v46 Final Acceptance Gate

Date: 2026-06-12

Scope: same seed 91 bounded live Mimo sample for ordinary 9p Seer/Witch/Hunter, covering D1 speech, D1 vote, D2 speech, and one D2 vote round.

## Source Evidence

- Live report: `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-report.json`
- Eval cases: `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-cases.json`
- Local eval: `tmp/ordinary-mimo-v46-post-action-check-live-20260612-173703-eval.json`
- Latest status: `tmp/ordinary-mimo-v46-post-action-check-live-latest-status.json`

## Implemented Narrow Fixes

- Provider/action/eval guard now rejects fabricated public check attribution such as saying a Witch claimant also reported a black/gold check.
- The guard resolves both numeric targets and visible seat names, so `8号Kimi报了GPT查杀` and `8号Kimi报3号GPT查杀` are checked against the public claim board.
- Forward-commitment truncation guard now covers endings such as `有个更让我别扭的地方。`.
- Eval case metadata now preserves `aliveSeats` names and summarized `publicClaimBoard`, so local eval can audit name-based public-check references.

## Gate Result

v46 completed the intended bounded envelope:

- 28 total calls: 16 speech, 12 action.
- D1 `DAY_SPEECH`, D1 `DAY_VOTE`, D2 `DAY_SPEECH`, and D2 `DAY_VOTE` reached.
- `validationFailureCount 0`.
- Local eval: 28 cases, averageScore 100, issueCount 0, highRiskCaseIds empty.
- Acceptance scans found:
  - `malformed_output_fragment`: 0.
  - `logic_boundary_error`: 0.
  - `speech_vote_discontinuity`: 0.
  - ungrounded public check attribution: 0.
  - forward-commitment tail hits: 0.

## Residual Risks

- Provider stability remains imperfect: v46 had `fallbackCount 3`, `errorCount 3`.
- The fallback rows were D1 1号 low-information opening, D1 9号 soft vote posture, and D2 8号 Werewolf fake-Seer black-check claim. The D2 8号 row is game-legal, but it is not pure Mimo output and it becomes a major D2 focus.
- Report-only sample metrics still warn about repeated `信息少先听一圈` pressure and repeated D2 Witch/silver-water setup clauses. These are diversity/player-feel observations, not hard correctness failures for this gate.

## Recommendation

This pass satisfies the current hard gates requested by Fable5: no fabricated check/identity fact, no hanging forward commitment, and vote reasons remain within public-context bounds. Send v46 to final user acceptance. Do not request another Fable5 review unless the user specifically wants a subjective style pass or a cleaner no-fallback sample.
