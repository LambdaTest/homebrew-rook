# Maintaining homebrew-rook

Notes for the people who keep this tap working. Users only need the [README](../README.md).

This repository only carries `Formula/rook.rb`, the workflows that keep it current, and the bottles they build. rook itself is released from the private pipeline and published from `LambdaTest/rook`.

## How a release reaches this tap

1. The private release pipeline publishes `@testmuai/rook` to npm, creates the `vX.Y.Z` release on `LambdaTest/rook` for the shell installer, and then sends a `formula-update` repository_dispatch here with the version.
2. `update-formula.yml` waits for the npm packages, rewrites `url`, `sha256` and `version` in `Formula/rook.rb`, strips the previous bottle block, pushes to `main`, and dispatches **Build bottles**.
3. `build-bottles.yml` builds the bottles, publishes them as the `rook-X.Y.Z` release of this repository, writes the bottle block back, pushes to `main`, and dispatches **brew-smoke**.
4. `brew-smoke.yml` taps, installs, asserts a bottle was poured rather than built, checks the version, and runs `brew test`. `brew-smoke-intel.yml` is the manual Intel macOS source-build check.

Between steps 2 and 3 the formula has no bottle block, so an install in that window builds from source instead of failing.

Formula updates run one at a time and read the current `main` branch when they start. Before changing the formula, the updater refuses any pre-release version, then compares semantic versions and refuses an older release. Same-version retries are allowed. This workflow does not perform rollbacks. A competing push causes the normal Git push to fail; the updater never force-pushes over another change.

Every workflow can also be dispatched by hand, for a re-run or a version the private pipeline never dispatched:

```bash
gh workflow run "Update Homebrew Formula" --repo LambdaTest/homebrew-rook -f version=X.Y.Z
```

> [!CAUTION]
> The formula's `url`, `sha256`, `version` and `bottle do` lines are anchors those workflows patch with start-of-line `sed` and a fixed insertion point. Do not reorder them, and do not run `brew style --fix` on them; the comment in the formula explains the known `FormulaAudit/ComponentsOrder` report.

## Tests

`scripts/test-*.sh` extract the real shell and Python bodies out of the committed workflow files and run them against the fixtures under `scripts/fixtures/`. `test-scripts.yml` runs all of them on every push and pull request. Locally:

```bash
npm ci --ignore-scripts
for t in scripts/test-*.sh; do bash "$t"; done
```

macOS needs GNU sed (`brew install gnu-sed`) for `test-formula-patch.sh`, so the dialect under test matches CI.

## Formula internals

- Homebrew's `node` is a build-time dependency only. `def install` writes a `#!/bin/sh` launcher that execs the bundled Node binary directly.
- Both npm install calls explicitly disable package lifecycle scripts. The published CLI already contains its build output, so no install-time package script is required. This policy also covers older Homebrew versions whose default npm arguments do not disable scripts.
- On older macOS versions Homebrew may compile the `node` build dependency itself.
