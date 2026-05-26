#!/bin/bash
set -e

echo "=== Harness Initialization ==="
echo "Project: ai-werewolf"
echo ""

echo "=== npm run harness:check ==="
npm run harness:check

echo ""
echo "=== Fast optional checks ==="
echo "Use docs/verification-matrix.md to choose task-specific validation."
echo "Common commands:"
echo "- npm run lint"
echo "- npm run test"
echo "- npm run smoke:main-game -- --base-url=http://127.0.0.1:3000"
echo "- npm run smoke:room-sse"
echo "- npm run smoke:room-action:vote"
echo "- npm run build"

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Read progress.md for restart context"
echo "3. Pick ONE unfinished feature to work on"
echo "4. Re-run task-specific verification before claiming done"
