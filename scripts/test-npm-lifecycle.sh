#!/usr/bin/env bash
# Exercise the formula's actual primary npm call with Homebrew 5-style args.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node scripts/test-npm-lifecycle.mjs
