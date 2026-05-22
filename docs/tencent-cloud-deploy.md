# Tencent Cloud Deploy Runbook

This is the VPS deployment path for the Tencent Cloud Ubuntu server used by this project.

## Current Host

- Public IP: `175.178.199.245`
- SSH user: `ubuntu`
- SSH key: `C:\Users\MQL\.ssh\ai_werewolf_tencent_ed25519`
- Compose root: `/opt/ai-werewolf`
- Live app source: `/opt/ai-werewolf/app`
- Main app container: `ai-werewolf-app`
- Reverse proxy: nginx on `80/443`

The old `ai-werewolf` container on `:3003` is a legacy path and is not the success signal for the current public deployment.

## Release Rule

Every update that should be visible on the public Alpha must be deployed to this Tencent Cloud host after local validation and GitHub push. Do not stop at Render-only verification unless the task explicitly says Render is the only target.

Minimum checklist after each public-facing update:

1. Commit and push the source branch.
2. Deploy the same source tree to Tencent Cloud.
3. Verify `ai-werewolf-app` is healthy.
4. Run production preflight against `https://175.178.199.245`.
5. Run room SSE smoke against `https://175.178.199.245`.

## Safe Deploy Shape

Use a clean source archive instead of copying the working directory directly. Exclude `.git`, `.next`, `node_modules`, `tmp`, `.env*`, logs, generated caches, and local database files.

The server-side flow should be:

1. Upload the clean archive to `/tmp`.
2. Unpack it into `/opt/ai-werewolf/app-next-<timestamp>`.
3. Build the candidate image from the new source tree.
4. Move the previous app tree to `/opt/ai-werewolf/app-backup-<timestamp>`.
5. Move the new tree into `/opt/ai-werewolf/app`.
6. Recreate only the app service with Docker Compose.
7. Keep the backup tree until the live smoke checks pass.

## Verification Commands

From the local repo:

```powershell
npm run preflight:production -- --base-url=https://175.178.199.245
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-sse
```

Optional deeper action smoke:

```powershell
$env:ROOM_SMOKE_BASE_URL="https://175.178.199.245"; npm run smoke:room-action:vote
```

If local Node `fetch` is flaky, use the bundled Codex runtime Node and rerun the same script before blaming the server.
