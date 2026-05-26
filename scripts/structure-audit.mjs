import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const limit = readPositiveInt(args.limit, 20);
const warnLines = readPositiveInt(args["warn-lines"], 1200);
const scanRoots = ["src", "scripts", "docs"];
const ignoredDirs = new Set([".git", ".next", "node_modules", "tmp", "dist", "build", "coverage", "generated"]);
const ignoredPathParts = new Set(["assets", "generated"]);
const ignoredRelativePrefixes = ["docs/evaluations/", "docs/superpowers/"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".md", ".json", ".ps1", ".sh"]);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);

try {
  const files = [];
  for (const scanRoot of scanRoots) {
    await collectFiles(path.join(root, scanRoot), scanRoot, files);
  }

  const measured = [];
  for (const file of files) {
    const content = await readFile(path.join(root, file), "utf8").catch(() => "");
    const lines = content.split(/\r?\n/).length;
    const extension = path.extname(file);
    const isCode = codeExtensions.has(extension);
    measured.push({
      path: normalizePath(file),
      lines,
      exports: isCode ? countMatches(content, /^\s*export\s+/gm) : undefined,
      functions: isCode ? countMatches(content, /^\s*(?:export\s+)?(?:async\s+)?function\s+/gm) : undefined,
    });
  }

  measured.sort((left, right) => right.lines - left.lines);
  const largeFiles = measured.filter((file) => file.lines >= warnLines);
  const directoryCounts = countByTopDirectory(measured);
  const summary = {
    ok: true,
    scannedFiles: measured.length,
    warnLines,
    largeFileCount: largeFiles.length,
    largestFiles: measured.slice(0, limit),
    largeFiles,
    directoryCounts,
    notes: [
      "Generated code and docs/assets are excluded.",
      "Line count is a triage signal, not an automatic refactor order.",
      "Prefer extracting pure helpers or scripts before moving rule or AI behavior internals.",
    ],
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function collectFiles(current, relative, results) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const rel = path.join(relative, entry.name);
    const normalizedRel = normalizePath(rel);
    if (ignoredRelativePrefixes.some((prefix) => normalizedRel.startsWith(prefix))) continue;
    const parts = rel.split(path.sep);
    if (parts.some((part) => ignoredPathParts.has(part))) continue;

    if (entry.isDirectory()) {
      await collectFiles(path.join(current, entry.name), rel, results);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!textExtensions.has(path.extname(entry.name))) continue;
    results.push(rel);
  }
}

function countByTopDirectory(files) {
  const counts = new Map();
  for (const file of files) {
    const [first, second] = file.path.split("/");
    const key = first === "src" && second ? `${first}/${second}` : first;
    const existing = counts.get(key) ?? { files: 0, lines: 0 };
    existing.files += 1;
    existing.lines += file.lines;
    counts.set(key, existing);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((left, right) => right.lines - left.lines);
}

function countMatches(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
