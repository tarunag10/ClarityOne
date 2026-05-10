#!/bin/bash
set -euo pipefail

node scripts/build-extension.mjs chrome
node scripts/package-chrome-tester.mjs
