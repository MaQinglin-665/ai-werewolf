# Verification Matrix

Use this matrix to choose the smallest validation set that proves a task. Do
not run every command by default; do not claim completion without evidence.

Harness idea: verification is part of the task contract. The right checks
depend on what changed.

## Principles

- Pick checks based on the changed behavior, not on habit.
- Prefer targeted tests first, then broader checks when the blast radius grows.
- If a check is skipped, record the reason in the handoff.
- UI, production, room-flow, and AI-behavior changes need task-specific checks;
  `npm run test` alone is not enough for those areas.
- Docs-only changes do not need code tests unless they change commands, env
  names, setup instructions, or release/deploy procedure.

## Matrix

| Task type | Required checks | Deeper checks | Handoff note |
| --- | --- | --- | --- |
| Docs-only | Read back changed docs; inspect `git diff` | Check links or commands manually if changed | State why code tests were skipped |
| Root harness / task templates | Read back `AGENTS.md`, task cards, and linked docs; inspect `git diff`; run `npm run harness:check` when package scripts or required harness files change | Dry-run a small task card mentally against the handoff format | Name the intended agent behavior change |
| Structure / framework audit | `npm run audit:structure`; read `docs/architecture.md` and relevant thread docs | Focused tests only if production code moves; broader tests after refactors | Report largest files, intended boundary change, and whether code behavior changed |
| Frontend/UI | `npm run lint`; run relevant test if one exists; manually exercise the visible flow when feasible | `npm run build`; browser smoke of the affected path | Include the page/flow checked, or why manual verification was skipped |
| Single-player main game | `npm run smoke:main-game` against the target base URL when a server is running; focused API/component tests for changed route or client logic | Browser smoke of home -> table -> first action -> day speech; `npm run build` for release confidence | Include base URL, board, role/action covered, and final phase |
| Rules engine | Add or update focused rule tests; `npm run test` | `npm run simulate:ai` for behavior interactions | Name the rule scenario and the test that protects it |
| AI speech / LLM contract | Check schema and fallback path; for small speech-quality diagnostics, start with a single persona such as `npm run llm:check -- --task=speech --persona=deepseek --retries=0` | Full `npm run llm:check -- --task=speech`; targeted LLM smoke; transcript review | Note provider mode, fallback behavior, command duration, and any skipped real-model check |
| AI behavior / balance | Focused behavior test if available; for small read-only diagnostics, run a bounded sample such as `npm run simulate:ai -- --games=10 --seed-start=91` | `npm run simulate:ai`; `npm run simulate:diagnose`; multiseed LLM evaluation when needed | Report seeds/counts and whether the result is directional or decisive |
| Room / multiplayer flow | Relevant room smoke such as `npm run smoke:room-sse` or `npm run smoke:room-action:vote` | Browser room flow; production room smoke after deploy | Include base URL and room path coverage |
| Production / release | `npm run preflight:production` against the documented base URL; relevant smoke command from release docs | Tencent Cloud deploy smoke; Render mirror smoke if part of release | Include target URL, commit/version if known, and any transient failures |
| Config / env docs | Compare `.env.example` or deployment docs with code usage; run the smallest type/build check that protects the change | `npx tsc --noEmit`; `npm run build` | State whether runtime secrets were untouched |
| Dependency / build config | `npm install` only if dependency files changed; `npm run build` or targeted command that uses the config | `npm run lint`; `npm run test` | Note install/build environment and lockfile impact |

## Selection Flow

1. Identify the task type from the changed files and requested behavior.
2. Run the required checks for that row.
3. Add deeper checks if the task touches shared behavior, release paths, or user-visible flows.
4. In the handoff, list exact commands, outcomes, skipped checks, and remaining risk.

## Common Pitfalls

- Passing `npm run test` does not prove a browser-visible flow works.
- Passing route handler tests does not prove the single-player player path can
  advance; use `npm run smoke:main-game` when stream continue or main game
  command routes are touched.
- Passing `npm run build` does not prove game rules are correct.
- Passing a local smoke does not prove Tencent Cloud or Render is healthy.
- Reading docs in the editor is not enough; read back changed files after edits.
- Untracked new files do not appear in ordinary `git diff` output; use
  `git diff --no-index -- /dev/null <file>` or stage before reviewing.
- Full speech-provider checks can be slow or timeout. For quick diagnostics,
  start with one persona and no retries, then broaden only when the task changes
  prompts, schemas, fallback behavior, or release confidence.
- A Vite message like `WebSocket server error: Port 24678 is already in use`
  can appear even when the command exits 0. Record it as environment noise
  unless the command itself fails or the requested diagnostic output is missing.
