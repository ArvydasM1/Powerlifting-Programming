#!/usr/bin/env node
/**
 * SPEC.md §15.2 provider 3: run the analysis through the official Claude Code CLI on your own
 * machine (ordinary subscription use) and write report.json for the app to import.
 *
 *   node analysis/run.mjs <bundle.json> [--kind full|nextProgram|reviewBlock] [--out <dir>]
 *
 * The bundle is exported from the app (Analysis → "Export bundle for Claude Code").
 * Output goes to ~/531log-analysis by default; paths inside this repository are refused
 * unless they are git-ignored (§16.3), because reports contain training data.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const bundlePath = args.find((a) => !a.startsWith("--"));
const kind = args.includes("--kind") ? args[args.indexOf("--kind") + 1] : "full";
const outDir = args.includes("--out") ? resolve(args[args.indexOf("--out") + 1]) : resolve(homedir(), "531log-analysis");
if (!bundlePath) {
  console.error("usage: node analysis/run.mjs <bundle.json> [--kind full|nextProgram|reviewBlock] [--out <dir>]");
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (outDir.startsWith(repoRoot)) {
  const ignored = spawnSync("git", ["check-ignore", "-q", outDir], { cwd: repoRoot });
  if (ignored.status !== 0) {
    console.error(`Refusing to write inside the repository (${outDir}) unless the path is git-ignored. Use --out outside the repo.`);
    process.exit(2);
  }
}

const bundle = readFileSync(resolve(bundlePath), "utf8");
const prompts = JSON.parse(readFileSync(resolve(repoRoot, "analysis", "prompts.json"), "utf8"));
const user = `<training_data>\n${bundle}\n</training_data>\n\n${prompts.user[kind] ?? prompts.user.full}`;

mkdirSync(outDir, { recursive: true });
const reply = execFileSync("claude", ["-p", "--output-format", "text", "--system-prompt", prompts.system, user], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(reply);
const json = (fence ? fence[1] : reply).trim();
JSON.parse(json); // fail loudly if not JSON
const out = resolve(outDir, `report-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, json);
console.log(`Report written to ${out}${existsSync(out) ? "" : " (write failed?)"}. Import it in the app: Analysis → Import report.`);
