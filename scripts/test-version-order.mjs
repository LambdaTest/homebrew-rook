import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const repo = resolve(".");
const workflow = parse(readFileSync(".github/workflows/update-formula.yml", "utf8"));
const update = workflow.jobs.update.steps.find(s => s.name === "Update formula").run;
const commit = workflow.jobs.update.steps.find(s => s.name === "Commit and push").run;
const template = readFileSync("Formula/rook.rb", "utf8");
const root = mkdtempSync(join(tmpdir(), "rook-version-order-"));
after(() => rmSync(root, { recursive: true, force: true }));
const bin = join(root, "bin");
mkdirSync(bin);
if (process.platform === "darwin") {
  const gsed = spawnSync("bash", ["-c", "command -v gsed"], { encoding: "utf8" });
  assert.equal(gsed.status, 0, "GNU sed is required, matching the workflow's Ubuntu runner");
  symlinkSync(gsed.stdout.trim(), join(bin, "sed"));
}

function fixture(version, name = "fixture-") {
  const dir = mkdtempSync(join(root, name));
  mkdirSync(join(dir, "Formula"));
  writeFileSync(join(dir, "Formula/rook.rb"), template.replace(/^  version ".*"/m, `  version "${version}"`));
  symlinkSync(join(repo, "scripts"), join(dir, "scripts"), "dir");
  return dir;
}

function run(body, dir, version) {
  return spawnSync("bash", ["-e", "-o", "pipefail", "-c", body], {
    cwd: dir, encoding: "utf8",
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, VERSION: version,
      TARBALL_URL: `https://registry.npmjs.org/@testmuai/rook/-/rook-${version}.tgz`,
      SHA256: "c".repeat(64), GITHUB_OUTPUT: join(dir, "outputs"),
    },
  });
}

function git(dir, ...args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function version(dir) {
  return readFileSync(join(dir, "Formula/rook.rb"), "utf8").match(/^  version "([^"\n]+)"/m)?.[1];
}

test("all update requests share a non-cancelling concurrency group and read main when they start", () => {
  assert.equal(workflow.concurrency?.group, "rook-formula-update");
  assert.equal(workflow.concurrency?.["cancel-in-progress"], false);
  const checkout = workflow.jobs.update.steps.find(s => s.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout.with?.ref, "main");
});

for (const [current, requested, allowed] of [
  ["0.1.4", "0.1.3", false], ["0.1.3", "0.1.4", true], ["0.1.3", "0.1.3", true],
  ["0.1.3", "0.1.3-rc.1", false], ["0.1.3-rc.2", "0.1.3-rc.10", true],
  ["0.1.3-rc.10", "0.1.3-rc.2", false], ["0.1.3-rc.2", "0.1.3", true],
  ["1.0.0", "0.99.0", false], ["0.1.9", "0.1.10", true],
  ["broken", "0.1.4", false], ["0.1.3", "broken", false],
]) {
  test(`actual transform ${allowed ? "allows" : "refuses"} ${current} -> ${requested}`, () => {
    const dir = fixture(current);
    const before = readFileSync(join(dir, "Formula/rook.rb"), "utf8");
    const r = run(update, dir, requested);
    if (allowed) {
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(version(dir), requested);
      assert.match(readFileSync(join(dir, "Formula/rook.rb"), "utf8"), /system "npm", "install", "--ignore-scripts"/);
    } else {
      assert.notEqual(r.status, 0, "unsafe update returned success");
      assert.match(r.stderr + r.stdout, /::error::/);
      assert.equal(readFileSync(join(dir, "Formula/rook.rb"), "utf8"), before, "rejected request changed the formula");
    }
  });
}

for (const order of [["0.1.3", "0.1.4"], ["0.1.4", "0.1.3"]]) {
  test(`serialized delivery ${order.join(" then ")} preserves the newer version`, () => {
    const dir = fixture("0.1.2");
    for (const requested of order) run(update, dir, requested);
    assert.equal(version(dir), "0.1.4");
  });
}

for (const kind of ["missing", "duplicate"]) {
  test(`refuses a ${kind} current version without changing the formula`, () => {
    const dir = fixture("0.1.3");
    const path = join(dir, "Formula/rook.rb");
    const before = kind === "missing"
      ? template.replace(/^  version ".*"\n/m, "")
      : template.replace(/^  version ".*"/m, '  version "0.1.2"\n  version "0.1.4"');
    writeFileSync(path, before);
    const r = run(update, dir, "0.1.3");
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /expected exactly one version line/);
    assert.equal(readFileSync(path, "utf8"), before);
  });
}

test("a competing push after checkout cannot be overwritten by the real commit step", () => {
  const remote = join(root, "remote.git");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  const seed = fixture("0.1.2", "seed-");
  git(seed, "init", "--initial-branch=main");
  git(seed, "config", "user.name", "Rook fixture");
  git(seed, "config", "user.email", "fixture@example.invalid");
  git(seed, "add", "Formula/rook.rb");
  git(seed, "commit", "-m", "initial formula");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-u", "origin", "main");
  const older = join(root, "older");
  const newer = join(root, "newer");
  for (const dir of [older, newer]) {
    git(root, "clone", remote, dir);
    symlinkSync(join(repo, "scripts"), join(dir, "scripts"), "dir");
  }
  assert.equal(run(update, older, "0.1.3").status, 0);
  assert.equal(run(update, newer, "0.1.4").status, 0);
  const first = run(commit, newer, "0.1.4");
  assert.equal(first.status, 0, first.stderr);
  const stale = run(commit, older, "0.1.3");
  assert.notEqual(stale.status, 0, "stale checkout overwrote the newer push");
  assert.match(git(root, "--git-dir", remote, "show", "main:Formula/rook.rb"), /^  version "0\.1\.4"/m);
});
