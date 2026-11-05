# Maintaining homebrew-rook

Notes for the people who keep this tap working. Users only need the [README](../README.md).

This repository only carries `Formula/rook.rb`, the workflows that keep it current, and the bottles they build. rook itself is released from the private pipeline and published from `LambdaTest/rook`.

## How a release reaches this tap

1. The private release pipeline publishes `@testmuai/rook` to npm, creates the `vX.Y.Z` release on `LambdaTest/rook` for the shell installer, and then sends a `formula-update` repository_dispatch here with the version.
2. `update-formula.yml` waits for the npm packages, rewrites `url`, `sha256` and `version` in `Formula/rook.rb`, strips the previous bottle block, lands that on `main` through a PR, and dispatches **Build bottles**.
3. `build-bottles.yml` builds the bottles, publishes them as the `rook-X.Y.Z` release of this repository, writes the bottle block back through a second PR, and dispatches **brew-smoke**.
4. `brew-smoke.yml` taps, installs, asserts a bottle was poured rather than built, checks the version, and runs `brew test`. `brew-smoke-intel.yml` is the manual Intel macOS source-build check.

Between steps 2 and 3 the formula has no bottle block, so an install in that window builds from source instead of failing.

### Approving the release PRs

Since 2 Nov 2026 the org's ruleset lets `main` change only through a PR with one approval, and nothing bypasses it. So each release opens two PRs from `chore/rook-X.Y.Z-run-…` branches: the formula update, then the bottle block. The run prints the link and waits. Any tap admin approves it, and the run merges it and carries on. The bot is the last pusher, so the approver can be whoever cut the release.

`scripts/merge-via-pr.sh` does this for both workflows. A run that waits 5½ hours without an approval gives up and leaves its PR open. Merge it, then start the next step by hand (**Build bottles** after the formula, **brew-smoke** after the bottles). A re-run closes the earlier run's open PR. If `main` moves while a PR waits, the run closes the PR instead of landing it over the newer `main`.

Formula updates run one at a time and read the current `main` branch when they start. Before changing the formula, the updater refuses any pre-release version, then compares semantic versions and refuses an older release. Same-version retries are allowed. This workflow does not perform rollbacks. If `main` moves while the updater's PR waits, the PR is closed rather than merged; the updater never lands over another change.

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
