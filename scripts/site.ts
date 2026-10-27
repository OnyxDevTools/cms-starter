// filename: scripts/site.ts
import { parseArgs } from "node:util";
import { OnyxStore } from "../lib/repository";
import { Publishing } from "../lib/publication";
const { values } = parseArgs({
  options: { origin: { type: "string" }, name: { type: "string" } },
  strict: true,
});
if (!values.origin)
  throw new Error(
    "Use --origin https://your-domain.example and optional --name.",
  );
const service = new Publishing(new OnyxStore()),
  site = await service.settings();
await service.saveSettings({
  ...site,
  origin: values.origin,
  ...(values.name ? { name: values.name } : {}),
});
console.log("Site origin updated in Onyx.");
