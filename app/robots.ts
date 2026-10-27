// filename: app/robots.ts
import type { MetadataRoute } from "next";
import { getSite } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSite();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/preview", "/api"],
    },
    sitemap: new URL("/sitemap.xml", site.origin).href,
  };
}
