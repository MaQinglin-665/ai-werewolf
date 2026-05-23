# Current Release Status

Last checked: 2026-05-23 09:09 Asia/Shanghai.

Use this file as the first stop before sharing the public Alpha link or starting a new deployment. Update it after every public-facing release.

## Public Entrypoints

- Primary Tencent Cloud Alpha: `https://175.178.199.245`
- Render free mirror: `https://ai-werewolf-free.onrender.com`
- Tencent health panel: `https://175.178.199.245/alpha-health`
- Render health panel: `https://ai-werewolf-free.onrender.com/alpha-health`

## Current Source State

- Working branch: `codex/render-main-game-env-fix`
- Current public runtime baseline: `3e8b883 docs: add tencent cloud deploy runbook`
- Local worktree at runtime check: clean and synced with `origin/codex/render-main-game-env-fix`
- Render deployment branch at last check: `f09b3d5 deploy: sync refactored game UI`

Render is intentionally tracked through `codex/room-render-production-minimum`. Tencent Cloud is deployed from the current source archive path. When a release should be visible in both public environments, update both lanes and record the two heads here.

This file may be updated by documentation-only commits after the runtime baseline. Use `git log -1` when you need the exact repository documentation head.

## Tencent Cloud

- Host: `ubuntu@175.178.199.245`
- Compose root: `/opt/ai-werewolf`
- Live app source: `/opt/ai-werewolf/app`
- Main service: `ai-werewolf-app`
- Latest deployed source: `3e8b883 docs: add tencent cloud deploy runbook`
- Rollback source tree: `/opt/ai-werewolf/app-backup-20260522-235056`
- Last container status: `ai-werewolf-app` healthy, nginx and Postgres running

Latest verification:

```powershell
npm run preflight:production -- --base-url=https://175.178.199.245
```

Result at 2026-05-23 09:09 Asia/Shanghai: `ok=true`, all production minimum checks passed.

Previous deep smoke from the same deployed app:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; node scripts/room-action-smoke.mjs --coverage=vote
```

Result: `ok=true`, covered `wolfKill`, `seerCheck`, `speak`, and `vote`; wrong-player commands returned `409`.

## Render Free Mirror

- Service URL: `https://ai-werewolf-free.onrender.com`
- Deployment branch: `codex/room-render-production-minimum`
- Latest deployed branch head at last check: `f09b3d5 deploy: sync refactored game UI`

Latest verification:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run preflight:production
```

Result at 2026-05-23 09:09 Asia/Shanghai: `ok=true`, all production minimum checks passed.

Previous room/action smoke from the same UI deploy:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; node scripts/room-action-smoke.mjs --coverage=vote
```

Result: `ok=true`, covered `wolfKill`, `speak`, and `vote`; wrong-player commands returned `409`.

## Release Checklist

Before telling someone to use the public Alpha link:

1. Confirm `git status --short --branch` is clean.
2. Run local validation appropriate to the change. For UI/runtime changes, use at least:
   - `npm run test`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
3. Push the source branch to GitHub.
4. Deploy Render if the change should be visible on the Render mirror.
5. Deploy Tencent Cloud if the change should be visible on the primary public Alpha.
6. Run production preflight against both public URLs.
7. Run at least `smoke:room-sse` against the primary public URL.
8. For gameplay or mobile table changes, also run the vote-chain action smoke.
9. Update this file with the new commit heads, backup path, and verification results.

## Next Product Stage

Current stage: public Alpha is online and smoke-tested, but it is not yet a polished open beta.

Next focus:

- keep Tencent Cloud as the primary public test environment;
- keep Render as a free mirror / deployment comparison lane;
- finish mobile action feedback, drawer status, and phase rhythm polish;
- run a small real-player test round and record the top friction points.
