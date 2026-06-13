# 12p Full-Game Low-Cost Diagnostic

Date: 2026-06-13

Scope: local mock full-game diagnostic for `12p-sheriff-seer-witch-hunter-guard`
after the bounded paid Mimo mechanism gate passed.

## Why This Exists

The paid 12p Mimo work proved the mechanism gate in a bounded sample:
`tmp/12p-mimo-speech-mechanics-post-retryfix-live-report.json` reached
fallback 1/50, error 1/50, validation failures 0, local eval averageScore
98.2, and no high-risk cases.

That sample did not complete a full game. This diagnostic checks the cheaper
question next: whether the 12p mechanics can survive a complete local game
without hard failures, duplicated hard-claim scaffolding, or prompt-like
reasoning cue leaks.

## Changes Made During This Diagnostic

- Naturalized `speech_influence` cue text before it enters table briefings,
  reasoning frames, debate agenda pressure lines, and mock speech evidence.
- Varied pressure-chain evidence rendering and made it avoid lines already used
  in recent public speech.
- Fixed direct mock command speech assembly so hard Seer claims are not emitted
  twice as `我跳预言家，X号是查杀`.
- Filtered internal motive text such as `拍身份是为了...` out of direct mock
  command speeches and merged non-Seer hard role claims into one spoken line.
- Added regression tests for direct mock command Seer and Hunter sheriff
  speeches.

## Final Local Evidence

Command:

```powershell
npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json
```

Result:

- Completed 1/1 game.
- Stop reason: `game_finished`.
- Winner: `WEREWOLVES`, reason `所有神职出局`.
- End state: day 5, `GAME_OVER`.
- Calls: 146 total, 40 speech, 106 action.
- fallbackCount: 0.
- errorCount: 0.
- validationFailureCount: 0.
- totalQualityIssues: 0.

Command:

```powershell
npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-final-pass-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-final-pass-eval.json
```

Result:

- totalCases: 80.
- averageScore: 100.
- issueCount: 0.
- highRiskCaseIds: empty.
- report-only sampleMetrics warnings:
  - `repeated_surface_phrase`: `最卡的反应往回听`, 2/26.
  - `repeated_clause_rate`: `从{seat}号这条压力转看{seat}号...`, 2/26.

## Judgment

Local full-game hard gate: pass.

This does not prove paid-model player feel by itself. It proves the full 12p
local path now completes cleanly and no longer leaks the hard defects found in
the bounded 12p work: private action labels, duplicated Seer claim scaffolding,
numbered model-name cue leakage, or prompt-like hard role motive text.

The remaining warnings are low-frequency report-only surface variety issues.
Do not add more local hard rules just to zero them out. The next useful proof is
a small paid live sample only if the user wants real-model full-game feel, not
another local regex chase.

## Post Evaluator-Calibration Recheck

After the paid claim-boundary proof and local evaluator calibration, the same
low-cost full-game gate was rerun to confirm no late-game hard regression was
introduced.

Command:

```powershell
npm.cmd run llm:evaluate -- --provider=mock --allow-mock --board=12p-sheriff-seer-witch-hunter-guard --human=none --seed-start=91 --games=1 --max-steps=800 --max-llm-calls=500 --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-report.json --eval-cases-out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json
```

Result:

- Completed 1/1 game.
- Stop reason: `game_finished`.
- Winner: `WEREWOLVES`, reason `所有神职出局`.
- End state: day 5, `GAME_OVER`.
- Calls: 146 total, 40 speech, 106 action.
- fallbackCount: 0.
- errorCount: 0.
- validationFailureCount: 0.
- totalQualityIssues: 0.

Command:

```powershell
npm.cmd run eval:ordinary-ai -- --source=existing --input=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-cases.json --json --out=tmp/12p-fullgame-lowcost-mock-after-eval-calibration-eval.json
```

Result:

- totalCases: 80.
- averageScore: 100.
- issueCount: 0.
- highRiskCaseIds: empty.
- report-only sampleMetrics warnings stayed low-frequency:
  - `repeated_surface_phrase`: `最卡的反应往回听`, 2/26.
  - `repeated_clause_rate`: `从{seat}号这条压力转看{seat}号...`, 2/26.

Judgment:

- Local full-game hard gate remains passed after evaluator calibration.
- There is no local blocker that justifies another evaluator or regex repair
  loop.
- The next useful step for the user's stated goal is a small paid Mimo
  full-feel sample focused on cross-day continuity and player feel, not another
  mock run.
