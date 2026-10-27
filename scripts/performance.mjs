// filename: scripts/performance.mjs
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform } from "node:os";
const base = process.env.PERF_URL || "http://127.0.0.1:3130";
const paths = ["/", "/about", "/resources", "/resources/example"];
let preview;
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Command exited ${code}`)),
    );
  });
}
try {
  if (!process.env.PERF_URL) {
    preview = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "tests/fixture/preview.ts",
        "--production",
      ],
      { stdio: "inherit", env: { ...process.env, TEST_PORT: "3130" } },
    );
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (preview.exitCode !== null) throw new Error("Fixture preview exited");
      try {
        if ((await fetch(`${base}/api/health`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("Performance preview did not start");
  }
  await mkdir("reports/lighthouse", { recursive: true });
  const results = [];
  for (const [index, path] of paths.entries()) {
    const output = `reports/lighthouse/${index}.json`;
    await run([
      "node_modules/lighthouse/cli/index.js",
      base + path,
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
      "--output=json",
      `--output-path=${output}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--quiet",
    ]);
    const lhr = JSON.parse(await readFile(output, "utf8"));
    if (lhr.runtimeError) throw new Error(lhr.runtimeError.message);
    const scores = Object.fromEntries(
      Object.entries(lhr.categories).map(([key, value]) => [
        key,
        Math.round(value.score * 100),
      ]),
    );
    const row = {
      path,
      scores,
      lcp: lhr.audits["largest-contentful-paint"].numericValue,
      cls: lhr.audits["cumulative-layout-shift"].numericValue,
      browser: lhr.environment.hostUserAgent,
      settings: lhr.configSettings,
    };
    results.push(row);
    console.log(path, scores);
  }
  const summary = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    fixture: !process.env.PERF_URL,
    results,
  };
  await writeFile(
    "reports/lighthouse/summary.json",
    JSON.stringify(summary, null, 2),
  );
  const failed = results.filter(
    (result) =>
      result.scores.performance < 90 ||
      result.scores.accessibility < 95 ||
      result.scores["best-practices"] < 95 ||
      result.scores.seo < 95,
  );
  if (failed.length)
    throw new Error(
      `Lighthouse targets missed: ${failed.map((item) => item.path).join(", ")}. Inspect reports/lighthouse without lowering thresholds.`,
    );
} finally {
  preview?.kill("SIGTERM");
}
