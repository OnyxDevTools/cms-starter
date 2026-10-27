// filename: app/sitemap.xml/route.ts
import { getSite } from "@/lib/server";
import { index, sitemapResponse } from "@/lib/sitemap";
export const dynamic = "force-dynamic";
export async function GET() {
  return sitemapResponse(index((await getSite()).origin));
}
