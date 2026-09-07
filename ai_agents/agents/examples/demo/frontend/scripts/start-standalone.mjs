import { existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const standaloneStaticDir = join(standaloneDir, ".next", "static");
const sourceStaticDir = join(root, ".next", "static");
const sourcePublicDir = join(root, "public");
const standalonePublicDir = join(standaloneDir, "public");

if (!existsSync(join(standaloneDir, "server.js"))) {
  console.error("Missing .next/standalone/server.js. Run `bun run build` first.");
  process.exit(1);
}

if (existsSync(sourceStaticDir)) {
  cpSync(sourceStaticDir, standaloneStaticDir, { recursive: true, force: true });
}

if (existsSync(sourcePublicDir)) {
  cpSync(sourcePublicDir, standalonePublicDir, { recursive: true, force: true });
}

const child = spawn("node", [join(standaloneDir, "server.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: process.env.PORT || "3000",
    HOSTNAME: process.env.NEXT_HOSTNAME || "0.0.0.0",
  },
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
