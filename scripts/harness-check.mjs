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
  "long_running_tasks.json",
  "docs/README.md",
  "docs/long-running-tasks.md",
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
  "harness:long-tasks",
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

const jsonStateFiles = [
  "feature_list.json",
  "long_running_tasks.json",
  "package.json",
];

const conflictMarkerFiles = [
  "AGENTS.md",
  "feature_list.json",
  "progress.md",
  "session-handoff.md",
  "long_running_tasks.json",
  "docs/README.md",
  "docs/harness-state.md",
  "docs/verification-matrix.md",
  "docs/tasks/HARNESS_TASK_TEMPLATE.md",
];

const conflictMarkers = ["<<<<<<<", "=======", ">>>>>>>"];
const failures = [];

printSection("Git status");
let gitStatus = "";
try {
  gitStatus = execFileSync("git", ["status", "--short"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  console.log(gitStatus || "clean");
} catch (error) {
  failures.push(`git status failed: ${error instanceof Error ? error.message : String(error)}`);
}

printSection("Conflict state");
try {
  const unresolved = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (unresolved.length > 0) {
    for (const file of unresolved) {
      failures.push(`unresolved merge conflict: ${file}`);
      console.log(`no  ${file}`);
    }
  } else {
    console.log("ok  no unresolved git conflicts");
  }
} catch (error) {
  failures.push(`could not inspect unresolved conflicts: ${error instanceof Error ? error.message : String(error)}`);
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

printSection("State files");
for (const file of jsonStateFiles) {
  try {
    JSON.parse(readFileSync(path.join(root, file), "utf8"));
    console.log(`ok  ${file} valid JSON`);
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`no  ${file} valid JSON`);
  }
}

printSection("Conflict markers");
for (const file of conflictMarkerFiles) {
  const filePath = path.join(root, file);
  if (!existsSync(filePath)) continue;

  const content = readFileSync(filePath, "utf8");
  const marker = conflictMarkers.find((candidate) => content.includes(candidate));

  if (marker) {
    failures.push(`${file} contains conflict marker ${marker}`);
    console.log(`no  ${file}`);
  } else {
    console.log(`ok  ${file}`);
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
