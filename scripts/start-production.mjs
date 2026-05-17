import { spawn } from "node:child_process";

hydratePlatformEnv();

const envCheck = spawn(process.execPath, ["scripts/room-production-env-check.mjs"], {
  stdio: "inherit",
});

envCheck.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  startNext();
});

envCheck.on("error", (error) => {
  process.stderr.write(`Failed to run production env check: ${error.message}\n`);
  process.exit(1);
});

function startNext() {
  const port = process.env.PORT || "3000";
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCommand, ["run", "start", "--", "--hostname", "0.0.0.0", "--port", port], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    process.stderr.write(`Failed to start Next.js: ${error.message}\n`);
    process.exit(1);
  });
}

function hydratePlatformEnv() {
  if (!process.env.AI_WEREWOLF_PUBLIC_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
    process.env.AI_WEREWOLF_PUBLIC_ORIGIN = process.env.RENDER_EXTERNAL_URL;
  }
}
