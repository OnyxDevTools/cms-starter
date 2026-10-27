// filename: scripts/check-bundle.mjs
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const raw = execFileSync(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "experimental-analyze",
    "export",
    "--route",
    "/[[...slug]]",
  ],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);
const graph = raw
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const outputs = graph.filter(
  (item) => item.type === "output" && item.filename.includes("/static/"),
);
if (!outputs.length)
  throw new Error("No public client outputs found. Run npm run analyze first.");
const modules = outputs.flatMap((output) => output.modules);
const forbidden = modules.filter((name) =>
  /lexical|@onyx.dev|\]\/admin\//u.test(name),
);
if (forbidden.length)
  throw new Error(
    `Privileged/editor modules in public client outputs: ${forbidden.join(", ")}`,
  );
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/bundle-summary.json",
  JSON.stringify(
    {
      route: "/[[...slug]]",
      clientOutputs: outputs.length,
      clientModules: new Set(modules).size,
      forbiddenModules: forbidden,
    },
    null,
    2,
  ),
);
console.log(
  `Verified ${outputs.length} public client outputs: no Lexical, administration, or Onyx SDK modules.`,
);
