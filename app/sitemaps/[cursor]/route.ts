// filename: app/sitemaps/[cursor]/route.ts
import { getService, getSite } from "@/lib/server";
import { canonical } from "@/lib/domain";
import { index, sitemapResponse, xml } from "@/lib/sitemap";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cursor: string }> },
) {
  const value = (await params).cursor;
  if (!/^[a-f0-9]{1,8}\.xml$/.test(value))
    return new Response("Not found", { status: 404 });
  const prefix = value.slice(0, -4),
    service = getService(),
    site = await getSite();
  const batch = await service.store.list("Page", { prefix, limit: 100 });
  if (batch.cursor) {
    if (prefix.length >= 8)
      return new Response("Sitemap shard capacity exceeded", { status: 503 });
    return sitemapResponse(index(site.origin, prefix));
  }
  const revisions = await Promise.all(
    batch.items.map((page) =>
      page.publishedRevisionId && !page.archived
        ? service.store.get("PageRevision", page.publishedRevisionId)
        : null,
    ),
  );
  return sitemapResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${revisions
      .filter((revision) => revision?.indexable)
      .map(
        (revision) =>
          `<url><loc>${xml(canonical(site, revision!.path))}</loc><lastmod>${xml(revision!.createdAt)}</lastmod></url>`,
      )
      .join("")}</urlset>`,
  );
}
