<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/rook-mascot-dark.svg">
  <img src=".github/assets/rook-mascot-light.svg" alt="rook, the chess-piece mascot" width="110">
</picture>

# homebrew-rook

**The official Homebrew tap for [rook](https://github.com/LambdaTest/rook)** — agent assurance from the terminal.

[![brew-smoke](https://github.com/LambdaTest/homebrew-rook/actions/workflows/brew-smoke.yml/badge.svg?branch=main)](https://github.com/LambdaTest/homebrew-rook/actions/workflows/brew-smoke.yml)
[![test-scripts](https://github.com/LambdaTest/homebrew-rook/actions/workflows/test-scripts.yml/badge.svg?branch=main)](https://github.com/LambdaTest/homebrew-rook/actions/workflows/test-scripts.yml)
[![npm](https://img.shields.io/npm/v/@testmuai/rook?label=rook&color=cb3837)](https://www.npmjs.com/package/@testmuai/rook)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

</div>

## Install

```bash
brew install lambdatest/rook/rook
```

Homebrew adds the tap automatically on a fresh installation.

> [!IMPORTANT]
> Install by the full `lambdatest/rook/rook` name, not just `rook`. Homebrew refuses to load a formula from a third-party tap by its short name until the tap is trusted, and naming the tap in full is what satisfies that automatically. `brew install rook` after the same tap fails with `Error: Refusing to load formula lambdatest/rook/rook from untrusted tap lambdatest/rook.`

## Upgrade and uninstall

```bash
brew upgrade lambdatest/rook/rook       # rook update prints this command for Homebrew installs
brew uninstall lambdatest/rook/rook
brew untap lambdatest/rook              # after uninstalling, to remove the tap as well
```

## What you get

- **A self-contained `rook`.** The formula ships a bundled Node runtime, so nothing on the machine needs Node. Homebrew's `node` is a build-time dependency only; `def install` writes a `#!/bin/sh` launcher that execs the bundled binary directly.
- **Bottles** for arm64 macOS 15 (Sequoia) and x86_64 Linux. Older macOS versions and Intel Macs build from source and need Homebrew's Node build dependency; Homebrew may compile that dependency on unsupported macOS versions.
- **No install-time scripts.** Both npm install calls explicitly disable package lifecycle scripts. The published CLI already contains its build output, and the policy also holds on older Homebrew versions whose default npm arguments do not disable scripts.
- **Stable releases only.** Pre-release versions of rook are published to npm, not to this tap.

### If you tapped before the formula moved here

Until September 2026 the formula lived in `LambdaTest/rook` itself and was tapped by explicit URL. That clone keeps pulling from the old remote, and its history is unrelated to this repository's, so re-point it and put it on the new history in one go. The installed `rook` is untouched:

```bash
brew tap --custom-remote lambdatest/rook https://github.com/LambdaTest/homebrew-rook
git -C "$(brew --repository lambdatest/rook)" reset --hard origin/main
```

> [!WARNING]
> Two paths that look shorter do not work on Homebrew 6. `brew update` alone after the first command tries to rebase the old history onto the new one and leaves the tap detached mid-rebase. `brew untap --force` uninstalls `rook` before removing the tap.

## Getting help

rook is developed and supported in [LambdaTest/rook](https://github.com/LambdaTest/rook). Report install problems there with [an issue](https://github.com/LambdaTest/rook/issues/new/choose), and include `brew config` and the failing command's output.

## For maintainers

This repository only carries `Formula/rook.rb`, the workflows that keep it current, and the bottles they build. rook itself is released from the private pipeline and published from `LambdaTest/rook`.

### How a release reaches this tap

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

### Tests

`scripts/test-*.sh` extract the real shell and Python bodies out of the committed workflow files and run them against the fixtures under `scripts/fixtures/`. `test-scripts.yml` runs all of them on every push and pull request. Locally:

```bash
npm ci --ignore-scripts
for t in scripts/test-*.sh; do bash "$t"; done
```

macOS needs GNU sed (`brew install gnu-sed`) for `test-formula-patch.sh`, so the dialect under test matches CI.

<div align="center">
<br>
<sub>Licensed under <a href="LICENSE">Apache 2.0</a>, the same as rook · Made by <a href="https://www.testmuai.com">TestMu AI</a> (formerly LambdaTest)</sub>
</div>
