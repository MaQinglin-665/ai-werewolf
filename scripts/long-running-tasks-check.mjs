import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "long_running_tasks.json");
const allowedStatuses = new Set(["planned", "running", "blocked", "failed", "killed", "done"]);
const requiredFields = [
  "id",
  "title",
  "status",
  "owner",
  "scope",
  "started_at",
  "updated_at",
  "related_task_card",
  "handoff_pointer",
  "last_verified_command",
  "next_action",
  "notes",
];

const failures = [];

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (error) {
  console.error(`fail  could not parse long_running_tasks.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (registry.version !== 1) {
  failures.push("registry.version must be 1");
}

if (typeof registry.updated_at !== "string" || registry.updated_at.trim() === "") {
  failures.push("registry.updated_at must be a non-empty string");
}

if (!Array.isArray(registry.tasks)) {
  failures.push("registry.tasks must be an array");
} else {
  const ids = new Set();

  for (const [index, task] of registry.tasks.entries()) {
    const label = task?.id || `task[${index}]`;

    for (const field of requiredFields) {
      if (!Object.hasOwn(task, field)) {
        failures.push(`${label}: missing ${field}`);
      }
    }

    if (typeof task?.id !== "string" || !task.id.startsWith("lrt-")) {
      failures.push(`${label}: id must be a string starting with lrt-`);
    } else if (ids.has(task.id)) {
      failures.push(`${label}: duplicate id`);
    } else {
      ids.add(task.id);
    }

    if (!allowedStatuses.has(task?.status)) {
      failures.push(`${label}: invalid status ${String(task?.status)}`);
    }

    if (!Array.isArray(task?.scope) || task.scope.length === 0) {
      failures.push(`${label}: scope must be a non-empty array`);
    }

    if (typeof task?.next_action !== "string" || task.next_action.trim() === "") {
      failures.push(`${label}: next_action must be a non-empty string`);
    }

    if (typeof task?.handoff_pointer !== "string" || task.handoff_pointer.trim() === "") {
      failures.push(`${label}: handoff_pointer must be a non-empty string`);
    }
  }
}

if (failures.length > 0) {
  console.log("Long-running task registry");
  console.log("--------------------------");
  for (const failure of failures) console.log(`fail  ${failure}`);
  process.exit(1);
}

console.log("Long-running task registry");
console.log("--------------------------");
console.log(`ok  ${registry.tasks.length} task(s) checked`);
