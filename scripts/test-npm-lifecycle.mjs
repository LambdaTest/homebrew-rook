import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = mkdtempSync(join(tmpdir(), "rook-npm-lifecycle-"));
const formula = resolve(process.env.ROOK_FORMULA_UNDER_TEST || "Formula/rook.rb");
const marker = join(root, "lifecycle-markers");
const config = join(root, "npmrc");
writeFileSync(config, "");
const env = {
  ...process.env,
  npm_config_userconfig: config,
  npm_config_globalconfig: join(root, "global-npmrc"),
  npm_config_cache: join(root, "cache"),
  npm_config_ignore_scripts: "false",
  npm_config_audit: "false",
  npm_config_fund: "false",
  ROOK_LIFECYCLE_MARKER: marker,
};
writeFileSync(env.npm_config_globalconfig, "");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", env, ...options });
  assert.equal(result.status, 0, `${command} failed: ${result.error || ""}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function pack(name, version, dependencies = {}) {
  const dir = join(root, `${name}-${version}`);
  const packageDir = join(dir, "package");
  mkdirSync(packageDir, { recursive: true });
  const scripts = Object.fromEntries(["preinstall", "install", "postinstall", "prepare"].map(hook => [
    hook,
    `node -e "require('node:fs').appendFileSync(process.env.ROOK_LIFECYCLE_MARKER, '${name}:${hook}\\n')"`,
  ]));
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name, version, scripts, dependencies, main: "index.js" }));
  writeFileSync(join(packageDir, "index.js"), `console.log(${JSON.stringify(version)});\n`);
  const archive = join(root, `${name}-${version}.tgz`);
  run("tar", ["-czf", archive, "-C", dir, "package"]);
  return archive;
}

function primaryArgs(archive, prefix) {
  // Evaluate the real call, intercepting only system(). Deliberately model
  // std_npm_args before Homebrew supplied --ignore-scripts by default, so
  // the formula must establish its own policy on both old and new Homebrew.
  const ruby = `
    require "json"
    def std_npm_args
      ["--global", "--build-from-source", "--offline", "--prefix=#{ENV.fetch('ROOK_FIXTURE_PREFIX')}", ENV.fetch('ROOK_FIXTURE_ARCHIVE')]
    end
    def system(*args)
      puts JSON.generate(args)
    end
    calls = File.readlines(ARGV.fetch(0)).grep(/^    system "npm", "install"/)
    abort "expected one primary npm install call" unless calls.length == 1
    eval(calls.fetch(0), binding, ARGV.fetch(0))
  `;
  return JSON.parse(run("ruby", ["-e", ruby, formula], {
    env: { ...env, ROOK_FIXTURE_PREFIX: prefix, ROOK_FIXTURE_ARCHIVE: archive },
  }));
}

try {
  const dep = pack("rook-lifecycle-dependency", "1.0.0");
  const first = pack("rook-lifecycle-fixture", "1.0.0", { "rook-lifecycle-dependency": `file:${dep}` });
  const second = pack("rook-lifecycle-fixture", "1.0.1", { "rook-lifecycle-dependency": `file:${dep}` });
  assert(!existsSync(marker), "fixture packing must not execute hooks");

  // Positive control: the exact primary arguments without the policy flag
  // must execute hooks in both the top-level package and its dependency.
  const control = primaryArgs(first, join(root, "control")).filter(arg => arg !== "--ignore-scripts");
  run(control[0], control.slice(1));
  const observed = readFileSync(marker, "utf8");
  for (const name of ["rook-lifecycle-fixture", "rook-lifecycle-dependency"]) {
    for (const hook of ["preinstall", "install", "postinstall"]) {
      assert(observed.includes(`${name}:${hook}\n`), `positive control did not execute ${name}:${hook}`);
    }
  }
  rmSync(marker);

  const prefix = join(root, "protected");
  for (const [archive, version] of [[first, "1.0.0"], [second, "1.0.1"]]) {
    const args = primaryArgs(archive, prefix);
    run(args[0], args.slice(1));
    assert(!existsSync(marker), `primary install executed lifecycle hooks for ${version}`);
    assert(args.includes("--ignore-scripts"), "primary arguments must explicitly include --ignore-scripts");
    const installed = join(prefix, "lib/node_modules/rook-lifecycle-fixture");
    assert.equal(JSON.parse(readFileSync(join(installed, "package.json"))).version, version);
    assert.equal(run(process.execPath, [join(installed, "index.js")]).trim(), version);
  }

  const source = readFileSync(formula, "utf8");
  const runtime = source.match(/quiet_system "npm", "install",[\s\S]*?(?=\n        break)/)?.[0];
  assert(runtime, "bundled-runtime install call must be found");
  assert(runtime.includes('"--ignore-scripts"'), "bundled-runtime install must retain --ignore-scripts");
  console.log("PASS: hooks execute in the positive control; primary install and upgrade suppress them; installed fixtures run; bundled-runtime policy remains explicit");
} finally {
  rmSync(root, { recursive: true, force: true });
}
