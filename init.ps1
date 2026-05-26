$ErrorActionPreference = "Stop"

Write-Host "=== Harness Initialization ==="
Write-Host "Project: ai-werewolf"
Write-Host ""

Write-Host "=== npm run harness:check ==="
npm run harness:check

Write-Host ""
Write-Host "=== Fast optional checks ==="
Write-Host "Use docs/verification-matrix.md to choose task-specific validation."
Write-Host "Common commands:"
Write-Host "- npm run lint"
Write-Host "- npm run test"
Write-Host "- npm run smoke:main-game -- --base-url=http://127.0.0.1:3000"
Write-Host "- npm run smoke:room-sse"
Write-Host "- npm run smoke:room-action:vote"
Write-Host "- npm run build"

Write-Host ""
Write-Host "=== Verification Complete ==="
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Read feature_list.json to see current feature state"
Write-Host "2. Read progress.md for restart context"
Write-Host "3. Pick ONE unfinished feature to work on"
Write-Host "4. Re-run task-specific verification before claiming done"
