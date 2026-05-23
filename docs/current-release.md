# Current Release Status

Last checked: 2026-05-23 15:48 Asia/Shanghai.

Use this file as the first stop before sharing the public Alpha link or starting a new deployment. Update it after every public-facing release.

## Public Entrypoints

- Primary Tencent Cloud Alpha: `https://175.178.199.245`
- Render free mirror: `https://ai-werewolf-free.onrender.com`
- Tencent health panel: `https://175.178.199.245/alpha-health`
- Render health panel: `https://ai-werewolf-free.onrender.com/alpha-health`

## Current Source State

- Working branch: `codex/mobile-room-lobby`
- Current public runtime baseline: `a1a0465 fix: keep mobile room entry actions visible`
- Local worktree at runtime check: pushed to `origin/codex/mobile-room-lobby`
- Render deployment branch at last check: `1cb8eb2 deploy: sync mobile interaction signals`

Render is intentionally tracked through `codex/room-render-production-minimum`. Tencent Cloud is deployed from the current source archive path. When a release should be visible in both public environments, update both lanes and record the two heads here.

This file may be updated by documentation-only commits after the runtime baseline. Use `git log -1` when you need the exact repository documentation head.

## Tencent Cloud

- Host: `ubuntu@175.178.199.245`
- Compose root: `/opt/ai-werewolf`
- Live app source: `/opt/ai-werewolf/app`
- Main service: `ai-werewolf-app`
- Latest deployed source: `a1a0465 fix: keep mobile room entry actions visible`
- Rollback source tree: `/opt/ai-werewolf/app-backup-20260523154438`
- Last container status: `ai-werewolf-app` healthy, image `sha256:876a50bd70aa91040cf954ae04a0f1b1ff75474cf5c8df1c8f9e0397e1ad11a7`, nginx and Postgres running

Latest verification:

```powershell
npm run preflight:production -- --base-url=https://175.178.199.245
```

Result at 2026-05-23 15:47 Asia/Shanghai: `ok=true`, all production minimum checks passed.

Latest room smoke:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
```

Result at 2026-05-23 15:47 Asia/Shanghai: `ok=true`, room `FDTDKC`, host seat `1`, guest seat `2`.

Latest room action smoke:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-action:vote
```

Result at 2026-05-23 15:48 Asia/Shanghai: `ok=true`, room `E7BOD1`, covered `wolfKill`, `speak`, and `vote`; vote resolved into `LAST_WORDS`.

Latest mobile UI asset probe:

```powershell
# fetched public HTML assets and searched for the shipped mobile UI classes
```

Result: found `mobile-room-entry-primary`, `mobile-room-entry-secondary`, `mobile-room-entry-seat-rail`, and `mobile-room-lobby`.

## Render Free Mirror

- Service URL: `https://ai-werewolf-free.onrender.com`
- Deployment branch: `codex/room-render-production-minimum`
- Latest deployed branch head at last check: `1cb8eb2 deploy: sync mobile interaction signals`

Latest verification:

```powershell
npm run preflight:production -- --base-url=https://ai-werewolf-free.onrender.com
```

Result at 2026-05-23 09:53 Asia/Shanghai: `ok=true`, all production minimum checks passed.

Latest room smoke:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://ai-werewolf-free.onrender.com"; npm run smoke:room-sse
```

Result at 2026-05-23 09:53 Asia/Shanghai: `ok=true`, room `GR0CVF`, host seat `1`, guest seat `2`.

Latest mobile DOM probe:

```powershell
# Headless Chrome, 390x844 mobile viewport, public Render URL
```

Result: found `mobile-drawer-tab-has-activity`, `mobile-drawer-tab-unread`, `mobile-drawer-tab-recommendation`, updated drawer aria labels, and no drawer/action-label overflow.

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
- run a small real-player mobile test round and record the top friction points;
- continue phase rhythm polish only where it improves table readability.
