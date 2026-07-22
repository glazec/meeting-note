import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "tape-migration-check-"));

try {
  cpSync(
    join(repositoryRoot, "drizzle.config.ts"),
    join(temporaryRoot, "drizzle.config.ts"),
  );
  cpSync(
    join(repositoryRoot, "tsconfig.json"),
    join(temporaryRoot, "tsconfig.json"),
  );
  cpSync(join(repositoryRoot, "db"), join(temporaryRoot, "db"), {
    recursive: true,
  });
  mkdirSync(join(temporaryRoot, "lib"));
  cpSync(
    join(repositoryRoot, "lib", "meeting-bot-constants.ts"),
    join(temporaryRoot, "lib", "meeting-bot-constants.ts"),
  );
  symlinkSync(
    join(repositoryRoot, "node_modules"),
    join(temporaryRoot, "node_modules"),
    "dir",
  );

  const migrationDirectory = join(temporaryRoot, "db", "migrations");
  const before = snapshotDirectory(migrationDirectory);
  const result = spawnSync(
    process.execPath,
    [
      join(repositoryRoot, "node_modules", "drizzle-kit", "bin.cjs"),
      "generate",
      "--config=drizzle.config.ts",
      "--name=ci_schema_drift",
    ],
    {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://migration-check:migration-check@127.0.0.1:5432/migration-check",
      },
      encoding: "utf8",
    },
  );

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.error) {
    throw result.error;
  }

  if (
    result.status !== 0 ||
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes("Error:")
  ) {
    throw new Error("Drizzle migration generation failed");
  }

  const changedFiles = compareSnapshots(
    before,
    snapshotDirectory(migrationDirectory),
  );

  if (changedFiles.length > 0) {
    throw new Error(
      `Schema changes are missing a committed migration: ${changedFiles.join(", ")}`,
    );
  }

  console.log("Migration files match the current schema.");
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

function snapshotDirectory(root) {
  const snapshot = new Map();

  for (const path of walk(root)) {
    const relativePath = path.slice(root.length + 1);
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    snapshot.set(relativePath, hash);
  }

  return snapshot;
}

function walk(root) {
  return readdirSync(root, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
}

function compareSnapshots(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);

  return [...paths]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();
}
