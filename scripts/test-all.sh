#!/bin/bash
set -euo pipefail

npm test

if [[ "${SKIP_E2E:-0}" == "1" ]]; then
  echo "Skipping e2e because SKIP_E2E=1."
  exit 0
fi

if node scripts/check-e2e-capable.mjs; then
  npm run test:e2e
  exit 0
fi

if [[ "${REQUIRE_E2E:-0}" == "1" ]]; then
  echo "E2E environment is unavailable and REQUIRE_E2E=1, failing."
  exit 1
fi

echo "Skipping e2e because extension browser context is unavailable in this environment."
