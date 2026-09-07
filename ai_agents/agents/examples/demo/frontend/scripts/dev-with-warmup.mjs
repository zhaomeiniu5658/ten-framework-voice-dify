import { spawn } from "node:child_process";

const child = spawn("next", ["dev", "--turbopack"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function warm(path) {
  const response = await fetch(`http://127.0.0.1:3000${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  return response.ok;
}

async function prewarm() {
  for (let i = 0; i < 90; i += 1) {
    try {
      if (await warm("/")) {
        console.log("[frontend] warmed /");
        return;
      }
    } catch {
      // Next dev is still starting.
    }
    await wait(2000);
  }
}

prewarm().catch((error) => {
  console.warn("[frontend] warmup skipped", error);
});

function forward(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
