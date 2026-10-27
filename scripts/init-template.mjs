// filename: scripts/init-template.mjs
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { name: { type: "string" }, slug: { type: "string" } },
  strict: true,
});
const name = values.name?.trim();
const slug = values.slug;
if (
  !name ||
  name.length > 100 ||
  !slug ||
  slug.length > 100 ||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
) {
  console.error(
    "Usage: npm run template:init -- --name 'My App' --slug my-app",
  );
  process.exit(1);
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
pkg.name = slug;
lock.name = slug;
lock.packages[""].name = slug;
for (const [file, data] of [
  ["project.json", { name, slug }],
  ["package.json", pkg],
  ["package-lock.json", lock],
]) {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}
console.log(`Initialized ${name} (${slug}).`);
