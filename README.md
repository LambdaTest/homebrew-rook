# Homebrew tap for Rook

The Homebrew formula for [Rook](https://github.com/LambdaTest/rook), the
terminal tool that tests AI agents. Rook itself is developed and released from
`LambdaTest/rook`; this repository only carries `Formula/rook.rb`, the
workflows that keep it current, and the bottles they build.

## Install

```
brew tap lambdatest/rook
brew install lambdatest/rook/rook
```

Install by the full `lambdatest/rook/rook` name, not just `rook`. Homebrew
refuses to load a formula from a third-party tap by its short name until the
tap is trusted, and naming the tap in full is what satisfies that
automatically. `brew install rook` after the same tap fails with
`Error: Refusing to load formula lambdatest/rook/rook from untrusted tap lambdatest/rook.`

Upgrade with `brew upgrade lambdatest/rook/rook`. `rook update` prints the same
command when it detects a Homebrew install.

The formula ships a bundled Node runtime, so nothing on the machine needs Node.
Homebrew's `node` is a build-time dependency only; `def install` writes a
`#!/bin/sh` launcher that execs the bundled binary directly.

Bottles are built for arm64 macOS and x86_64 Linux. Intel macOS installs build
from source, which the formula supports.

### If you tapped before the formula moved here

Until September 2026 the formula lived in `LambdaTest/rook` itself and was
tapped by explicit URL. A tap created that way keeps pulling from the old
remote, so point it at this repository once:

```
brew tap --custom-remote lambdatest/rook https://github.com/LambdaTest/homebrew-rook
```

## How a release reaches this tap

1. The private release pipeline publishes `@testmuai/rook` to npm, creates the
   `vX.Y.Z` release on `LambdaTest/rook` for the shell installer, and then
   sends a `formula-update` repository_dispatch here with the version.
2. `update-formula.yml` waits for the npm packages, rewrites `url`, `sha256`
   and `version` in `Formula/rook.rb`, strips the previous bottle block,
   pushes to `main`, and dispatches **Build bottles**.
3. `build-bottles.yml` builds the bottles, publishes them as the `rook-X.Y.Z`
   release of this repository, writes the bottle block back, pushes to
   `main`, and dispatches **brew-smoke**.
4. `brew-smoke.yml` taps, installs, asserts a bottle was poured rather than
   built, checks the version, and runs `brew test`. `brew-smoke-intel.yml` is
   the manual Intel macOS source-build check.

Between steps 2 and 3 the formula has no bottle block, so an install in that
window builds from source instead of failing.

Every workflow can also be dispatched by hand, for a re-run or a version the
private pipeline never dispatched:

```
gh workflow run "Update Homebrew Formula" --repo LambdaTest/homebrew-rook -f version=X.Y.Z
```

The formula's `url`, `sha256`, `version` and `bottle do` lines are anchors
those workflows patch with start-of-line `sed` and a fixed insertion point. Do
not reorder them, and do not run `brew style --fix` on them; the comment in the
formula explains the known `FormulaAudit/ComponentsOrder` report.

## Tests

`scripts/test-*.sh` extract the real shell and Python bodies out of the
committed workflow files and run them against the fixtures under
`scripts/fixtures/`. `test-scripts.yml` runs all of them on every push and
pull request. Locally:

```
for t in scripts/test-*.sh; do bash "$t"; done
```

macOS needs GNU sed (`brew install gnu-sed`) for `test-formula-patch.sh`, so
the dialect under test matches CI.

## Licence

Apache-2.0, the same as Rook.
