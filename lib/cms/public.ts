// filename: lib/cms/public.ts
import "server-only";
import { getService } from "../server";
import { isIndexable } from "../domain";
import { all } from "./service";
export async function publicEntries() {
  const service = getService(),
    pages = await all(service.store, "Page");
  const entries = [];
  for (const page of pages) {
    if (!page.publishedRevisionId || page.archived) continue;
    const { revision } = await service.revision(page.publishedRevisionId);
    if (isIndexable(page, revision))
      entries.push({
        page,
        revision,
        terms: (
          await Promise.all(
            revision.terms
              .split(",")
              .filter(Boolean)
              .map((id) => service.store.get("Taxonomy", id)),
          )
        )
          .filter((term) => !!term)
          .map((term) => term!.name)
          .join(" "),
      });
  }
  return entries;
}
