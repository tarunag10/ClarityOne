#!/bin/bash
set -euo pipefail

node scripts/build-extension.mjs "${1:-all}"
