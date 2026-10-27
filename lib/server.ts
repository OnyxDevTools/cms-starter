// filename: lib/server.ts
import "server-only";
import { cache } from "react";
import { OnyxStore } from "./repository";
import { Publishing } from "./publication";
import { CMS } from "./cms/service";
export const getCMS = cache(() => new CMS(new OnyxStore()));

// No content cache: React cache deduplicates reads only within this render.
// The SDK caches credential resolution, never publication state.
export const getService = cache(() => new Publishing(new OnyxStore()));
export const getSite = cache(async () => getService().settings());
export const getPublicPage = cache(async (path: string) =>
  getService().publicPage(path),
);
export const getNavigation = cache(async () => {
  const rows = (await getService().navigation()).filter((row) => row.enabled);
  const visible = await Promise.all(
    rows.map(async (row) => ({
      row,
      page: row.pageId
        ? await (async () => {
            const page = await getService().store.get("Page", row.pageId);
            if (!page?.publishedRevisionId || page.archived) return null;
            return getPublicPage(
              (await getService().revision(page.publishedRevisionId)).revision
                .path,
            );
          })()
        : await getPublicPage(row.path),
    })),
  );
  return visible
    .filter((item) => item.page)
    .map((item) => ({ ...item.row, path: item.page!.revision.path }));
});
