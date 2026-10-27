// filename: scripts/recover-lock.ts
import { parseArgs } from "node:util";
import { z } from "zod";
import { OnyxStore } from "../lib/repository";
const { values } = parseArgs({
  options: {
    page: { type: "string" },
    "confirm-writers-stopped": { type: "boolean" },
  },
  strict: true,
});
const id = z
  .string()
  .min(1)
  .max(220)
  .regex(/^[a-zA-Z0-9:_-]+$/)
  .parse(values.page);
if (!values["confirm-writers-stopped"])
  throw new Error(
    "Stop every writer process and explicitly pass --confirm-writers-stopped before lock recovery.",
  );
const store = new OnyxStore();
const lock = await store.get("PageLock", id);
if (lock) {
  await store.delete("PageLock", id);
  console.log(
    "Removed the selected CMS lock. Restart writers only after reviewing the page state.",
  );
} else console.log("No lock exists for that page.");
