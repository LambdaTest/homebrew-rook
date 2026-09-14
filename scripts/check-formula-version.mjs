import { readFileSync } from "node:fs";
import semver from "semver";

try {
  const [formula, requested, ...extra] = process.argv.slice(2);
  if (!formula || !requested || extra.length) {
    throw new Error("Usage: node scripts/check-formula-version.mjs FORMULA VERSION");
  }
  const matches = [...readFileSync(formula, "utf8").matchAll(/^  version "([^"\n]+)"[^\n]*$/gm)];
  if (matches.length !== 1) {
    throw new Error("Cannot establish the current formula version; expected exactly one version line. The formula was not changed.");
  }
  const current = matches[0][1];
  if (!semver.valid(current) || !semver.valid(requested)) {
    throw new Error(`Invalid SemVer in formula update: current=${JSON.stringify(current)}, requested=${JSON.stringify(requested)}. The formula was not changed.`);
  }
  if (semver.lt(requested, current)) {
    throw new Error(`Refusing to downgrade rook from ${current} to ${requested}. The formula was not changed. Use the current or a newer version; this workflow does not perform rollbacks.`);
  }
  console.log(`Formula update allowed: ${current} -> ${requested}`);
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exitCode = 1;
}
