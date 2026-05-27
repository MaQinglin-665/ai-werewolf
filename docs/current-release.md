# Current Release Status

Last checked: 2026-05-27 19:19 Asia/Shanghai.

Use this file as the first stop before sharing the public Alpha link or starting a new deployment. Update it after every public-facing release.

## Public Entrypoints

- Primary Tencent Cloud Alpha: `https://175.178.199.245`
- Render free mirror: `https://ai-werewolf-free.onrender.com`
- Tencent health panel: `https://175.178.199.245/alpha-health`
- Render health panel: `https://ai-werewolf-free.onrender.com/alpha-health`

## Current Source State

- Working branch: `codex/ai-pool-character-roster`
- Current public runtime baseline: `a6be5d8 fix: type prisma transaction client`
- Local worktree at runtime check: pushed to `origin/codex/ai-pool-character-roster`
- Render deployment branch at last check: `1cb8eb2 deploy: sync mobile interaction signals`

Render is intentionally tracked through `codex/room-render-production-minimum`. Tencent Cloud is deployed from the current source archive path. When a release should be visible in both public environments, update both lanes and record the two heads here.

This file may be updated by documentation-only commits after the runtime baseline. Use `git log -1` when you need the exact repository documentation head.

## Tencent Cloud

- Host: `ubuntu@175.178.199.245`
- Compose root: `/opt/ai-werewolf`
- Live app source: `/opt/ai-werewolf/app`
- Main service: `ai-werewolf-app`
- Latest deployed source: `a6be5d8 fix: type prisma transaction client`
- Rollback source tree: `/opt/ai-werewolf/app-backup-20260527-191746-pre-character-roster`
- Last container status: `ai-werewolf-app` healthy, image `sha256:06c5860a222341a4bbc7f01cb5a0aee9176ef09f98001708b1151cc169be302f`, nginx and Postgres running

Latest verification:

```powershell
npm run preflight:production -- --base-url=https://175.178.199.245
```

Result at 2026-05-27 19:18 Asia/Shanghai: `ok=true`, all production minimum checks passed.

Latest room smoke:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
```

Result at 2026-05-27 19:18 Asia/Shanghai: `ok=true`, room `RPBY6V`, host seat `1`, guest seat `2`.

Latest main game smoke:

```powershell
npm run smoke:main-game -- --base-url=https://175.178.199.245
```

Result at 2026-05-27 19:19 Asia/Shanghai: `ok=true`, board `6p-beginner-seer`, human seat `1`, submitted `wolfKill`, final phase `DAY_SPEECH`.

Latest mobile UI asset probe:

```powershell
# fetched public HTML assets and searched for the shipped mobile UI classes
```

Result: public `/ai-pool` HTML includes `AI池和自定义AI`, `角色名册`, `人物来源`, `说话方式`, `推理习惯`, and `不要做什么`.

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

Current stage: public Alpha is online and smoke-tested on the Tencent Cloud primary path, but it is not yet a polished open beta. The project is now in a consolidation pass: close the current local AI/room/UI changes, align public-facing product narrative, and only pay down technical debt that improves the real-player playtest loop.

Next focus:

- close and verify the current dirty local changes before adding new feature scope;
- keep README, release status, playtest docs, and promotion copy aligned around "small-scope Public Alpha";
- use technical-debt work to protect the playtest loop: join, start, act, speak, vote, refresh recovery, mobile readability, and AI table feel;
- keep Tencent Cloud as the primary public test environment;
- keep Render as a free mirror / deployment comparison lane;
- run a small real-player mobile test round and record the top friction points;
- continue phase rhythm polish only where it improves table readability.

Latest spot check:

```powershell
curl.exe -k -L --max-time 20 https://175.178.199.245/api/rooms/health
```

Result at 2026-05-26 10:26 Asia/Shanghai: `ok=true`, `deployment.productionMinimumReady=true`, PostgreSQL room store/realtime/presence/rate-limit adapters enabled.

Render free mirror note: a direct health request timed out after 25 seconds during this spot check, consistent with a cold or unavailable free mirror. Use Tencent Cloud as the primary share target unless Render is rechecked.
