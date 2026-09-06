import { spawn, spawnSync } from "node:child_process";

const npmCliPath = process.env.npm_execpath;

if (typeof npmCliPath !== "string" || npmCliPath.length === 0) {
  console.error("dev:product must be started through npm: npm run dev:product");
  process.exit(1);
}

function startNpm(args, extraEnv = {}) {
  return spawn(process.execPath, [npmCliPath, ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

const backend = startNpm(["run", "app"], {
  STATBLOCK_APP_NO_OPEN: "1",
  STATBLOCK_APP_HOST: "0.0.0.0",
  STATBLOCK_ALLOWED_ORIGINS: process.env.STATBLOCK_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173",
});
const frontend = startNpm(["run", "dev", "--workspace", "statblock-parser-frontend"]);

let stopping = false;

function terminate(child) {
  if (child.pid === undefined) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  terminate(frontend);
  terminate(backend);
  setTimeout(() => process.exit(exitCode), 50).unref();
}

backend.on("error", (error) => {
  console.error("Failed to start parser backend:");
  console.error(error);
  stop(1);
});

frontend.on("error", (error) => {
  console.error("Failed to start React frontend:");
  console.error(error);
  stop(1);
});

backend.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});

frontend.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
