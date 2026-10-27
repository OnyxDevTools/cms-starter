// filename: app/feed.xml/route.ts
import { publicEntries } from "@/lib/cms/public";
import { getSite } from "@/lib/server";
import { xml } from "@/lib/sitemap";
export const dynamic = "force-dynamic";
export async function GET() {
  const site = await getSite(),
    items = (await publicEntries())
      .filter((item) => item.revision.contentType === "post")
      .sort((a, b) => b.revision.createdAt.localeCompare(a.revision.createdAt))
      .slice(0, 50);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(site.name)}</title><link>${xml(site.origin)}</link><description>${xml(site.description)}</description>${items.map(({ revision }) => `<item><title>${xml(revision.title)}</title><link>${xml(new URL(revision.path, site.origin).href)}</link><guid isPermaLink="true">${xml(new URL(revision.path, site.origin).href)}</guid><description>${xml(revision.summary)}</description><pubDate>${new Date(revision.publishedAt || revision.createdAt).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
