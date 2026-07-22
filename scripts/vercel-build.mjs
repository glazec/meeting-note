import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function getVercelBuildScripts(vercelEnvironment) {
  return vercelEnvironment === "production"
    ? ["setup:check", "test:deployment-schema", "db:migrate", "build"]
    : ["build"];
}

function runNpmScript(script) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", script], { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === fileURLToPath(import.meta.url)) {
  for (const script of getVercelBuildScripts(process.env.VERCEL_ENV)) {
    runNpmScript(script);
  }
}
