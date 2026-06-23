#!/usr/bin/env node
/**
 * Runs `prisma generate`, but on Windows the native query engine DLL is locked
 * while `pnpm dev` is running. In that case, continue with the existing client
 * so `pnpm build` / `pnpm dev` are not blocked.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function prismaClientExists() {
  try {
    const require = createRequire(import.meta.url);
    require.resolve("@prisma/client");
    return true;
  } catch {
    return false;
  }
}

const result = spawnSync("pnpm", ["exec", "prisma", "generate"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status === 0) {
  process.exit(0);
}

const combined = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`;

if (
  /EPERM|operation not permitted|EACCES/i.test(combined) &&
  prismaClientExists()
) {
  console.warn(
    "\n[omnishift] prisma generate skipped: query engine file is locked " +
      "(usually because `pnpm dev` is running). Using the existing Prisma client.\n" +
      "Stop the dev server and run `pnpm db:generate` after changing prisma/schema.prisma.\n",
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
