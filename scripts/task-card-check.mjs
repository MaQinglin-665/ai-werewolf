import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: node scripts/task-card-check.mjs <docs/tasks/task.md> [...]");
  process.exit(1);
}

const requiredMarkers = [
  "# ",
  "## Task",
  "## Task Gate",
  "Task type:",
  "Risk level:",
  "Required verification tier:",
  "Browser/manual verification:",
  "State updates required:",
  "Skipped checks must record:",
  "## Context To Read First",
  "## Allowed Scope",
  "## Definition Of Done",
  "## Verification",
  "## Handoff",
];

const failures = [];

for (const file of files) {
  const target = path.resolve(root, file);
  const displayPath = path.relative(root, target) || file;

  if (!existsSync(target)) {
    failures.push(`${displayPath}: file not found`);
    continue;
  }

  const content = readFileSync(target, "utf8");
  console.log(`\n${displayPath}`);
  console.log("-".repeat(displayPath.length));

  for (const marker of requiredMarkers) {
    if (content.includes(marker)) {
      console.log(`ok  ${marker}`);
    } else {
      console.log(`no  ${marker}`);
      failures.push(`${displayPath}: missing ${marker}`);
    }
  }
}

if (failures.length > 0) {
  console.log("\nResult");
  console.log("------");
  for (const failure of failures) console.log(`fail  ${failure}`);
  process.exit(1);
}

console.log("\nResult");
console.log("------");
console.log("ok  task card gate passed");
