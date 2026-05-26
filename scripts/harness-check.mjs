import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "feature_list.json",
  "progress.md",
  "session-handoff.md",
  "init.sh",
  "init.ps1",
  "docs/README.md",
  "docs/harness-orientation.md",
  "docs/harness-state.md",
  "docs/feature-registry.md",
  "docs/verification-matrix.md",
  "docs/harness-retrospective.md",
  "docs/tasks/HARNESS_TASK_TEMPLATE.md",
];

const requiredScripts = [
  "lint",
  "test",
  "build",
  "llm:check",
  "simulate:ai",
  "simulate:diagnose",
  "smoke:room-sse",
  "smoke:room-action:vote",
  "smoke:main-game",
  "preflight:production",
  "harness:task-card",
];

const requiredTaskTemplateMarkers = [
  "## Task Gate",
  "Task type:",
  "Risk level: low | medium | high",
  "Required verification tier:",
  "Browser/manual verification:",
  "State updates required:",
  "Skipped checks must record:",
];

const failures = [];

printSection("Git status");
try {
  const status = execFileSync("git", ["status", "--short"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  console.log(status || "clean");
} catch (error) {
  failures.push(`git status failed: ${error instanceof Error ? error.message : String(error)}`);
}

printSection("Harness files");
for (const file of requiredFiles) {
  if (existsSync(path.join(root, file))) {
    console.log(`ok  ${file}`);
  } else {
    failures.push(`missing required harness file: ${file}`);
    console.log(`no  ${file}`);
  }
}

printSection("Package scripts");
let packageJson;
try {
  packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
} catch (error) {
  failures.push(`could not read package.json: ${error instanceof Error ? error.message : String(error)}`);
}

const scripts = packageJson?.scripts ?? {};
for (const script of requiredScripts) {
  if (Object.hasOwn(scripts, script)) {
    console.log(`ok  ${script}`);
  } else {
    failures.push(`missing package script: ${script}`);
    console.log(`no  ${script}`);
  }
}

printSection("Task card gate");
try {
  const template = readFileSync(path.join(root, "docs/tasks/HARNESS_TASK_TEMPLATE.md"), "utf8");
  for (const marker of requiredTaskTemplateMarkers) {
    if (template.includes(marker)) {
      console.log(`ok  ${marker}`);
    } else {
      failures.push(`task template missing gate marker: ${marker}`);
      console.log(`no  ${marker}`);
    }
  }
} catch (error) {
  failures.push(`could not read task template: ${error instanceof Error ? error.message : String(error)}`);
}

printSection("Result");
if (failures.length > 0) {
  for (const failure of failures) console.log(`fail  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("ok  harness mechanical checks passed");
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}
