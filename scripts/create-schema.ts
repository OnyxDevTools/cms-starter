// filename: scripts/create-schema.ts
import { writeFile } from "node:fs/promises";
import { schemas } from "../lib/domain";
const tables = Object.entries(schemas).map(([name, schema]) => ({
  name,
  type: "DEFAULT",
  identifier: { name: "id", type: "String", generator: "None" },
  attributes: Object.entries(schema.shape).map(([key, value]) => {
    const info = value.toJSONSchema({ io: "input", unrepresentable: "any" });
    return {
      name: key,
      type:
        key === "createdAt" || key === "updatedAt"
          ? "Timestamp"
          : info.type === "boolean"
            ? "Boolean"
            : info.type === "integer" || info.type === "number"
              ? "Int"
              : "String",
      isNullable: false,
    };
  }),
  indexes: Object.keys(schema.shape)
    .filter((key) =>
      [
        "ownerUid",
        "ownerPageId",
        "pageId",
        "revisionId",
        "actorUid",
        "contentType",
        "kind",
        "role",
      ].includes(key),
    )
    .map((name) => ({ name, type: "DEFAULT" })),
  resolvers: [],
  triggers: [],
}));
await writeFile(
  new URL("../api/onyx.schema.json", import.meta.url),
  JSON.stringify({ tables }, null, 2) + "\n",
);
