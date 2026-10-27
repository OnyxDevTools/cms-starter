// filename: scripts/smoke-template.mjs
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
const destination = await mkdtemp(join(tmpdir(), "cms-starter-smoke-"));
try {
  await cp(process.cwd(), destination, {
    recursive: true,
    filter: (path) => {
      const name = basename(path);
      return (
        ![
          ".git",
          "config",
          "node_modules",
          ".next",
          ".next-analyze",
          "reports",
          ".test-runtime",
          "test-results",
          "playwright-report",
        ].includes(name) &&
        !name.endsWith(".tsbuildinfo") &&
        !name.startsWith("onyx-database") &&
        !(name.startsWith(".env") && name !== ".env.example")
      );
    },
  });
  const run = (args) =>
    execFileSync("npm", args, {
      cwd: destination,
      stdio: "inherit",
      timeout: 180000,
    });
  run(["ci", "--no-audit", "--no-fund"]);
  run([
    "run",
    "template:init",
    "--",
    "--name",
    "Smoke Site",
    "--slug",
    "smoke-site",
  ]);
  const identity = JSON.parse(
    await readFile(join(destination, "project.json"), "utf8"),
  );
  if (identity.slug !== "smoke-site")
    throw new Error("Identity initialization failed");
  run(["run", "check"]);
  run(["run", "test:e2e"]);
  console.log(
    "Fresh template install, naming, build, and browser smoke checks passed.",
  );
} finally {
  await rm(destination, { recursive: true, force: true });
}
